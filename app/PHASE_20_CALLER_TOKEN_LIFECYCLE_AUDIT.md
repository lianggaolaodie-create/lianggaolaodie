# Phase 20｜未知 Caller／pg_net／排程／付款欄位與出貨 Token 生命週期稽核

日期：2026-11-08  
分支：app/phase-1-planning  
方式：Supabase PostgreSQL metadata／function definitions／pg_net queue and response metadata／Edge Function source and 24-hour aggregate logs／GitHub code search。全程唯讀。

> 本階段未讀取客戶訂單列、付款證明檔案或付款截圖；未呼叫 LINE、未送出通知、未呼叫任何通知 Function endpoint，未執行 DDL／DML／部署／Secrets 修改。資料庫 function source 中若含任何內部密鑰，報告不重述其值。

## 1. 執行摘要

本階段有四項重要結果：

1. **未發現 pg_cron 或可見 Database Webhook trigger**：目前資料庫未安裝 pg_cron；cron.job、cron.job_run_details、supabase_functions.hooks、storage.webhooks 等 relation 不存在；trigger metadata 未發現 webhook/http 相關 trigger。
2. **目前可見 pg_net caller 仍是三條已知通知 trigger**：orders 新單、orders 付款資料、cooling_pickup_orders 付款資料。pg_net request queue 查詢時為空；最近 30 日 response metadata 僅有 1 筆 HTTP 200（2026-10-19），不能據此排除 Dashboard、外部排程或歷史 caller。
3. **出貨通知 token 設計有新確認的風險**：token 預設由 24 bytes 隨機數產生（高熵），但以明文存放於 orders；驗證 RPC 是 SECURITY DEFINER，anon／authenticated 可執行；沒有 expires_at／consumed_at／nonce 等生命週期欄位；目前唯一找到的 Function caller 使用 request body 提供的 LINE recipient、訂單編號與門市資料。
4. **周邊商品付款證明仍無法找到實際寫入端點**：已查到 payment_proof_url 欄位與 Function 讀取／後台清除個資時清空欄位，但沒有找到客戶端付款證明上傳流程、DB function writer 或相關 trigger。

## 2. pg_cron／Database Webhook／pg_net 盤點

### 2.1 Extension 與 catalog
- 已安裝：pg_net 0.20.4、supabase_vault 0.3.1。
- 未安裝：pg_cron（本次 pg_extension 清單未出現）。
- `cron.job`、`cron.job_run_details` relation 不存在。
- `supabase_functions.hooks`、`supabase_functions.migrations`、`storage.webhooks` relation 不存在。
- 本次查詢的非內部 trigger 中，未找到 trigger definition 含 webhook 或 http 的項目。

**解讀限制**：這只表示本資料庫可查到的 pg_cron／trigger 型自動化未出現；Supabase Dashboard 的外部整合、第三方自動化、其他專案、GitHub Actions、外部 server cron 或手動 API caller 不會完整反映在這些 catalog。

### 2.2 pg_net 呼叫者
目前在 PostgreSQL function definitions 中找到呼叫 `net.http_post` 的業務 trigger function：
- `notify_line_on_new_order()` → `line-order-send-v2`
- `notify_line_on_payment_proof()` → `line-order-payment-send-v2`
- `notify_line_on_cooling_order_payment()` → `cooling-order-line-notify`

沒有在本次資料庫 function definition 中找到周邊商品 `line-payment-notify` 或 `merch-payment-sync` 的 pg_net caller。

### 2.3 pg_net queue／response metadata
- 查詢時 `net.http_request_queue` pending queue 為 0 筆。
- 最近 30 日 `net._http_response` 聚合結果為 1 筆 HTTP 200，時間為 2026-10-19。
- 沒有讀取 queue headers、request body 或 response content；只查 endpoint metadata 與狀態統計。

這不能證明所有通知 Function 沒有使用者或外部 caller，只能說目前可見 DB pg_net queue 沒有待處理請求，response history 非常有限。

## 3. 周邊商品付款證明欄位／writer

### 3.1 欄位
`merch_orders` 存在：
- `payment_status`，預設 unpaid。
- `payment_proof_url`，可為 NULL。
- `payment_notification_sent`，預設 false。
- `order_number`。

### 3.2 寫入來源追查
- 在本次 public schema function definition 搜尋中，沒有找到寫入 `merch_orders.payment_proof_url` 的 RPC／DB function。
- `merch_orders` 本次 trigger inventory 未發現付款證明相關 trigger。
- GitHub code search 對 `payment_proof_url` 找到的可見後台程式片段，是個資刪除時將該欄位設為 NULL；商品圖片 upload 使用 product-images bucket，與付款證明無關。
- 已檢查的 `line-payment-notify`、`merch-payment-sync` Function 會讀取 payment_proof_url 作通知資料，但不負責上傳。
- 目前仍未找到 customer checkout 的付款證明 upload caller，也不能確認該欄位是否由手動後台、外部表單、未列入 GitHub 的前端或其他部署版本寫入。

### 3.3 判斷
`payment_proof_url` 目前只能確認為資料欄位與通知讀取來源，不能確認為一條已完成且可驗收的客戶付款證明上傳流程。正式修補前須找到真正的寫入端點；不可直接改欄位、刪除 Function 或改 Storage policy。

## 4. 出貨通知 token 生命週期

