# Phase 12｜RLS、Table Grants、RPC EXECUTE 與 SECURITY DEFINER 唯讀稽核

日期：2026-11-08  
分支：app/phase-1-planning  
Supabase 專案：yemzdwxtyosuaczsqwea  
範圍：正式資料庫唯讀 metadata／函式原始碼檢視；未讀取顧客訂單明細或個資列。

> 本文件是安全稽核與修正建議，不是已修復證明。沒有執行 DDL、DML、GRANT、REVOKE、migration、Function 部署或 Secrets 變更。

## 1. 執行摘要

已檢查核心訂單、訂單明細、個資、冷藏寄放、蘿蔔糕、商品、每日訂購設定、管理員設定、網站內容、付款與寄放設定的 RLS policies；檢視其 table grants；並讀取指定敏感 RPC 的定義、SECURITY DEFINER、search_path 與 EXECUTE ACL。另讀取 Supabase Security Advisor。

目前需要優先處理的風險：

| 優先級 | 發現 | 證據／影響 |
|---|---|---|
| P0 | LINE 訂單 payload RPC 可由 PUBLIC／anon／authenticated 執行 | `get_line_order_notification_payload(uuid)` 與 `get_cooling_order_line_notification_payload(bigint)` 為 SECURITY DEFINER，函式內未見呼叫者／訂單權限驗證，會回傳顧客姓名、電話、訂單地址或門市、品項、匯款末五碼及管理員 LINE 收件者 |
| P0 | 付款證明 RPC 未驗證訂單所有權 | `submit_customer_payment(uuid,text,text)` 為 SECURITY DEFINER，EXECUTE ACL 含 anon、authenticated；函式依傳入 order_id 更新付款末五碼及 proof path，未見 auth.uid()／訂單所有權驗證 |
| P0 | 通知旗標 RPC 可被一般角色執行 | `mark_line_payment_notification_sent(uuid)` 為 SECURITY DEFINER，EXECUTE ACL 含 PUBLIC、anon、authenticated；函式只依 order_id 更新 payment_notification_sent，未見呼叫者授權 |
| P1 | LINE 綁定 RPC 授權不足 | `bind_line_customer_phone(text,text)` 可由 service_role 執行，僅以電話匹配歷史訂單，未見 LINE webhook 簽章／一次性驗證碼／可信 caller token 驗證；`bind_line_order(uuid,text)` 可直接寫入 order_id 與 line_user_id，未見內部授權 |
| P1 | 冷藏寄放資料表允許 anon 直接 INSERT | `cooling_pickup_orders`、`cooling_pickup_order_items` 有 anon INSERT grant 與 policy；可繞過 RPC 的價格／庫存／訂單欄位驗證路徑，須評估舊官網相容後收斂 |
| P1 | `merch_backend_sync` 未啟用 RLS | metadata 顯示 relrowsecurity=false；目前檢視的 grants 未看到 anon/authenticated 的 SELECT／INSERT／UPDATE／DELETE，但仍須核對所有者、schema exposure、views、函式與 service-role 使用依賴 |
| P1 | `order_items` 沒有會員自有明細 SELECT policy | 目前 SELECT policy 為管理員；orders 有 customer_read_own_orders，但會員無法直接依此讀取自己的明細。需以安全 RPC／受限 view 或明確 ownership policy 提供 |
| P1 | 蘿蔔糕訂單只對管理員開放 SELECT | radish_orders／radish_order_items policies 僅管理員讀取；若未來會員訂單中心要查詢，需新增經驗證的本人讀取方式 |
| P2 | Auth leaked password protection 關閉 | Supabase Security Advisor 回報 WARN；應在正式 Auth 設定前提出使用者影響與回復方式 |
| P2 | 多個 SECURITY DEFINER RPC 被 Advisor 提醒可由 authenticated 呼叫 | 不代表每支都可被利用；必須逐支確認函式內部角色／資料範圍檢查，僅保留必要入口 |

