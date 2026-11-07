# Phase 15｜正式安全修補差異清單、caller 遷移與回復計畫

日期：2026-11-08  
分支：app/phase-1-planning  
性質：正式環境變更前的實施規格；僅文件，不執行修補。

> 本階段不執行任何 SQL、migration、GRANT／REVOKE、Edge Function deploy、Secrets 修改、Auth 設定、官網切換或正式資料寫入。此文件是待審查 patch inventory，不是已修復證明。

## 1. 結論與上線阻擋

目前不能直接在正式環境套用一包 SQL 或直接替換 Functions。已知通知鏈包含 DB trigger、RPC、Edge Function、LINE webhook 與舊官網 caller；若只封鎖 RPC 或輪替密鑰，可能造成訂單成立後通知中斷，或讓舊官網付款／出貨流程失效。

優先順序：
- P0-A：LINE 新訂單通知端點缺 caller authentication。
- P0-B：兩支訂單 payload RPC 對 PUBLIC／anon／authenticated 開放，可能暴露個資。
- P0-C：付款證明提交被錯誤描述為「已付款」。
- P0-D：LINE 管理員綁定流程疑似只靠任何 LINE 使用者傳送「綁定管理員」即可更新管理員收件者；必須先確認完整授權條件。若無 allowlist／一次性邀請碼／既有管理員核准，應列 P0。
- P0-E：submit_customer_payment 依 order_id 更新付款資料，未見會員 ownership 或訪客短效驗證。
- P0-F：mark_line_payment_notification_sent 對一般角色開放執行，可能被任意修改通知旗標。
- P1：硬編碼內部密鑰、顧客出貨通知信任 body 欄位、LINE 手機綁定缺 OTP、冷藏寄放 anon direct INSERT、會員本人訂單讀取缺口及 merch_backend_sync RLS／schema exposure 待確認。

## 2. 精確變更盤點（不含可直接執行的 production SQL）

### 2.1 RPC／資料庫函式

| 物件 | 已知問題 | 預定 patch | caller／相容要求 |
|---|---|---|---|
| get_line_order_notification_payload(uuid) | SECURITY DEFINER；PUBLIC／anon／authenticated EXECUTE；未見 caller／ownership check | 將一般角色 EXECUTE 收斂；僅可信服務端可取得最小化 payload；固定 search_path 並明確 schema qualify | 先盤點所有 Edge Function、trigger、官網與外部 caller；先遷移，再限制權限 |
| get_cooling_order_line_notification_payload(bigint) | 同上 | 同上；移除對 publishable key 的內部授權依賴 | cooling-order-line-notify 先切換為可信服務端呼叫並測試 |
| mark_line_payment_notification_sent(uuid) | SECURITY DEFINER；一般角色可執行，僅憑 order_id 更新旗標 | 改成內部通知交易／服務端專用操作；綁定 event_id、狀態與 sent_at | 查清所有呼叫者；不能先撤權再找 caller |
| submit_customer_payment(uuid,text,text) | 依 order_id 更新付款欄位，未見會員 ownership 或訪客短效 proof | 改為會員本人授權或高熵、短效、限次 guest token；只允許 proof_submitted，不允許顧客設 paid | 盤點四種物流與所有舊官網付款表單；保留舊表單過渡 adapter |
| bind_line_customer_phone(text,text) | 以電話比對歷史訂單並批次綁定，無 OTP／一次性本人證明 | 以 OTP 或會員登入後短效 token 驗證；綁定單筆或明確授權範圍 | 舊 LINE 綁定指引需更新；避免電話相同而錯綁家庭成員訂單 |
| bind_line_order overloads | 部分 overload 僅靠訂單編號＋電話末四碼；service_role caller | 加強 rate limit、cooldown、短效 proof、稽核事件；移除不再需要 overload 前先確認依賴 | 逐一確認 webhook 及舊版 Function 呼叫簽章 |
| notify_line_on_new_order() | trigger 呼叫公開 Function，未帶內部 caller proof | 改用可靠的內部事件傳遞／佇列或短效簽章 envelope；不在 trigger source 存長期明文 secret | 保留 orders 新單通知語意及錯誤重試 |
| notify_line_on_payment_proof() | trigger source 有硬編碼密鑰 | 移除明文 secret；使用受控內部呼叫方案及雙 key 輪替 | 先部署兼容 Function，再切換 trigger |
| notify_line_on_cooling_order_payment() | trigger source 有硬編碼密鑰 | 同上 | 冷藏寄放最低數量、狀態 trigger 與通知必須一併回歸 |

### 2.2 Edge Functions

