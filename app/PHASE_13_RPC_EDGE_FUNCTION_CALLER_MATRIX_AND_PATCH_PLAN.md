# Phase 13｜RPC／Edge Function 呼叫來源矩陣與安全修補草案

日期：2026-11-08  
分支：app/phase-1-planning  
範圍：正式 Supabase Edge Function 原始碼、Postgres trigger 與指定 RPC 定義唯讀檢查。

> 本文件是呼叫鏈追查與修補設計，並非正式修復。未部署 Function、未修改 SQL／Trigger／Secrets、未執行 GRANT／REVOKE、未寫入正式資料。

## 1. 執行摘要

本階段已確認核心 LINE 通知呼叫鏈來自 Postgres trigger，不是只由前端呼叫：

- orders INSERT → `notify_line_on_new_order()` → `line-order-send-v2`
- orders 更新 transfer_last5 → `notify_line_on_payment_proof()` → `line-order-payment-send-v2`
- cooling_pickup_orders INSERT／更新 payment_last5 → `notify_line_on_cooling_order_payment()` → `cooling-order-line-notify`

並發現：
1. `line-order-send-v2` 為 ACTIVE、verify_jwt=false，且原始碼沒有任何請求密鑰、JWT 或 caller 驗證。外部可用任意 order_id 觸發查詢 payload 並向管理員 LINE 推播訂單資料。列為 P0。
2. 兩支 LINE payload RPC 對 PUBLIC／anon／authenticated 開放 EXECUTE，且函式內未驗證 caller／order ownership。
3. `line-order-payment-send-v2`、`cooling-order-line-notify` 以「已提交匯款末五碼」作為通知條件，訊息卻寫「付款狀態：已付款」。付款證明提交不等於核款完成，屬營運／財務語意錯誤。
4. 多支通知 Function 與資料庫 trigger 內有硬編碼驗證密鑰。這些密鑰不應留在原始碼或 trigger definition，應移至安全 Secrets／可信內部授權機制，並規劃輪替。
5. `line-customer-notify` 雖驗證 shipment notify token，但收件者、訂單編號、門市等訊息內容由 request body 提供；應由後端依 token 驗證後自行讀取訂單資料，不能信任 caller 提供的收件人與通知內容。
6. `line-webhook` 有驗證 LINE HMAC raw body，但「綁定手機」只以電話匹配歷史訂單，未做 OTP／一次性驗證；訂單編號＋電話末四碼也屬低熵驗證，須加上速率限制與更強驗證。

## 2. 已確認呼叫來源矩陣

| 來源／事件 | DB trigger／caller | Edge Function | 驗證現況 | 風險 |
|---|---|---|---|---|
| orders 新增 | `orders_notify_line_after_insert` → `notify_line_on_new_order()` | `line-order-send-v2` | verify_jwt=false；Function 沒有 request secret／JWT 驗證 | P0 公開端點可用任意訂單 ID 觸發通知 |
| orders 付款證明欄位更新 | `orders_notify_line_after_payment` → `notify_line_on_payment_proof()` | `line-order-payment-send-v2` | verify_jwt=false；有 header secret，但密鑰寫在 Function 與 DB trigger source | P0/P1 密鑰暴露面與輪替問題 |
| 冷藏寄放付款末五碼新增／更新 | `cooling_orders_notify_line_after_payment` → `notify_line_on_cooling_order_payment()` | `cooling-order-line-notify` | verify_jwt=false；有 header secret，但密鑰寫在 Function 與 DB trigger source | P0/P1 密鑰暴露面與輪替問題 |
| 顧客出貨通知 | 外部 caller 尚未完整確認 | `line-customer-notify` | verify_jwt=false；呼叫 `verify_shipment_notify_token`；但 recipient/order_number/pickup data 來自 body | P1 防止通知被導向非本人／錯誤內容 |
| LINE Webhook | LINE 平台 webhook | `line-webhook` | verify_jwt=false，但自行驗證 X-Line-Signature HMAC raw body | 基礎簽章驗證正確；綁定流程仍需加強 |
| 周邊商品付款通知 | 外部 caller／付款流程待追查 | `line-payment-notify` | verify_jwt=false；使用 service_role 讀取訂單並推播；檢查 payment_status=proof_submitted | P1 caller authentication、冪等與通知狀態 |
| LINE 訂單付款通知另一版本 | caller 待確認 | `line-payment-order-notify` | verify_jwt=false；service_role；呼叫公開 payload RPC | P1 caller authentication；與其他通知版本重疊 |
| 管理員管理 | 管理後台呼叫 | `admin-manage` | verify_jwt=true；getUser 驗 JWT 並檢查 enabled super_admin | 初步正向；仍需 CORS allowlist、輸入驗證與審計 |

## 3. Edge Function 原始碼發現

### P0-A｜line-order-send-v2 缺少 caller authentication