## 2. RLS Policy 摘要

以下是查詢當下 metadata；RLS enabled 不等於安全，仍須配合 grants、policy predicate、RPC 與實際 API 使用方式檢查。

| Table | RLS | 主要 policy 摘要 | 評估 |
|---|---|---|---|
| orders | enabled | authenticated 管理員讀取／更新；customer_read_own_orders 以 customer_user_id=auth.uid() 讀取 | 基礎方向合理；仍需確認欄位暴露及付款 RPC |
| order_items | enabled | 管理員 SELECT／DELETE | 缺少會員本人明細讀取 |
| order_private | enabled | 個資管理員管理；個資管理員或訂單本人可 SELECT | 本人關聯依 orders.customer_user_id |
| cooling_pickup_orders | enabled | anon/authenticated INSERT；訂單管理員 ALL | anon 直接 INSERT 風險，缺少顧客本人 SELECT |
| cooling_pickup_order_items | enabled | anon/authenticated INSERT；訂單管理員 ALL | anon 直接 INSERT 風險，缺少顧客本人 SELECT |
| radish_orders | enabled | 管理員 SELECT／UPDATE | 顧客本人查詢缺失 |
| radish_order_items | enabled | 管理員 SELECT | 顧客本人明細查詢缺失 |
| flavors | enabled | 公開讀 enabled；商品管理員 ALL | 可公開商品讀取符合用途 |
| daily_order_settings | enabled | 公開讀取未來且 ordering_enabled=true；管理員管理 | 需確認是否應公開所有未來開單資訊 |
| daily_order_regions | enabled | 公開讀取未來且 enabled=true；管理員管理 | 方向合理 |
| daily_order_flavors | enabled | 公開讀取未來且 enabled=true；管理員管理 | 需確認數量欄位是否應公開 |
| admin_profiles | enabled | 本人讀取；super_admin 管理 | 需確保其他函式不繞過此限制 |
| site_admin_content | enabled | anon 只讀特定公開 section；admin／super_admin 管理 | 公開 section allowlist 方向合理 |
| pickup_settings | enabled | anon/authenticated SELECT using true；order_admin 管理 | 公開欄位需再檢查，不宜將內部設定放同表 |
| payment_settings | enabled | 公開讀 enabled=true；個資管理員／super_admin 管理 | 公開欄位需最小化 |
| merch_backend_sync | disabled | 無 RLS policies | 高風險待確認；未直接改動 |

所有上述表在查詢結果中 relforcerowsecurity=false。對一般 API role 的保護主要依賴 RLS policies；service_role 具繞過 RLS 能力，必須確保不進入前端。

## 3. Table Grants 摘要

- `cooling_pickup_orders` 與 `cooling_pickup_order_items` 明確有 anon INSERT grants，與對應 INSERT policies 配合，訪客可直接走 table insert 路徑。
- `orders`、`order_items`、`order_private` 未見 anon 的 SELECT／INSERT／UPDATE／DELETE grants；authenticated 有部分 CRUD grants，但受 RLS 限制。
- `flavors`、每日開單設定、`site_admin_content`、`pickup_settings`、`payment_settings` 有 anon SELECT grants，實際列仍由 RLS policy 篩選。
- `radish_orders` 與 `radish_order_items` 未見 anon SELECT／INSERT／UPDATE／DELETE grants；authenticated SELECT／UPDATE 權限仍由管理員 policies 控制。
- `merch_backend_sync` 本次輸出未見 anon/authenticated 的資料操作 grants；RLS disabled 仍需查 schema exposure、view、function、owner 與 service-role 依賴，不能只憑這一點宣告資料可被公開讀取。
- metadata grants 包含 REFERENCES、TRIGGER、TRUNCATE 等權限列；本次報告聚焦資料操作能力，不將非資料讀寫權限誤判為可讀取顧客資料。

## 4. RPC／SECURITY DEFINER 檢查

### 4.1 已確認需立即列入修正清單

