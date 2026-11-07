# 老爹．涼糕整合專案｜第二輪唯讀安全與營運流程盤點

日期：2026-11-08  
分支：`app/phase-1-planning`  
範圍：顧客 App、官方網站、會員、涼糕／蘿蔔糕訂單、老闆後台、付款、物流、Storage、Edge Functions。  
排除：員工帳號／員工流程／PDA／掃碼出貨，本階段暫緩。  
執行限制：本次僅讀取 GitHub 與 Supabase 結構／函式／政策；未執行 DDL、DML、migration、RLS 修改、Edge Function 部署或正式網站切換。

## 1. 本輪已核對的來源

GitHub 開發分支：
- `admin-orders-fixed-v3.html`
- `admin-radish-orders.html`
- `products.html`
- `radish-order.html`
- `admin-dashboard.html`
- `app/customer-flow-preview-v2.html`
- `app/ONE_TIME_FULL_SYSTEM_SETUP_BLUEPRINT.md`

Supabase 唯讀：
- `create_customer_order`
- `create_cooling_pickup_order`
- `create_radish_delivery_order` 的五參數及六參數 overload
- Storage buckets 與 storage.objects policies
- Edge Functions 清單及部分 LINE／管理函式原始碼
- Security Advisor

## 2. 最高優先級問題

### 2.1 涼糕超商冷藏寄放 RPC 的費率與明細信任問題

已確認 `create_cooling_pickup_order`：
- 接受前端傳入 `p_storage_fee`，以該值計算總額，未在函式內從 `pickup_settings` 讀取當前啟用費率並比對。
- 訂單明細插入時直接使用 JSON 的 `flavor_name`、`unit_price`、`product_name`；雖然前段有依 flavor_id 查詢資料庫價格計算商品小計，但快照欄位仍採用前端值，可能造成金額與明細內容不一致。
- 地區名稱僅檢查非空，尚未確認該日期是否在 `daily_order_regions` 開放。
- 重複 flavor_id 的品項可能分開檢查同一庫存快照，需測試彙總後再扣庫存的併發／超賣風險。
- `cooling_pickup_orders` 與 `cooling_pickup_order_items` 既有公開 INSERT policies 仍需確認是否能繞過 RPC 直接寫入。

建議修正方向（尚未執行）：
1. 後端依 `pickup_settings` 的啟用狀態及費率計算寄放費，拒絕前端任意改價。
2. 明細名稱與單價一律使用資料庫查核結果，不採信 JSON 傳入快照。
3. 驗證配送地區、超商類型、門市資料、訂購日期及開單狀態。
4. 先將同一 flavor_id 數量彙總，再以交易安全方式鎖定／扣減庫存。
5. 評估撤除直接公開 INSERT，改由受控 RPC 建單；需先驗證舊官網相容性。

### 2.2 涼糕送到府 RPC

已確認 `create_customer_order`：
- 會檢查日期開單、地區開放、取貨類型、姓名電話、品項、資料庫價格與庫存，並由 DB 計算商品總額。
- 送到府目前設定運費為 0；地區有啟用檢查，但尚未看到地址配送範圍／時段的實際驗證。
- 超商冷藏寄放費率從 `pickup_settings` 讀取，與另一支寄放 RPC 的前端費率信任方式不一致，應統一。
- 訂單使用 `auth.uid()` 寫入 `orders.customer_user_id`，訪客為 null；不應以姓名或電話自動綁定歷史訪客單。
- 地址同時寫入 `order_private.delivery_address`，並將同一值放入 `pickup_store` 欄位；欄位語意需在未來 API 契約中釐清，避免顧客端與後台誤判。
- 每個品項逐筆檢查與扣減庫存；相同 flavor_id 重複出現時需測試總量與競態。

建議：保留既有訪客購物能力，但以單一安全查詢端點讓登入會員只讀取本人訂單及明細；配送地址欄位語意需向前相容整理。

### 2.3 蘿蔔糕 RPC overload 與開單開關

已確認同名兩個函式：
- 五參數舊版 `create_radish_delivery_order(text,text,text,text,jsonb)`：固定宅配運費 250。
- 六參數新版 `create_radish_delivery_order(text,text,text,text,jsonb,text)`：依配送方式使用硬編碼運費（既有盤點曾讀到全家冷凍 99、7-ELEVEN 129、宅配 250，仍需以本輪完整函式內容與正式合約複核）。

兩個 overload 均需在函式內檢查蘿蔔糕訂購開關，不能只靠前端隱藏送單按鈕。舊版仍可被舊客戶端呼叫，可能繞過新配送方式選擇與費率設定。

建議：
1. 先盤點舊官網所有呼叫端與實際歷史訂單欄位。
2. 由後端統一讀取蘿蔔糕開單設定及物流費率設定。
3. 保留相容期，確認沒有舊客戶端依賴後才撤除舊 overload。
4. 不把涼糕最低 2 盒規則套用至蘿蔔糕。

## 3. 會員訂單讀取缺口

既有盤點已確認：
- `orders` 有會員本人讀取 policy（以 `customer_user_id=auth.uid()`）。
- `order_items` SELECT policy 目前以管理員為主，會員 App 無法直接安全讀取本人商品明細。
- `order_private` 透過所屬訂單 UID 判斷本人或個資管理員。
- 蘿蔔糕 `radish_orders`、`radish_order_items` 目前 SELECT policy 僅管理員。

建議以受控 RPC 或明確的本人 RLS policy 提供顧客查詢。需一併驗證 UUID／訂單號猜測、未登入訪客訂單查詢、歷史訪客訂單認領、電話驗證與個資遮罩；不可只憑訂單編號公開回傳姓名、電話、地址或明細。