| Function | 預定修改 | 必要驗收 |
|---|---|---|
| line-order-send-v2 | 強制內部 caller 驗證；只接受已簽章事件；最小化 payload；event_id 冪等 | 未授權 401／403；合法 trigger 成功；重播不重複通知 |
| line-order-payment-send-v2 | Secrets 化；付款證明與核款成功分流；只在正確狀態通知 | proof_submitted 顯示待核款；confirmed 才可通知已付款 |
| cooling-order-line-notify | Secrets 化；service role 取得受限 payload；修正付款文案 | payment_last5 存在但待核款時不可顯示已付款 |
| line-order-notify | 查明是否舊版／平行 caller；Secrets 化並限制事件類型 | 新舊通知不重複、不漏發 |
| line-payment-order-notify | 查明 caller；加入授權、狀態條件及冪等 | 只接受可信付款事件 |
| line-payment-notify | 查明付款來源；限制 service_role 入口及 event replay | 非授權請求拒絕、合法付款事件成功 |
| line-customer-notify | token 驗證後由 DB 查 recipient、訂單號、物流與門市；忽略 request body 中這些欄位 | 偽造 recipient／門市／訂單號不影響訊息 |
| line-webhook | 保留 raw-body LINE HMAC；加入 webhook event 去重、綁定 OTP／邀請流程 | 錯誤簽章拒絕；重送 event 不重複執行 |
| admin-manage | 保留 JWT + getUser + enabled super_admin；補 schema validation、audit log、rate limit | 一般會員、停用管理員與錯誤角色皆拒絕 |
| line-order-test、line-order-test-2 至 line-order-test-7 | 暫不刪除／停用；先追查使用者、外部 caller、排程與監控 | 取得依賴證據後才決定是否退役 |

## 3. LINE 管理員綁定 P0 核查

既有來源檢視曾發現 line-webhook 對「綁定管理員」訊息執行 line_notification_settings upsert 的路徑。LINE HMAC 只能證明事件來自 LINE 平台，不能證明傳訊者是公司管理員。

正式 patch 前必須重新核對：
1. 是否存在已設定的管理員 LINE user ID allowlist。
2. 是否需要由既有 super_admin 發起邀請或核准。
3. 是否有一次性高熵邀請碼、有效期限及使用後作廢。
4. 是否記錄 actor、target、時間、來源事件與變更前後值。
5. 是否限制首次管理員初始化只能透過受控部署／Secrets 完成。

若上述授權不存在，應先封鎖自助管理員綁定，再以已驗證的管理員邀請流程取代；不可只依訊息文字授權。

## 4. caller 遷移順序（避免先封鎖再斷線）

1. 建立完整 caller inventory：DB trigger、所有 Edge Function、官網 HTML／JS、App、排程、外部自動化及 webhook。
2. 設計新 internal event contract：event_id、event_type、entity_id、issued_at、nonce、簽章版本；不包含不必要個資。
3. 建立本機／隔離環境 Function patch；完成 HMAC 真實密碼學測試、時間窗、nonce、防重播、schema validation。
4. 先部署兼容的新 Function（僅隔離環境）；舊 caller 與新 caller 同時可辨識，但不得雙重發送。
5. 將 trigger／官網／後台 caller 逐一切換；記錄每個 caller 的版本與成功率。
6. 驗證新通知事件與狀態更新成功、重試安全、LINE recipient 正確。
7. 才限制 payload RPC 與 notification flag RPC 的 EXECUTE 權限。
8. 完成密鑰雙 key 輪替：新增新 key → 新 Function 接受新舊 key → caller 切換 → 觀察 → 撤銷舊 key。
9. 最後收斂匿名 direct INSERT、會員 read policies、Auth 防洩漏密碼設定等其他項目；每項分開驗收。

## 5. 冷藏寄放與舊官網相容性

撤銷 cooling_pickup_orders／cooling_pickup_order_items 的 anon direct INSERT 前，必須先確認舊官網所有表單都已改走後端可信 RPC，並驗證：
- 主單與明細在同一交易內建立，失敗不留半張訂單。
- 最低訂購量至少 2 盒的既有規則仍生效。
- 價格、口味、運費／寄放費、庫存與可訂購狀態由後端讀取，不接受前端自行報價。
- 同一請求重送不建立重複訂單。
- 7-ELEVEN／全家冷藏寄放資料欄位與店家取貨說明保持正確。
- 涼糕送到府、蘿蔔糕冷凍店到店及冷凍宅配不受影響。

會員訂單讀取政策也不能只寫 TO authenticated；必須以 customer_user_id = auth.uid() 等實際 ownership 關聯限制資料列，並處理歷史訪客訂單的安全認領。

## 6. 付款語意與通知規則

- 顧客提交匯款末五碼／憑證：payment_status = proof_submitted（或既有相容狀態），顯示「已提交資料，待管理員核款」。
- 管理員核對實際入帳後，才可更新為 confirmed／paid（依統一狀態機決定正式值）。
- COD 的訂單付款方式與實際收款完成狀態分開。
- 冷藏寄放的寄放／到店／取貨狀態與付款狀態分開。
- 通知事件分為 order_created、payment_proof_submitted、payment_confirmed、shipment_dispatched、pickup_arrived、order_collected 等；實際事件名稱須與現有狀態機定稿一致。
- 每個事件需唯一 idempotency key；LINE API 失敗不標記 sent，重試不可重複推播。
- 新單通知不得包含不必要的匯款末五碼、完整地址或其他敏感欄位。

