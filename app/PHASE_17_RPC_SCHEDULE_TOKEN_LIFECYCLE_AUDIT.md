# Phase 17｜RPC／排程／pg_net／出貨通知 Token 生命週期追查

日期：2026-11-08  
分支：app/phase-1-planning  
方式：Supabase SQL metadata、function definitions、trigger metadata、近 24 小時 unified logs 唯讀查詢。

> 本階段沒有讀取訂單／客戶資料列，沒有讀取 pg_net request body 或 headers，沒有發送 HTTP／LINE 訊息，沒有修改資料庫、Secrets、Function 或官網。

## 1. 本階段結論

1. 目前 public schema 中，會直接呼叫 `net.http_post`／Supabase Function URL 的資料庫函式只有三支：
   - `notify_line_on_new_order()`
   - `notify_line_on_payment_proof()`
   - `notify_line_on_cooling_order_payment()`
2. 這三支對應 Phase 16 已確認的三條 trigger 通知鏈；本輪沒有發現額外 RPC 直接呼叫 LINE 通知 Function。
3. 資料庫中沒有 `cron` schema，因此目前查詢環境未見 pg_cron job catalog；不能據此排除 Supabase Dashboard 外部排程或第三方自動化。
4. `line-customer-notify` 的 shipment token 欄位只有 `orders.shipment_notify_token`，預設值為 24 bytes 隨機資料轉 hex；欄位允許 NULL。資料庫中只找到 `verify_shipment_notify_token(uuid,text)`，未找到專用 mint／rotate／revoke／expiry function。
5. `verify_shipment_notify_token` 是 SECURITY DEFINER，EXECUTE 權限包含 anon、authenticated；只回傳 boolean，驗證條件是訂單 ID 與 token 相符。高熵 token 降低猜測風險，但仍需速率限制、短效／撤銷與最小化暴露。
6. 近 24 小時 Function Edge Logs 中，僅見 line-webhook 18 次、TikTok chat 53 次、TikTok proxy 33 次；未見其他 LINE 通知 Function 呼叫。這是有限時間窗的觀測，不能證明其他時間或外部 caller 不存在。

## 2. RPC／資料庫 HTTP caller inventory

| DB function | 目標 Function | 觸發方式 | 已知驗證 |
|---|---|---|---|
| notify_line_on_new_order() | line-order-send-v2 | orders INSERT trigger | 沒有內部驗證 header |
| notify_line_on_payment_proof() | line-order-payment-send-v2 | orders 更新付款證明欄位 trigger | 固定 header secret |
| notify_line_on_cooling_order_payment() | cooling-order-line-notify | cooling_pickup_orders INSERT／payment_last5 更新 trigger | 固定 header secret |

在 public schema 全部一般函式定義中，以 `net.http_post` 與 `functions/v1/` 字串搜尋，未找到其他通知 Function caller。已確認的資料庫 trigger 中也未發現額外通知端點。

## 3. 排程、Webhook、pg_net

- `cron` schema 不存在；本輪無法從 `cron.job` 讀取排程，且沒有證據顯示此專案使用 pg_cron。
- `information_schema.triggers` 未找到 action statement 包含 http／webhook 的資料庫 trigger。
- `net.http_request_queue` 欄位 metadata 可見，但目前 queue 查詢為空；本階段不讀取 request body／headers，以避免暴露訂單資料或內部密鑰。
- Supabase Dashboard 的 Database Webhooks、Storage event 設定、外部排程服務、第三方自動化，無法單靠上述 SQL catalog 全部排除；仍需在各服務控制台或設定中核對。

## 4. 出貨通知 Token lifecycle

### 現況
- 欄位：`public.orders.shipment_notify_token`。
- 型別：text；允許 NULL。
- 預設值：`encode(gen_random_bytes(24), 'hex')`，即 192-bit 隨機值轉十六進位字串。
- 唯一找到的 token 專用 DB function：`verify_shipment_notify_token(p_order_id uuid, p_token text)`。
- 該函式 SECURITY DEFINER、search_path 固定為 public；ACL 顯示 postgres、anon、authenticated 可 EXECUTE。
- 驗證只檢查 order id 與 token 是否相等，不處理到期時間、使用次數、撤銷狀態或 event replay。

### line-customer-notify Function 的風險
- Function 會驗證 token，但通知收件人 recipient、pickup_type 等顯示資料仍由 request body 提供。
- 因此 token 通過驗證後，不能再信任 request body 中的收件人或訂單顯示欄位。
- 建議 token 驗證成功後，由 service_role 依 order_id 查詢訂單、已綁定 LINE recipient、取貨方式及門市資料；request body 不得決定 LINE 收件人。
- token 應設計有效期限、撤銷／輪替狀態、用途限制、rate limit 及一次性 event ID。若物流重試需要重送，應以事件 ID 冪等，而不是任意重用 token。

