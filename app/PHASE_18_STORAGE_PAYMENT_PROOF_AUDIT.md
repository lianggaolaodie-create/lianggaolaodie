# Phase 18｜Storage／付款證明上傳／周邊商品通知來源稽核

日期：2026-11-08  
分支：app/phase-1-planning  
方式：Supabase bucket metadata、Storage RLS policies、資料表 metadata、RPC definitions、Edge Function source、GitHub branch code search；全部唯讀。

> 本階段沒有讀取任何訂單、客戶或付款證明檔案內容；只查詢 Storage bucket 與 policy metadata、物件數量統計、程式碼與 Function source。沒有上傳／下載／刪除檔案、沒有呼叫 LINE、沒有修改正式環境。

## 1. 主要發現

### P0｜匿名付款證明上傳政策缺乏訂單綁定
- `transfer-proofs` bucket 是 private。
- Storage policy `customer_upload_transfer_proof` 允許 `anon` 與 `authenticated` INSERT，只檢查 bucket_id 是 `transfer-proofs` 且物件名稱符合 `proof/%`。
- policy 沒有檢查 order_id、訂單所有權、一次性上傳授權、token 或檔案內容。
- bucket 的 `file_size_limit` 與 `allowed_mime_types` 都是 NULL（未設定 bucket 層限制）。
- 本輪查詢時 `storage.objects` 沒有任何 `transfer-proofs` 物件。
- 風險：任何匿名使用者都可能在該 prefix 上傳任意檔案，造成儲存濫用／成本風險；即使 bucket private，仍不能因此視為上傳授權安全。

**修補方向（未套用）**：改由後端先驗證訂單短效授權，再簽發限時 upload URL 或透過受控 Edge Function 上傳；路徑由伺服器生成並綁定單一訂單；限制 MIME、檔案大小、副檔名與上傳次數；不得只靠使用者提供的 path。需保留 guest checkout，不強迫客戶註冊會員。

## 2. Storage bucket inventory

| Bucket | Public | Size limit | MIME allowlist | 查詢時物件數 |
|---|---:|---:|---|---:|
| transfer-proofs | 否 | 未設定 | 未設定 | 0 |
| product-images | 是 | 未設定 | 未設定 | 57 |
| merch-images | 是 | 未設定 | 未設定 | 7 |
| merchandise-images | 是 | 未設定 | 未設定 | 0 |
| site-images | 是 | 未設定 | 未設定 | 31 |

注意：public bucket 代表知道／取得物件 URL 的人可讀取；適合公開商品與網站圖片，不適合付款截圖、客戶個資或其他私人附件。三個商品／網站圖片 bucket 的 MIME／大小限制目前也沒有 bucket 層設定，雖然部分前端有 8MB 檢查，前端檢查可被繞過。

## 3. Storage RLS policy inventory

### transfer-proofs
| Policy | Role | Action | 條件 |
|---|---|---|---|
| admins_read_transfer_proof | authenticated | SELECT | bucket_id=transfer-proofs 且 is_admin() |
| customer_upload_transfer_proof | anon, authenticated | INSERT | bucket_id=transfer-proofs 且 name 以 proof/ 開頭 |

未見客戶 SELECT、UPDATE、DELETE policy。private bucket 的讀取由管理員政策控制，這點比公開付款證明正確；但匿名 INSERT 條件過寬。

### 商品／網站圖片
- product-images：公開 SELECT；管理員 INSERT／UPDATE／DELETE。
- merch-images：公開 SELECT；僅 super_admin 或 can_manage_products 管理員可 INSERT／UPDATE／DELETE。
- merchandise-images：公開 SELECT；管理員寫入政策使用 super_admin 或 can_manage_products。
- site-images：公開 SELECT；super_admin/admin 可 INSERT／UPDATE／DELETE。

目前未建議直接收緊商品圖片政策，因官網與管理後台正依賴公開讀取及管理員上傳。任何修改需先保留舊圖 URL、確認所有頁面與後台使用哪個 bucket。

## 4. 付款證明流程與程式碼 caller

### 涼糕訂單
- `orders.transfer_proof_path` 欄位存在。
- `submit_customer_payment(uuid,text,text)` 會將 payment_status 設為 `proof_submitted`，並寫入 transfer_last5 與 transfer_proof_path。
- 該 RPC 只檢查末五碼格式、path 是否有值、order_id 是否存在；沒有看到它驗證上傳檔案真的存在於 private bucket、檔案屬於該訂單或短效上傳授權。
- 目前檢查的官網頁面 `convenience-order.html`／`convenience-order-v2.html` 只要求填寫匯款末五碼，建立訂單時呼叫冷藏寄放訂單 RPC；沒有付款證明圖片上傳程式。
- `home-delivery-order.html` 顯示貨到付款，不走付款證明上傳。
- `radish-order.html` 建立蘿蔔糕訂單並顯示匯款資訊；本次檢查未找到付款證明上傳程式。
- 對本分支檢查的主要客戶下單頁，未找到 `transfer-proofs` 或 `submit_customer_payment` 呼叫。不能排除其他未列入的頁面、舊版、第三方工具或尚未部署的程式。

