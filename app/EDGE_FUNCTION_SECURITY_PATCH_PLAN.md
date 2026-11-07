# Edge Function 安全修正規格（草案）

本文件與 SQL 草案配套；不部署、不更動正式 Functions。

## 原則
- 所有使用 service_role 讀取訂單、個資或付款狀態的 Function 必須驗證呼叫來源。
- service_role key 僅存在 Supabase Function Secrets，絕不傳到瀏覽器或 App。
- LINE Webhook 保留原始 body 的 LINE HMAC 簽章驗證。
- 管理員操作必須驗證 Supabase Bearer token，再查 enabled admin_profiles 及允許角色。
- 通知 payload 不接受呼叫者提供的姓名、電話、收件人、金額或商品內容；只接受訂單識別碼及短效 server token，後端從 DB 讀取最少必要欄位。
- 通知 API 採冪等鎖定：建立 attempt → 發送 LINE → 成功才標記 sent；失敗保留 retry 狀態，避免重複推播。

## Function 變更表

| Function | 現況抽查 | 目標 |
|---|---|---|
| line-order-send-v2 | service role；抽查未見呼叫者授權 | 僅由受信任訂單建立／付款事件呼叫；使用 server secret 或內部簽章；secret 移至 Function Secrets |
| line-order-payment-send-v2 | 固定 header secret | 移除程式碼常數，使用 Function Secret，輪替舊值 |
| line-order-notify | 固定 header secret | 同上，並限制允許的事件種類 |
| cooling-order-line-notify | 固定 header secret；目前以 publishable key 呼叫 payload RPC | 改用 service role 呼叫受限 RPC；以 Function Secret 驗證內部呼叫；輪替舊值 |
| line-payment-order-notify | service role；抽查未見呼叫者授權 | 只允許可信付款事件呼叫；驗證 proof_submitted 且防重複 |
| line-payment-notify | service role；抽查未見呼叫者授權 | 加入可信呼叫者驗證、事件簽章、速率限制 |
| merch-payment-sync | service role；抽查未見呼叫者授權 | 加入可信呼叫者驗證及冪等付款通知 |
| line-customer-notify | token 驗證 RPC，但 recipient／訊息資料由 request body 提供 | 後端依 token 與訂單查詢 recipient、訂單編號及門市，不信任 body 的 recipient |
| line-webhook | LINE HMAC signature 驗證 | 保留並增加 event webhook 重複事件去重 |
| admin-manage | Bearer token + Auth getUser + enabled super_admin | 保留；補上輸入 schema、操作 audit log |

## 冷藏寄放 payload 呼叫切換
1. 先部署新的 Function 版本：以 server-side service_role client 呼叫 get_cooling_order_line_notification_payload。
2. 將 Function Secret 設為專用內部呼叫密鑰，呼叫端不得在網站公開程式碼內。
3. 驗證 LINE 訊息、錯誤重試、重複事件及通知旗標。
4. 再執行 SQL 草案限制 RPC 權限。
5. 觀察正式流量後才移除舊 Function 版本。

## 安全測試
- 不帶 token 呼叫每支內部通知 Function：預期 401/403。
- 偽造 token、過期 token、重複 token：預期 401/403。
- 傳入其他人的 recipient／phone／order_number：後端忽略或拒絕。
- 訂單不存在：404；未提交付款證明：409；已通知：回傳 already_sent，不再推播。
- LINE API 暫時失敗：不標記 sent，可安全重試。
- Webhook 無簽章／錯誤簽章：401；重送相同 webhook event：不重複執行。
- service_role key 不得出現在 GitHub、HTML、App bundle、瀏覽器 Network response 或 client logs。