**A. get_line_order_notification_payload(uuid)**

- SECURITY DEFINER=true；owner postgres；search_path=`public, extensions`。
- EXECUTE ACL 包含 PUBLIC、anon、authenticated、service_role。
- 函式依 order_id 讀取 orders、order_private、order_items、line_notification_settings，回傳顧客姓名、電話、備註、取貨資訊、匯款末五碼、品項與管理員 LINE recipient。
- 函式本體未見 auth.uid()、管理員角色、內部 token 或 service-only caller 驗證。
- 建議：撤銷 PUBLIC／anon／authenticated EXECUTE；僅允許可信任 Edge Function 的服務角色或移至不可公開 schema；Edge Function 端仍需驗證呼叫者及訂單狀態。需先檢查既有 trigger／function caller，不能直接改權限。

**B. get_cooling_order_line_notification_payload(bigint)**

- SECURITY DEFINER=true；owner postgres；search_path=`public`。
- EXECUTE ACL 包含 PUBLIC、anon、authenticated、service_role。
- 回傳冷藏寄放訂單姓名、電話、門市、匯款末五碼、品項及管理員 LINE recipient。
- 函式本體未見呼叫者授權。
- 建議同 A；同時確認舊官網與通知 Edge Function 的 caller 相容性。

**C. mark_line_payment_notification_sent(uuid)**

- SECURITY DEFINER=true；owner postgres；search_path=`public`。
- EXECUTE ACL 包含 PUBLIC、anon、authenticated、service_role。
- 函式直接依 order_id 更新 payment_notification_sent=true，未見授權或狀態條件。
- 建議撤銷公開／一般使用者執行權限，改由可信任通知服務在成功送達後呼叫；加入冪等與狀態驗證。

**D. submit_customer_payment(uuid,text,text)**

- SECURITY DEFINER=true；owner postgres；search_path=`public`。
- EXECUTE ACL 包含 anon、authenticated。
- 函式檢查末五碼格式與證明路徑至少一項存在，但只依傳入 order_id 更新付款資料，未見驗證訂單屬於 auth.uid()，也未見訪客訂單短效驗證 token。
- 建議會員只能更新自己的訂單；訪客訂單須以短效高熵 token 或服務端驗證；限制可提交狀態、證明路徑必須綁定該訂單且不能任意指定其他 Storage 路徑。需保留既有訪客結帳相容方式。

### 4.2 LINE 綁定函式

- `bind_line_customer_phone(text,text)`：SECURITY DEFINER；EXECUTE ACL 僅 postgres／service_role。函式只依電話比對歷史訂單並建立 LINE 綁定，需確認呼叫端確實為經 HMAC 驗證的 LINE webhook 或具一次性驗證流程的可信服務。
- `bind_line_order(uuid,text)`：SECURITY DEFINER；EXECUTE ACL 僅 postgres／service_role；函式可直接寫入 order_id 與 line_user_id，應確認僅內部服務可呼叫且先完成顧客身分驗證。

### 4.3 管理員函式

- `admin_confirm_payment(uuid)`：SECURITY DEFINER；authenticated EXECUTE；函式內有 `is_admin('order_admin')` 檢查，初步具角色驗證，但仍需測試 role helper 與 admin profile 停用情況。
- `admin_update_order_status(uuid,text)`：SECURITY DEFINER；PUBLIC EXECUTE；函式內有 `is_admin()` 檢查及狀態 allowlist。雖有函式內授權，仍建議撤銷 PUBLIC EXECUTE 並限定 authenticated，降低不必要公開入口。
- `admin_generate_seven_eleven_label(uuid)`：SECURITY INVOKER；authenticated EXECUTE；函式內有管理員檢查，需確認相關 table grants/RLS 能讓合法管理員工作且不擴大資料權限。
- `is_admin`、`is_order_admin`、`is_personal_data_admin`、`get_current_admin_profile` 等 SECURITY DEFINER helper 有 authenticated EXECUTE；其輸出主要為布林或本人角色，屬管理員權限判斷輔助，但應避免公開不必要的內部管理資訊。
- Supabase Advisor 列出多支 SECURITY DEFINER 函式可由 authenticated 呼叫；這是檢查清單，不代表全數都是漏洞。每支需確認函式內部是否先做角色驗證、資料範圍限制與狀態檢查。