### 周邊商品訂單
- `merch_orders.payment_proof_url` 欄位存在。
- 目前檢查的 `merch.html` 未找到付款證明上傳程式。
- `merch-admin.html` 與 `merch-admin-v2.html` 有商品圖片上傳，不是付款證明上傳；分別使用 product-images／merch-images。
- GitHub branch code search 只找到 `merch-admin.html` 對 payment_proof_url 的個資清除更新；沒有找到周邊商品付款證明上傳端點的客戶端 caller。
- 因此目前尚未確認周邊商品付款證明的實際上傳來源；不可因未在這些頁面找到就判定欄位或通知 Function 可停用。

## 5. 周邊商品付款通知 Function

| Function | 版本／狀態 | JWT | 本輪 caller 結果 |
|---|---|---|---|
| line-payment-notify | v4 ACTIVE | verify_jwt=false | DB trigger／已查頁面未找到；近 24h log 無請求 |
| merch-payment-sync | v3 ACTIVE | verify_jwt=false | DB trigger／已查頁面未找到；近 24h log 無請求 |

兩支 Function 都會：
1. 接受 request body 的 order_id。
2. 以 service role 查詢 `merch_orders`、`merch_order_items` 與管理員 LINE recipient。
3. 當 payment_status 為 `proof_submitted` 時推播付款證明通知。
4. 將通知旗標設為 true（其中一支會檢查旗標，另一支也有重複送出風險）。

風險：
- `verify_jwt=false` 且 source 未見 request secret／HMAC／JWT 驗證，外部可透過猜到／取得的 order_id 觸發管理員通知。
- `proof_submitted` 代表客戶已提交匯款資訊或付款證明，不代表店家已核帳；Function message 中使用「付款完成」文字，語意不正確。
- 兩支 Function 功能重疊；尚未確認是否有 Dashboard／外部系統 caller，不能直接停用或合併。

**修補方向（未套用）**：先確定唯一正式 caller；採用內部簽章事件或只允許受控 service-to-service 呼叫；使用資料庫原子 event claim／idempotency key；訊息改成「收到付款資料，待店家核對」，真正核款成功才發送「已確認入帳」。

## 6. 本輪確認的其他安全／流程問題

- 涼糕新訂單付款通知 Function 的程式仍將新訂單通知內容標示為「已付款」，但其條件是匯款末五碼已存在；末五碼不是銀行入帳證明。
- 冷藏寄放付款通知 Function 也以 payment_last5 作為通知觸發資料，且訊息標示「已付款」。應統一使用狀態機：unpaid → proof_submitted → confirmed／rejected。
- shipment 通知 Function 已在 Phase 17 確認：token 驗證成功後仍信任 request body 的 recipient／order display fields，應改成由 DB 讀取。
- 本階段沒有檢查任何實際付款證明圖片或個資內容。

## 7. 後續修補順序建議

1. **P0**：先修 transfer-proofs 匿名 INSERT：後端授權、訂單綁定、限時上傳、大小／MIME 限制；保留訪客下單。
2. **P0**：周邊商品通知 Function 加內部認證、冪等、統一核款語意；先找外部 caller，不停用現有端點。
3. **P1**：核對所有付款證明上傳來源與 Storage policy；檢查 private bucket 下載方式是否為管理員登入後取得短效 signed URL。
4. **P1**：建立上傳後驗證流程（檔案存在、MIME、size、訂單綁定、重複上傳策略）。
5. **P1**：統一付款狀態訊息；末五碼／證明上傳只代表 proof_submitted，不代表已付款。
6. **P2**：公開圖片 bucket 設定合理檔案大小與 MIME allowlist；先盤點舊檔案格式與官網上傳流程。

## 8. 未完成／限制

- 尚未查閱 Supabase Dashboard 的 Storage Webhook、外部排程、第三方付款／物流服務設定。
- 尚未確認周邊商品付款證明 URL 的實際上傳端點。
- 本輪未檢查 Storage signed URL 的實際生成 caller 或已發行 URL 有效期。
- 未執行 upload integration、檔案大小／MIME 測試、匿名權限測試、管理員讀取測試。
- 沒有部署或套用任何修補。

## 9. 本階段狀態

| 項目 | 狀態 |
|---|---|
| Storage bucket inventory | 已唯讀盤點 |
| Storage RLS policies | 已唯讀盤點 |
| transfer-proofs bucket | private；匿名 INSERT policy 過寬 |
| 付款證明物件統計 | transfer-proofs 查詢時 0 筆 |
| 涼糕付款證明上傳 caller | 已檢查主要官網頁面，未找到 |
| 周邊商品付款證明上傳 caller | 未找到，待查外部來源 |
| 周邊商品通知 Function caller | 未找到已知 DB／頁面 caller；外部 caller 未排除 |
| 正式環境變更 | 未執行 |

### 下一階段
Phase 19：整理付款／通知／出貨安全修補的精確 patch diff 與測試矩陣；先把 caller 未知項目列為上線阻擋條件。任何正式環境變更仍需逐項列出 SQL／Function／Storage policy、影響流程、備份與回滾方式，並取得對該份變更清單的明確核准。