- 狀態：ACTIVE；版本 13；verify_jwt=false。
- 程式讀取 request body 的 `order_id`，直接以 service role 呼叫 `get_line_order_notification_payload`。
- 未檢查 Authorization JWT、內部 header secret、HMAC 或一次性 token。
- payload RPC 本身又允許 PUBLIC／anon／authenticated EXECUTE。
- 成功時把姓名、電話、訂單地區、取貨資訊、品項、總額、備註、匯款末五碼等內容推送至管理員 LINE。
- 建議：優先採用「DB trigger → 私有佇列／內部通知工作」或「trigger 使用專用 secret 呼叫受限 Edge Function」；Function 端必須驗證 caller，payload 僅可由服務端內部取得。對外公開端點不得接受任意 order_id。正式修正前先測試訂單新增與重試行為。

### P0-B｜公開 payload RPC

- `get_line_order_notification_payload(uuid)`、`get_cooling_order_line_notification_payload(bigint)` 都是 SECURITY DEFINER，EXECUTE ACL 含 PUBLIC／anon／authenticated。
- 兩支函式只依 order_id 查詢資料，未驗證 caller 或訂單所有權。
- 建議：撤銷 PUBLIC／anon／authenticated EXECUTE，僅保留可信內部服務所需權限；或改為不暴露敏感資料的受限內部 API。必須先確認 Edge Function、trigger、舊官網與其他依賴 caller，再逐項切換。

### P0-C｜付款通知狀態文字錯誤

- `line-order-payment-send-v2` 有檢查 transfer_last5 存在，但訊息將付款狀態寫成「已付款」；DB 欄位實際可能仍為 `proof_submitted`。
- `cooling-order-line-notify` 以 payment_last5 存在作為通知條件，訊息也寫「已付款」；該表 status 可能仍是「待確認匯款」。
- 建議訊息改為「已提交匯款資料／待管理員核款」，只有核款 RPC 成功後才通知「已確認付款」。不得以末五碼存在推導已付款。

### P1｜硬編碼通知密鑰

- `line-order-notify`、`line-order-payment-send-v2`、`cooling-order-line-notify` 等 Function 內含固定驗證密鑰。
- DB trigger `notify_line_on_payment_proof()` 與 `notify_line_on_cooling_order_payment()` 亦將 header secret 寫在 function definition。
- `line-order-send-v2` 目前甚至沒有任何此類驗證。
- 建議：密鑰全部移至 Supabase Function Secrets 或其他受控 secret store；DB trigger 改為呼叫受控內部入口，不在 function source 中存明文。密鑰輪替需有新舊雙 key 過渡、caller 更新、監控及回復計畫。不可直接先撤舊 key，避免通知中斷。

### P1｜line-customer-notify 信任 request body

- 有呼叫 `verify_shipment_notify_token(order_id, token)`，驗證通過才推播。
- 但 recipient、order_number、pickup_type、pickup_store 由 request body 提供，並非驗證後由 DB 查出。
- 建議：token 驗證成功後，服務端自行查詢 order、收件 LINE 綁定與物流資料；忽略 body 中所有收件者與訂單顯示欄位。加入 token 到期、使用次數、撤銷與 rate limit。

### P1｜LINE 綁定流程

- `line-webhook` 先以 LINE HMAC 驗證 raw request body，這點正確。
- `綁定手機 09xx...` 呼叫 `bind_line_customer_phone`，後端以電話比對所有歷史訂單並批次綁定；沒有 OTP 或一次性驗證碼。
- `綁定 訂單編號 電話末四碼` 流程也可能受到低熵猜測／撞庫風險，需速率限制、冷卻時間、事件紀錄及更強本人驗證。
- 建議：簡訊 OTP 或會員登入後簽發短效綁定 token；歷史訂單只在驗證成功後認領；不得只憑電話字串完成綁定。

## 4. Trigger 與狀態副作用

| Trigger | 觸發條件 | 副作用／注意事項 |
|---|---|---|
| orders_notify_line_after_insert | orders INSERT，home_delivery 或 transfer_last5 有值 | 直接 HTTP POST line-order-send-v2；目前未帶驗證 header |
| orders_notify_line_after_payment | transfer_last5 有值且與舊值不同 | HTTP POST line-order-payment-send-v2，帶硬編碼 secret |
| cooling_orders_notify_line_after_payment | INSERT 或 payment_last5 改變且非空 | HTTP POST cooling-order-line-notify，帶硬編碼 secret |
| trg_cooling_pickup_minimum_qty | cooling item INSERT | 檢查總數至少 2，並把主單 status 設為「待確認匯款」 |
| trg_sync_order_item_product_name | cooling item INSERT／UPDATE | 依 daily_order_flavors 同步 flavor_id/product_name |

