# Phase 7 — LINE Functions 實際原始碼複核與安全修正執行規格

日期：2026-11-08
範圍：唯讀檢查 Supabase Active Edge Functions；本文件不代表已部署修正。

## 1. 本輪實際檢查結果

從 Supabase 專案讀取 Active Function source，確認以下問題：

| Function | 實際檢查發現 | 必須完成的修正 |
|---|---|---|
| line-payment-notify | verify_jwt=false；以 order_id 呼叫；service role 讀周邊訂單及付款資料；未見呼叫者驗證 | 加入內部簽章／短效 token；訂單付款狀態與通知冪等鎖 |
| line-customer-notify | verify_jwt=false；token 驗證後仍接受 request body 的 recipient、訂單編號、門市 | recipient 與訊息資料改由 DB 及 token 綁定訂單查出；body 不得指定收件人 |
| line-order-notify | verify_jwt=false；固定驗證密鑰寫在原始碼；使用 service role 讀取訂單及個資 | 移除硬編碼密鑰；Function Secret 驗證；輪替舊密鑰；冪等通知 |
| line-payment-order-notify | verify_jwt=false；使用 service role 呼叫個資 payload RPC；只靠 order_id | 內部授權；只在有效付款證明事件下通知；使用冪等通知流程 |
| line-order-payment-send-v2 | verify_jwt=false；固定驗證密鑰寫在原始碼；使用 payload RPC | 移除硬編碼密鑰並輪替；內部授權；確認付款證明狀態 |
| line-order-send-v2 | verify_jwt=false；使用 service role 呼叫 payload RPC；以 line_notified_at 判斷是否重複 | 限制可信呼叫來源；保留通知失敗重試；以資料庫原子鎖防併發 |
| cooling-order-line-notify | verify_jwt=false；固定驗證密鑰；以 publishable key 呼叫含個資 RPC | 移除硬編碼密鑰並輪替；改用 server-side secret key；通知事件授權 |
| merch-payment-sync | verify_jwt=false；service role 讀取周邊訂單個資；CORS *；未見呼叫者授權 | 移除公開觸發方式；只接受可信付款事件；限制 CORS 不作為授權機制 |
| line-webhook | 已驗證原始 body 的 LINE HMAC 簽章 | 保留簽章驗證；補 webhook event 去重；管理員綁定指令需額外身分驗證 |

注意：verify_jwt=false 本身不一定錯（例如 LINE Webhook 必須使用 LINE 簽章驗證）；但所有其他公開端點必須在 Function 內完成可信呼叫者驗證。

## 2. P0 立即處理順序

1. 暫不撤銷 get_line_order_notification_payload(uuid)、get_cooling_order_line_notification_payload(bigint) 的既有執行權，直到依賴它們的 Functions 已改版。
2. 對內部通知 Function 建立獨立的 Function Secret，禁止把 secret 寫在 GitHub、HTML 或 App。
3. 更新 Functions：以服務端 secret key 呼叫私有 RPC；只接受訂單識別碼與內部授權資料，不接受前端傳入收件人或顧客個資。
4. 在測試環境確認 LINE 新單、付款證明、冷藏寄放、出貨通知正常。
5. 再撤銷 anon/authenticated 對個資 RPC 的 EXECUTE。
6. 撤銷後再次測試所有通知流程與舊官網下單相容性。

## 3. Secret 管理要求

- 每個內部服務使用獨立、可輪替的高熵 Secret。
- 以 Supabase Edge Function Secrets 管理；不可提交到版本庫。
- 既有程式碼內固定密鑰視為已暴露，應輪替，不可原值搬到新環境變數後繼續使用。
- 新舊密鑰需短暫雙版本相容時，必須有明確截止時間與移除步驟。
- 不可把 service_role／secret key 傳到瀏覽器或 App。
- Supabase 新式 Secret API Key 可與舊 service_role 同時運作，須先確認 Function 環境變數格式與目前專案金鑰狀態，再逐支切換；不得一次停用舊 key。

## 4. 通知事件安全契約

內部通知請求至少驗證：
- HTTP method 必須 POST。
- Authorization：短效簽章或獨立內部 Secret。
- timestamp 在允許時窗內。
- nonce／event_id 不可重複使用。
- order_id 格式與事件種類符合白名單。
- Function 從資料庫查詢通知內容與 LINE recipient。
- 付款通知只允許 payment proof 已提交且尚未成功通知的訂單。
- 出貨通知必須核對訂單物流狀態已進入可通知階段。
- 成功推播後以資料庫原子更新標記；失敗不可標記 sent。
- 錯誤回應不得包含姓名、電話、地址、匯款末五碼、LINE user ID 或完整訂單資料。

## 5. 不可直接停用的 Function

- line-webhook：LINE 官方事件入口，保留 HMAC。
- TikTok Functions：尚未確認實際用途，不可在本輪直接停用。
- line-order-test 系列：先查是否仍被任何官網、排程或外部服務呼叫，再決定停用。

## 6. Supabase 官方文件核對

- API key migration： https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys
- Edge Function secrets： https://supabase.com/docs/guides/functions/secrets
- Edge Function authentication： https://supabase.com/docs/guides/functions/auth

本輪查閱官方文件的重點：新式 publishable／secret keys 可與舊 anon／service_role keys 並行；新式 secret key 必須留在伺服器端；Edge Functions 可透過環境變數讀取 Secrets。輪替必須分批進行，避免中斷既有服務。

## 7. 驗收與回復

- [ ] 未授權呼叫所有內部通知端點 → 401/403。
- [ ] 使用錯誤／過期／重複 nonce → 401/409。
- [ ] 顧客無法指定 LINE recipient 或修改通知內容。
- [ ] 匿名／一般會員不能執行訂單個資 payload RPC。
- [ ] 訂單付款狀態未達 proof_submitted → 不發付款通知。
- [ ] 同一事件併發呼叫只推播一次。
- [ ] LINE API 失敗可重試且不遺失通知。
- [ ] LINE Webhook 無效簽章 → 401；相同事件重送不重複處理。
- [ ] 官網訪客下單、會員下單、老闆後台、蘿蔔糕與涼糕訂單流程均通過。
- [ ] 已備份舊 Function source、版本資訊、資料庫 migration 狀態與設定清單。
- [ ] 正式環境部署前取得明確核准。

## 8. 本輪執行界線

已執行：讀取 Active Functions source、確認實際程式碼問題、撰寫修正規格。
未執行：任何正式 SQL、Function deployment、Secret 更新／輪替、停用 Function、正式網站修改。
原因：這些操作會改變正式通知與訂單服務；目前尚未完成相容改版與測試，不能冒險中斷顧客訂單。