### lifecycle 缺口
- 未找到專用 mint／rotate／revoke／expire function。
- default 只在 insert 時提供預設值；欄位可為 NULL，舊訂單可能沒有 token。
- 尚未確認 create_customer_order 是否明確覆寫欄位、訂單是否會在出貨通知後輪替 token、取消訂單是否撤銷 token。
- 未找到已確認的通知端點 caller；尚未從資料庫、外部物流商、排程服務完整追到觸發來源。

## 5. 周邊商品付款通知 caller

- `line-payment-notify` 與 `merch-payment-sync` 的 source 都會依 `merch_orders` 的 order_id 查詢付款狀態與商品明細並推播。
- 本輪 public DB function definitions、trigger definitions 未找到它們的直接呼叫者。
- 近 24 小時 Function Edge Logs 未見兩個 endpoint 的呼叫紀錄。
- 目前不能確認它們是無人使用、由 Dashboard 外部設定呼叫，或僅在較早時段呼叫；不得直接停用。
- 下一步應檢查 Storage upload events、周邊商品付款證明上傳流程、Dashboard Webhook／外部自動化及更長期可取得的部署／呼叫紀錄。

## 6. 近 24 小時 Edge Function logs（有限觀測）

| Endpoint | 請求數 | 狀態 | 觀測時間（UTC） |
|---|---:|---|---|
| line-webhook | 18 | 200 | 2026-11-07 04:56 至 11:26 |
| tiktok-live-chat | 53 | 101 | 2026-11-07 00:49 至 16:58 |
| tiktok-live-proxy | 33 | 200 | 2026-11-07 00:49 至 16:58 |
| 其他已盤點 LINE 通知端點 | 0 筆可見 | — | 本次查詢視窗 |

注意：Function Edge Logs 是請求層紀錄，不代表所有呼叫來源都會保留在這個視窗；無紀錄不能當成無 caller 的證明。

## 7. 修補方案建議（尚未套用）

### P0-A｜LINE 管理員綁定
沿用 Phase 16：撤除公開固定文字綁定；改由 super_admin 產生一次性邀請碼，短效、限次、單次使用；保存 audit log。

### P0-B｜新訂單通知 Function
讓 DB trigger 使用可靠內部事件簽章／短效共享密鑰或安全佇列；驗證 event timestamp、event ID、來源與訂單 ID；加入冪等處理。密鑰放 Supabase Secrets／受控 Vault，不得硬編碼在 SQL 或 Function source。

### P1-A｜出貨通知
- token 驗證後只由 DB 讀取 recipient 與通知欄位。
- 建立 shipment notification event table 或等價冪等記錄。
- 對 token 增加 expires_at、revoked_at、用途及使用狀態。
- 舊訂單 token NULL 時採受控補發，不回傳 token 明文給公開 client。
- 驗證 Function 應移至非 exposed schema 或限制 EXECUTE 給可信角色；若仍需由匿名物流 callback 使用，應改由 Edge Function 以 service_role 內部查詢，避免公開 RPC。

### P1-B｜周邊商品付款通知
- 查清唯一正式 caller 前不合併、不停用。
- 將通知條件與核款狀態分離：proof_submitted 是待核款，不等於 confirmed／已付款。
- 以 DB 原子 claim／event ID 避免兩支 Function 同時通知。
- 驗證付款截圖 Storage bucket 的 upload policy 與事件來源。

## 8. 未完成事項

- Supabase Dashboard 的 Database Webhooks、Storage event、Secrets/Vault 依賴及外部自動化尚未完整盤點。
- 未追到 shipment_notify_token 實際產生／撤銷／輪替的完整應用程式流程。
- 未追到 line-customer-notify 真正 caller 與物流供應商 callback。
- 未追到周邊商品付款通知兩支 Function 的外部 caller。
- 尚未產生最終逐支可套用 patch diff。
- 未執行真實通知、LINE sandbox、物流 callback、RLS integration 或併發重試測試。

## 9. 本階段狀態

| 項目 | 狀態 |
|---|---|
| public RPC HTTP caller inventory | 已唯讀盤點 |
| DB triggers／HTTP endpoint | 已確認三條 |
| pg_cron schema/job | 未見 cron schema |
| DB Webhook trigger | 未見 |
| pg_net request queue | 查詢時為空 |
| shipment token 欄位與 verify RPC | 已確認 |
| token mint／rotate／revoke／expiry lifecycle | 未找到完整流程 |
| 近 24 小時 Edge Function 呼叫觀測 | 已查詢，只有三個 endpoint 有請求 |
| Dashboard／外部自動化 caller | 未完成 |
| 正式環境變更 | 未執行，維持唯讀 |

### 下一階段
Phase 18：追查 Storage bucket／付款證明上傳流程、Dashboard Webhook 與外部物流 callback 的可見設定；比對 create_customer_order／物流相關 RPC 是否產生或輪替 token；補上出貨通知事件與冪等設計。完成後才整理逐支 patch diff，正式環境仍維持唯讀。