## 4. Storage 與匯款憑證

目前 buckets：
- `transfer-proofs`：private。
- `product-images`、`merch-images`、`merchandise-images`、`site-images`：public。

已讀取到 `transfer-proofs` policies：
- 管理員 SELECT：限定 `is_admin()`。
- 匿名／登入者 INSERT：限定 bucket 且物件名稱符合 `proof/%`。
- Bucket 尚未設定檔案大小上限及 MIME allowlist（資料欄位為 null）。

風險與待確認：
- `proof/%` 路徑規則較寬，需確認是否能限制訂單識別、隨機不可猜測路徑、重複覆寫及上傳頻率。
- 未設定 MIME／大小限制，可能造成儲存濫用或非預期檔案上傳。
- 需確認上傳後如何安全綁定訂單、由管理員讀取及保留／刪除政策。
- 公開商品圖片 bucket 的讀取為公開用途；寫入仍應限授權管理員。

建議先設計安全規則與舊憑證遷移策略，不能直接收緊現有 policies，避免正在使用的匯款上傳流程中斷。

## 5. Edge Functions 與 LINE 整合

已確認專案存在多個 Active Edge Functions，包含 LINE webhook、LINE 訂單通知、付款通知、顧客通知、管理員管理及周邊商品付款同步等。

本輪抽查觀察：
- 多個 LINE 通知函式設定為 `verify_jwt=false`；這不必然代表漏洞，但每支都必須在函式內驗證 LINE webhook 簽章、一次性通知 token、管理端密鑰或其他明確授權。
- `line-customer-notify` 會呼叫 `verify_shipment_notify_token` 驗證通知 token，屬於有後端驗證的正面設計；仍需檢查 token 有效期限、一次性使用與訂單／收件人綁定。
- `line-order-notify` 使用自訂請求標頭密鑰；需確認密鑰輪替、保存方式、呼叫端限制及失敗重試。不可將此類密鑰放入 App 或瀏覽器。
- `line-payment-order-notify` 會以 service role 讀取付款通知 payload 並推播，需確認呼叫端授權、重複通知控制及付款狀態轉移是否由可信後端完成。
- `admin-manage` 有驗證 Bearer token、讀取使用者及檢查 enabled super_admin 的流程，為管理端授權的正面案例。

待完成：逐支完整檢查其餘 Edge Function、webhook 簽章、Secrets 使用、CORS、速率限制、重播攻擊、冪等與錯誤回傳。不得在此盤點文件記錄任何真實密鑰或 token。

## 6. Security Advisor

本輪讀取到的 Security Advisor 包含：
- 4 張 LINE 相關表 RLS enabled 但沒有 policy（可能是刻意封鎖，需結合實際服務端存取方式確認）。
- 11 個函式被標記為 search_path mutable，需逐一確認是否 SECURITY DEFINER 及是否可能被不可信 schema 物件影響。
- 另有多個 SECURITY DEFINER RPC 對 anon 可執行的警告；需逐一檢查函式內授權與資料輸出，不可只因 Advisor 警告就一律撤權，以免訪客下單或 LINE webhook 中斷。
- 既有盤點另記錄 `public.merch_backend_sync` RLS disabled；需先確認有效 grants、API 暴露及外部同步依賴，不可直接開啟 RLS。

## 7. 官網／管理後台現況觀察

- `products.html` 從 `flavors` 讀取 enabled 口味，圖片欄位依序使用 `image_url`、`photo_url`、`image`，產品介紹頁資料來源與顧客 App 正式資料契約需統一。
- `admin-orders-fixed-v3.html` 已包含涼糕訂單、超商寄放、送到府、個資與每日開放設定等管理介面；需逐段核對付款狀態更新與訂單狀態更新的後端授權，不可只依前端登入後隱藏按鈕判斷安全。
- `admin-radish-orders.html` 有蘿蔔糕訂單獨立管理及開單開關介面，並與 `site_admin_content` 的蘿蔔糕設定互動；需確保後端 RPC 也遵守同一開關。
- `radish-order.html` 仍有運費設定硬編碼的歷史問題，正式運費必須由可信設定來源提供。
- App v2 仍是示意原型，不能視為已串接正式會員、訂單、付款或推播。

## 8. 下一階段工作

1. 完成兩支涼糕訂單管理後台完整程式的付款／狀態更新呼叫盤點。
2. 完成蘿蔔糕前台與管理後台所有 RPC、物流欄位與費率來源比對。
3. 逐支檢查 Edge Functions 與資料庫通知 RPC 的授權。
4. 完成會員 profile、本人訂單與本人明細 API 契約。
5. 完成 Storage 上傳流程及既有匯款憑證相容設計。
6. 完成訂單狀態機、付款狀態機、物流狀態機與冪等規格。
7. 產出正式 migration 草案及回復方案，但不套用正式環境。

## 9. 執行狀態

- [x] 開發分支文件／原型確認。
- [x] 涼糕兩支建單 RPC 本輪讀取。
- [x] 蘿蔔糕新舊 overload 確認存在。
- [x] Storage bucket 與 policies 唯讀盤點。
- [x] Edge Functions 清單與部分函式抽查。
- [x] Security Advisor 唯讀檢查。
- [ ] 全部付款狀態更新流程驗證。
- [ ] 全部 Edge Functions 完整安全審查。
- [ ] 完整資料模型、API 契約與測試案例。
- [ ] 正式環境變更清單與使用者逐項核准。

**重要：本文件是開發分支的盤點結果，不代表已修正、部署或正式上線。**