### 4.1 資料庫現況
- `orders.shipment_notify_token` 為 nullable text。
- 欄位 default 使用 `gen_random_bytes(24)` 後轉 hex，約 192-bit 隨機熵；隨機性本身良好。
- 本次在 public function definitions 搜尋 token 使用處，只找到 `verify_shipment_notify_token(uuid,text)`。
- RPC 是 SECURITY DEFINER、固定 search_path=public；EXECUTE ACL 允許 anon 與 authenticated，未授予 service_role（本次角色權限檢查結果）。
- 函式邏輯只檢查 orders.id 與明文 token 是否相符，回傳 boolean。
- orders 欄位／相關 metadata 未看到 expires_at、consumed_at、token_hash、token_version 或 revoked_at 等生命週期欄位。

### 4.2 Edge Function source 現況
`line-customer-notify` v5、ACTIVE、verify_jwt=false：
1. 接受 request body 的 order_id、notify_token 與 recipient。
2. 以 publishable／anon client 呼叫 `verify_shipment_notify_token`。
3. token 成功後，仍以 request body 的 recipient、order_number、pickup_type、pickup_store 組成 LINE 訊息並推播。
4. 未看到 Function 從資料庫取得 LINE recipient 或訂單顯示欄位。
5. 未看到通知成功後將 token 標記 consumed，也未看到到期時間或 event_id 冪等處理。

### 4.3 風險評估
- 24-byte 隨機 token 不易猜測，但明文儲存與一般角色可執行的 SECURITY DEFINER 驗證 RPC 增加不必要的暴露面。
- token 沒有過期／撤銷／消耗狀態，若被複製或外洩，可能在後續時間再次呼叫。
- 驗證的是 token 與訂單的關聯，但通知收件人與顯示內容由 request body 決定；攻擊者若取得有效 token，可嘗試將訊息推送到自選 LINE recipient，或偽造訂單號／取貨門市文字。
- 沒有 caller 找到 token 的產生、傳遞、更新、撤銷與重試流程；目前不應直接改 token schema 或收緊 RPC grants。

### 4.4 修補方向（未套用）
- 先確認 shipment token 產生與送出 Function 的實際 caller。
- 改為 token hash 儲存；原始 token 僅在需要時交付一次。
- 綁定 order_id、event_type、expires_at、nonce／event_id；以短效、單事件授權為原則。
- 驗證與消耗應原子化，防止併發重播；失敗重試使用同一 idempotency key，不重新開放已消耗 token。
- token 驗證後由後端 DB 讀取 LINE recipient、訂單號、物流方式、門市及目前出貨狀態；拒絕或忽略 body 中任何同類欄位。
- 未綁定 LINE 的訂單只能回傳 skipped，不接受 body 提供 recipient。
- 對 `verify_shipment_notify_token` 收斂一般角色 EXECUTE，僅在 caller 遷移與整合測試通過後執行。

## 5. 24 小時 Edge Function log aggregate

本次查詢最近 24 小時的 function_edge_logs，只聚合指定八支通知 Function 的 pathname、HTTP method、status、request count 與 latest timestamp；沒有查詢 body、headers、IP 或客戶資料。

結果：指定的 line-customer-notify、line-payment-notify、merch-payment-sync、line-order-notify、line-payment-order-notify、line-order-send-v2、line-order-payment-send-v2、cooling-order-line-notify 均未出現在本次 24 小時 aggregate 結果中。

**限制**：無日誌不代表 Function 沒有外部 caller；可能是查詢期間未呼叫、日誌保留／取樣限制、caller 位於其他環境，或使用其他入口。不可依此停用任何 Function。

## 6. GitHub／官網 caller 搜尋限制

- 已在 GitHub 可搜尋程式碼中查找 shipment_notify_token、line-customer-notify、transfer-proofs、payment_proof_url、line-payment-notify、merch-payment-sync 等字串。
- 可見搜尋結果對周邊商品付款證明只有後台個資清除欄位；商品圖片上傳是另一個流程。
- GitHub code search 目前回傳的是預設分支索引，不保證完整涵蓋 `app/phase-1-planning` 分支、未提交本機程式、正式部署舊檔或外部系統。
- 因此 caller inventory 仍未完整，不能把「搜尋不到」當作「不存在」。

## 7. Phase 20 結論與優先級

| 項目 | 結果 | 優先級 |
|---|---|---|
| pg_cron | 未安裝／cron catalog 不存在 | P2（記錄現況） |
| DB webhook trigger | 未找到可見 webhook/http trigger | P2（外部 Dashboard 仍待確認） |
| pg_net callers | 找到 3 條既有 LINE trigger caller | 已盤點 |
| pg_net queue | 查詢時 0 pending | 觀察資訊 |
| 周邊商品付款證明 writer | 未找到 | P0 上線阻擋 |
| 周邊商品通知 Function caller | DB pg_net／已檢查頁面未找到，外部 caller 未排除 | P0 上線阻擋 |
| 出貨 token lifecycle | 明文、無 expiry／consumed、驗證 RPC 可由 anon/authenticated 執行 | P1/P0 需修補 |
| 出貨通知 body trust | recipient／訂單號／物流與門市由 body 提供 | P0 需修補 |
| 正式環境變更 | 未執行 | 維持唯讀 |

## 8. 下一步

Phase 21：
1. 針對 `line-customer-notify` 建立 token lifecycle 的相容遷移設計，先確認 shipment token 發出端與所有出貨狀態 caller。
2. 逐頁檢查 active branch 的周邊商品結帳與後台完整程式，釐清 `payment_proof_url` 是否有未被搜尋索引涵蓋的寫入端點。
3. 取得 Dashboard／第三方自動化 caller 清單（需由專案管理者查看控制台；目前 DB metadata 無法證明外部 caller 不存在）。
4. 對未知 caller 保持保留，不刪除 Function、不撤銷 RPC、不修改 Storage policy。

本階段未做任何正式環境寫入、Function 部署、LINE 推播或客戶資料存取。