## 7. 備份與回復清單

正式變更前（尚未核准，未執行）：
- 匯出 DB schema、RLS policies、table grants、function definitions、trigger definitions、RPC signatures。
- 依資料保護規則建立可還原資料備份；驗證備份時間、完整性及還原權限。
- 保存每支受影響 Edge Function 的現行 source、部署版本、verify_jwt 設定與依賴清單。
- Secrets 僅保存「名稱／用途／輪替狀態」清單，不將明文 secret 寫入 GitHub 或報告。
- 保存官網目前可回復版本與受影響 caller 清單。
- 記錄變更前通知成功率、錯誤率、訂單建立成功率作基線。

回復原則：
- Function 回復只可回到已知安全且相容的版本；若舊版重新暴露 payload RPC，不能為了回復而重新開放匿名個資讀取。
- 若新 caller 已切換，不可單獨回復 trigger／Function 造成版本不相容；必須按 caller dependency graph 成組回復。
- Secrets 輪替失敗時保留雙 key 過渡窗口；不得先撤銷舊 key。
- RPC 權限變更若需回復，必須先確認舊 Function 不會因權限回復而形成公開資料出口。
- 官網新流程失敗時，使用功能旗標回復舊下單路徑；但不得回復到已確認存在的公開個資漏洞。
- 每次回復後重新執行下列 smoke tests，並檢查通知佇列／事件紀錄。

## 8. 驗收矩陣（免費本機優先）

| ID | 測試 | 通過條件 |
|---|---|---|
| SEC-01 | 無密鑰／錯誤密鑰／過期時間戳／錯誤簽章 | 全部拒絕，無 DB payload 查詢 |
| SEC-02 | 重播相同 event_id／nonce | 不重複推播或更新 |
| SEC-03 | anon／authenticated 執行 payload RPC | permission denied |
| SEC-04 | anon／authenticated 執行通知旗標 RPC | permission denied |
| SEC-05 | 會員讀取其他會員訂單 | 零資料，不洩漏存在性 |
| SEC-06 | 未驗證 guest token 提交付款 | 拒絕 |
| SEC-07 | 偽造 line-customer-notify recipient／門市 | 使用 DB 驗證資料，不採 body 欄位 |
| SEC-08 | 未授權 LINE 使用者要求綁定管理員 | 拒絕並記錄 |
| PAY-01 | proof_submitted 通知 | 顯示待核款，不顯示已付款 |
| PAY-02 | 管理員核款成功 | 僅一次付款確認通知 |
| ORD-01 | 舊官網四種物流建單 | 訂單資料、金額、物流類型正確 |
| ORD-02 | 冷藏寄放不足 2 盒 | 後端拒絕，不建立不完整訂單 |
| ORD-03 | 重複送單／併發送單 | 同一 idempotency key 只建立一張單 |
| LINE-01 | LINE webhook 錯誤 HMAC | 401 |
| LINE-02 | LINE webhook 重送相同事件 | 不重複綁定／通知 |
| OPS-01 | Function／LINE API 暫時失敗 | 事件保留可重試，不標記成功 |
| OPS-02 | 官網回歸 | 商品、排程、下單、付款、後台核心流程可操作 |

Phase 14 的 9 個純函式測試只涵蓋 helper／mock，不等於以上整合驗收已通過。必須補上真實 HMAC 測試與 caller integration tests。

## 9. 變更核准清單（逐項核准，不可概括授權）

正式環境變更需分批提出，每批均附：
- 完整 SQL／Function diff（不含 secret 明文）。
- 受影響 RPC、trigger、Function、官網頁面及 API caller。
- 前置部署順序與相容窗口。
- 備份位置、還原驗證及回復步驟。
- 免費隔離測試結果；如需任何額外費用，先取得同意。
- 使用者對該批「具體變更清單」的明確核准。

使用者說「好／繼續」只代表繼續文件與非正式開發，不代表核准 production 變更。

## 10. 本階段狀態

| 項目 | 狀態 |
|---|---|
| 變更物件與風險盤點 | 已整理成文件 |
| caller 遷移順序 | 已制定 |
| LINE 管理員綁定風險 | 已列為必查 P0 |
| 備份與回復原則 | 已制定 |
| 驗收矩陣 | 已制定 |
| 可直接部署的最終 SQL／Function diff | 尚未產出；caller inventory 仍不完整 |
| 真實 HMAC／Supabase／LINE 整合測試 | 未執行 |
| 正式環境修補 | 未執行，維持唯讀 |

### 下一階段建議
Phase 16：補齊所有通知 Functions、網站與 trigger 的 caller inventory，特別追查 line-order-notify、line-payment-order-notify、line-payment-notify、line-customer-notify 及 test Functions；再產出每一支 Function 的完整 patch diff 與測試 fixtures。正式環境仍維持唯讀。