## 5. SECURITY DEFINER search_path

本次指定敏感函式多數已設定固定 search_path，例如 `public` 或 `public, extensions`，這比使用可被呼叫者控制的 search_path 好；但若 search_path 中包含可由一般角色 CREATE object 的 schema，仍須進一步確認 schema CREATE 權限。建議所有 SECURITY DEFINER 函式使用最小固定 schema、對物件採 schema-qualified 名稱，並撤銷不必要 EXECUTE。

## 6. Supabase Security Advisor

本次 security advisor 回報：
- 多支 SECURITY DEFINER 函式可由 authenticated 角色呼叫，需逐支審查其內部授權與 EXECUTE 需求。
- Auth leaked password protection disabled（WARN）。

Advisor 的提醒需結合函式內容判斷；不能將「SECURITY DEFINER 可執行」單獨視為已證實資料外洩。

## 7. 修正建議排序（只提案，未執行）

1. P0：限制兩支 LINE payload RPC 的 EXECUTE；改為內部服務端呼叫，並在 Edge Function 內驗證來源、訂單 ID 與通知事件。
2. P0：修正 submit_customer_payment：會員 ownership check；訪客訂單使用短效高熵驗證；proof path 綁定 order_id。
3. P0：限制 mark_line_payment_notification_sent；僅可信任通知服務可更新，並檢查送達結果／事件冪等。
4. P1：盤點 cooling_pickup_orders/items 直接 INSERT 的所有官網／App caller，先提供替代 RPC，再撤銷 anon direct INSERT。
5. P1：確認 merch_backend_sync 所有依賴與 grants，再提出 RLS／schema exposure 修正。
6. P1：設計會員本人讀取 order_items、radish_orders/items、cooling pickup 訂單的安全方式。
7. P1：LINE 綁定改為一次性驗證或可信 webhook 流程，不以電話匹配作唯一身份證明。
8. P2：Auth leaked password protection 開啟前，先評估既有會員登入相容性並準備客服說明。
9. 全面：產生 RPC caller matrix，逐支對照前端、Edge Function、trigger、排程與外部 webhook，確認每支 EXECUTE 權限最小化。

## 8. 上線前驗收測試

- anon 不可呼叫兩支 LINE payload RPC 取得任意訂單資料。
- authenticated 顧客 A 不可讀取／修改顧客 B 的付款證明、末五碼或訂單資料。
- 訪客無有效短效驗證不得修改既有訂單付款資料。
- anon 不可直接 INSERT 冷藏寄放訂單／明細；合法官網與 App 下單仍正常。
- 一般 authenticated 不可更新付款通知旗標。
- 非授權 LINE caller 不可綁定任意電話、訂單或 LINE user ID。
- 管理員被停用後，所有管理 RPC 立即拒絕操作。
- 會員只能讀取自己的訂單主檔、明細及物流資料。
- 所有 Edge Function caller、webhook signature、token、重播與冪等測試通過。
- 舊官網各下單頁回歸測試通過。

## 9. 安全與執行界線

- 本階段只有 SELECT metadata、讀取函式定義與 Security Advisor。
- 未查詢或輸出任何顧客訂單列、姓名、電話、地址、匯款資料。
- 未執行任何 DDL／DML／GRANT／REVOKE／migration。
- 未部署／停用／替換 Edge Function。
- 未修改 Secrets、Auth 設定、官網或正式資料。
- 未建立付費 Supabase branch。
- 本文件中的所有修正均為提案；需逐項列出 SQL、caller、風險、相容方式、備份與回復計畫，並取得對該變更清單的明確核准後才可執行。