重要相容性：
- 冷藏寄放直接 INSERT policy 目前與 item trigger 共同運作；撤銷 anon INSERT 前，必須先將舊官網改為使用可信 RPC，並驗證最低訂購量 trigger、訂單總額與庫存檢查仍運作。
- orders 通知 trigger 可能因 INSERT 及付款欄位更新各觸發一次；通知事件需有明確類型與 idempotency key，避免新訂單與付款通知重複或互相覆蓋。
- 通知 HTTP request 失敗、逾時或 LINE 回應失敗時，需有可重試佇列／狀態，不可只依 trigger 同步呼叫且沒有可靠重試。

## 5. P0 修補方案草案（未執行）

### A. 通知服務入口
- 建立明確的 internal-only endpoint contract。
- caller 驗證：短效 HMAC／簽章時間戳＋nonce 或 JWT service identity；不可使用可被前端讀取的 public key 作授權。
- 驗證 request method、Content-Type、schema、UUID／數字 ID、大小限制。
- 對重播事件以 event_id／idempotency key 去重。
- 限制每張訂單可發送的通知類型與合法狀態。

### B. Payload RPC
- 只讓可信服務端取得 payload。
- 將管理員 LINE recipient、顧客電話、地址、備註、匯款末五碼等資料限制在內部使用。
- payload 最小化：一般新訂單通知不必包含匯款末五碼；付款通知只包含核款所需資訊。
- RPC 以固定 search_path、schema-qualified object names、最小 EXECUTE 權限執行。

### C. 付款流程
- 顧客提交證明：payment_status → proof_submitted；顯示「待核款」。
- 管理員核實銀行入帳後：payment_status → confirmed／paid（依統一狀態機）；再觸發付款成功通知。
- 付款通知旗標只能由可信通知服務更新，並保存 sent_at、event_id、attempt_count、last_error。
- 冷藏寄放 status 與付款狀態分開；不能用「已寄放」或 payment_last5 代替付款確認。

### D. Secrets
- Function secret 移出 source code。
- DB trigger 不再保存長期明文 secret；改用專用受限機制。
- 設定雙 key rotation window、記錄切換時間、監控失敗率，成功後撤銷舊 key。
- 若密鑰曾提交至 GitHub 或可被非授權者讀取，視為已暴露並安排輪替；不可在文件、聊天或 commit 中重印。

## 6. 測試矩陣（免費本機／Mock）

| 測試 | 預期結果 |
|---|---|
| 未授權呼叫 line-order-send-v2 | 401／403，不查詢訂單、不推播 |
| 帶錯誤 HMAC／過期 timestamp | 拒絕 |
| 重播相同 event_id | 不重複推播 |
| 任意 order_id 不存在 | 404，不洩露其他資料 |
| 訂單已取消／不符合通知條件 | 不推播 |
| payment_status=proof_submitted | 通知顯示「待核款」，不可寫已付款 |
| payment_status=confirmed | 只有核款事件可發送付款成功通知 |
| cooling status=待確認匯款但 payment_last5 有值 | 不顯示已付款 |
| line-customer-notify body 偽造 recipient | 忽略 body recipient，使用已驗證訂單綁定 |
| LINE webhook 簽章錯誤 | 401 |
| LINE 手機綁定無 OTP | 不可完成綁定 |
| 服務暫時失敗後重試 | 同一事件不重複推播，且可追蹤最後錯誤 |
| 舊官網下單／付款證明提交 | 原功能仍正常，通知可正常排程 |
| 冷藏寄放下單 | 最低 2 盒、價格／費用／庫存均由後端驗證 |

本階段只建立測試規格，尚未執行正式端到端測試。

## 7. 需要先完成的 caller 追查

下列項目尚未完整確認，不能直接修改：
- `line-order-notify`、`line-payment-order-notify` 的所有外部 caller 與舊版相容關係。
- `line-customer-notify` 的出貨通知實際呼叫端、shipment token 產生／撤銷流程。
- `line-payment-notify` 的周邊商品付款通知 trigger／後台呼叫來源。
- `line-order-test`、`line-order-test-2` 至 `line-order-test-7` 的依賴；不可因名稱含 test 就停用。
- 所有 LINE 通知 Function 是否有外部自動化、官網前端或第三方服務直接呼叫。

## 8. 正式環境安全界線

- 僅讀取 Edge Function 原始碼、DB trigger definition 與 RPC function definition。
- 未讀取顧客訂單資料列或個資列。
- 未部署／停用／替換任何 Edge Function。
- 未修改 DB function、trigger、RLS、GRANT／REVOKE、Secrets 或 Auth 設定。
- 未修改官網。
- 未建立付費 Supabase branch。
- 所有修正仍是草案；正式變更需提供精確 patch、SQL、caller 遷移、影響範圍、備份、回復計畫與驗收案例，並取得針對該清單的明確核准。
