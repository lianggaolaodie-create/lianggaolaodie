# 老爹．涼糕整合專案｜第三輪付款、後台權限與 LINE API 安全盤點

日期：2026-11-08  
分支：`app/phase-1-planning`  
範圍：付款通知、管理後台權限、LINE Edge Functions、資料庫 SECURITY DEFINER RPC。  
限制：唯讀盤點；未修改正式資料庫、RLS、函式、Storage、Edge Functions 或官網。

## 1. 重要發現摘要

本輪發現數個需要在 App 正式串接前優先修正的高風險問題：

1. 兩支通知 payload RPC 可由 anon 呼叫，且回傳訂單個資。
2. 一支付款通知旗標 RPC 可由 anon 呼叫，未見函式內管理員或 token 驗證。
3. 多支 `verify_jwt=false` 的通知 Edge Function 沒有一致的呼叫者授權設計。
4. 涼糕訂單管理頁的前端登入檢查只確認管理員 profile enabled，沒有在前端限定訂單管理角色；實際資料存取仍須依 RLS／RPC 驗證。
5. 蘿蔔糕管理頁有較完整的 `super_admin/order_admin` 登入角色檢查，但訂單狀態仍由瀏覽器直接更新資料表，需確保 RLS 狀態轉移規則足夠嚴格。

這些屬於程式碼／資料庫權限盤點結果，不代表已遭外部利用。

## 2. 高風險：匿名可讀取訂單個資的 SECURITY DEFINER RPC

### 2.1 `get_line_order_notification_payload(uuid)`

資料庫狀態：
- SECURITY DEFINER。
- EXECUTE 可由 anon、authenticated 呼叫。
- 只傳入訂單 UUID，函式內未見呼叫者身分或一次性授權 token 檢查。
- 回傳內容包含訂單號、日期、配送地區、取貨方式、金額、付款狀態、匯款後五碼、顧客姓名、電話、備註、門市／取貨資訊、商品明細及管理員 LINE recipient。

影響：若取得有效訂單 UUID 的未登入者可呼叫該 RPC，可能讀取完整訂單個資及付款識別資訊。訂單 UUID 不應被當成存取密鑰。

### 2.2 `get_cooling_order_line_notification_payload(bigint)`

資料庫狀態：
- SECURITY DEFINER。
- EXECUTE 可由 anon、authenticated 呼叫。
- 只傳入冷藏寄放訂單數字 ID，函式內未見呼叫者身分或一次性 token 檢查。
- 回傳訂單號、日期、地區、門市、金額、匯款後五碼、備註、顧客姓名、電話、商品明細及管理員 LINE recipient。

影響：數字型訂單 ID 更不應被視為授權憑證；未登入呼叫可能讀取訂單個資。

建議修正：
- 將通知 payload 函式改為僅供可信服務端使用，或以不可猜測、短效、單次使用且綁定訂單及用途的 token 驗證。
- 撤銷 anon／一般 authenticated 的直接 EXECUTE；若仍需讓 Edge Function 以 service role 呼叫，應精確授權 service_role 並驗證實際執行路徑。
- 通知 payload 只回傳必要欄位，管理員 recipient 不應經公開 RPC 回傳。
- 加入稽核紀錄、重播防護與速率限制。
- 正式修正前先確認現有 LINE 通知 Edge Functions 是否依賴 anon key 呼叫這些 RPC，安排相容切換。

## 3. 高風險：匿名可更新付款通知旗標

### `mark_line_payment_notification_sent(uuid)`

資料庫狀態：
- SECURITY DEFINER。
- EXECUTE 可由 anon、authenticated 呼叫。
- 函式內容直接將指定 `orders.id` 的 `payment_notification_sent` 設為 true。
- 未見管理員角色、服務端 token、付款狀態或通知成功證明檢查。

影響：未登入者若知道訂單 UUID，可能直接修改付款通知旗標，造成通知流程被跳過或狀態不準確。

建議：
- 將此函式限制為可信 Edge Function／service role 專用。
- 僅在 LINE API 成功回應後，以冪等交易更新旗標。
- 更新條件需包含原狀態與通知鎖定／重試控制，避免並發重複推播。
- 不要將「付款通知已發送」與「款項已核實」混為同一狀態。

## 4. 管理員狀態更新 RPC 的區分

### `admin_update_order_status(uuid,text)`

- SECURITY DEFINER，anon／authenticated 可執行。
- 函式內有 `public.is_admin()` 檢查，非管理員會被拒絕。
- 狀態值有限制，並對訂單列使用 FOR UPDATE。
- 因此 Advisor 的「anon 可執行 SECURITY DEFINER」警告不等於此函式可讓匿名者直接修改訂單；其函式內管理員檢查是必要的第二層防線。

仍需補強：
- 將可執行權限收斂到實際需要的角色，避免無意義公開入口。
- 狀態轉移需驗證前置狀態、付款條件及配送方式，而不只是狀態字串白名單。
- 對付款狀態、訂單狀態、物流狀態分別設計，不以單一 status 混用。
- 保留管理員操作稽核紀錄。

## 5. Edge Functions 抽查

目前清單中有多支 Active Functions，其中不少設定 `verify_jwt=false`。這是 LINE webhook 等服務可能需要的設定，但必須在函式內自行驗證請求來源或授權。

### 正面設計
- `line-webhook`：讀取原始 request body，使用 LINE Channel Secret 驗證 `x-line-signature`，符合 webhook 簽章驗證方向。
- `admin-manage`：驗證 Bearer token、呼叫 Auth getUser，再以 service role 查核 enabled super_admin，權限流程較完整。
- `line-customer-notify`：會呼叫 `verify_shipment_notify_token`，有訂單 token 驗證步驟；但仍需驗證通知收件人與內容是否由可信資料庫生成。

### 待修正／深入確認
- `line-payment-notify`：以 service role 讀取周邊商品訂單並推播；抽查未見呼叫者授權。若只是「通知管理員」，匿名呼叫仍可能造成訊息濫用。
- `merch-payment-sync`：以 service role 讀取周邊商品訂單並推播；抽查未見呼叫者授權。
- `line-payment-order-notify`：以 service role 讀取付款通知 payload；抽查未見呼叫者授權，需補上來源驗證與通知冪等。
- `line-order-send-v2`：抽查未見呼叫者授權，且通知 payload RPC 本身可由 anon 呼叫；需停止把訂單 UUID 當成授權。
- `line-order-payment-send-v2`、`line-order-notify`：有自訂 header secret；程式碼內存在固定密鑰常數的設計，應改用 Supabase Function Secrets，並輪替已寫入原始碼的密鑰。此文件不記錄密鑰內容。
- `cooling-order-line-notify`：有自訂 header secret，但同樣應移至 Function Secrets，並輪替硬編碼值。
- `line-customer-notify`：雖驗證出貨 token，通知 recipient、訂單號與訊息欄位仍由 request body 傳入；應改由後端根據 token 對應訂單產生收件人與訊息，避免呼叫者替換通知對象或內容。

重要：本輪為程式碼抽查，並未向公開 Function 發送測試請求，也未驗證密鑰是否曾外洩或被濫用。

## 6. 後台權限與資料操作

### 6.1 涼糕訂單管理 `admin-orders-fixed-v3.html`

- 登入後的 `access()` 只確認 `admin_profiles.enabled`，沒有在前端明確限定 `super_admin/order_admin` 角色。
- 頁面直接對 `cooling_pickup_orders`、`orders` 執行狀態更新及刪除；另有訂單明細、個資查詢與個資清除操作。
- 前端按鈕隱藏不是安全邊界；必須確認每一張資料表的 RLS／RPC 僅允許對應管理角色。
- 個資管理權限與訂單管理權限應分開，不應讓任何 enabled 管理員都能進入所有操作介面。
- 訂單刪除不應作為一般日常管理操作；建議改成取消／作廢及保留稽核紀錄，避免訂單、付款、庫存與報表失去關聯。

### 6.2 蘿蔔糕訂單管理 `admin-radish-orders.html`

- 登入檢查明確允許 enabled 的 `super_admin/order_admin`。
- 訂單狀態由前端直接 UPDATE `radish_orders`；需以 RLS 限定狀態可改欄位、允許的狀態轉移及管理員角色。
- 開單開關直接 upsert `site_admin_content`；應確認只有有權管理蘿蔔糕商品／訂單的角色能修改，並加入設定異動紀錄。
- 前端開單開關必須與蘿蔔糕下單 RPC 的後端開單驗證一致。

## 7. 付款狀態機設計要求

付款狀態不可由前端任意寫入。建議至少分清：
- `unpaid`：尚未提供付款資料／尚未付款。
- `proof_submitted`：已提交匯款證明，等待核對。
- `under_review`：管理員核對中（若營運需要）。
- `paid`：管理員核實入帳或可信金流 webhook 確認。
- `rejected`：證明不符／未入帳，需補件。
- `refunded`：已退款（若未來支援）。

`payment_notification_sent` 只代表通知是否成功送出，不可代表 `paid`。貨到付款（COD）須另有付款方式與收款完成狀態，不可混用匯款流程。

## 8. 本輪建議修正優先順序

P0（上 App／會員查詢前）：
1. 封鎖匿名直接讀取兩支 LINE notification payload RPC 的訂單個資。
2. 限制 `mark_line_payment_notification_sent` 為可信服務端專用。
3. 所有以 service role 讀取／通知訂單的 Edge Function 加入明確呼叫者驗證。
4. 自訂 header secret 移至 Function Secrets，輪替原始碼中的固定密鑰。
5. 確認會員訂單明細查詢僅限本人 UID，訪客查詢採短效驗證憑證。

P1（後台整合前）：
1. 涼糕後台前端角色限制與資料庫 RLS／RPC 權限矩陣一致。
2. 蘿蔔糕訂單狀態轉移改由受控後端 RPC，避免前端任意更新欄位。
3. 將付款、訂單、物流狀態拆成獨立狀態機。
4. 訂單刪除改成取消／作廢流程並保留稽核。
5. 管理員設定變更加入 audit log。

## 9. 尚未執行的項目

- [ ] 沒有撤銷任何 RPC EXECUTE。
- [ ] 沒有更改 Edge Function Secrets 或部署函式。
- [ ] 沒有更改任何 RLS policy。
- [ ] 沒有更新正式付款狀態。
- [ ] 沒有修改官網或 App。
- [ ] 需先製作 migration／Function patch 草案、相容性測試、備份與回復計畫，列明每一項影響，再交由使用者核准。

**本文件僅為開發分支的唯讀安全盤點，不代表正式環境已修復或已上線。**


## 10. 補充：資料表實際權限與測試函式

本輪另以 `has_table_privilege` 檢查實際角色權限，確認：
- `cooling_pickup_orders` 與 `cooling_pickup_order_items`：anon 具 INSERT privilege，RLS 亦有公開 INSERT policy；這確認了直接公開 INSERT 不只是 policy 設定文字，而是角色具備可嘗試寫入的資料庫權限。需評估移除直接寫入路徑並保留受控 RPC。
- `orders`、`order_items`、`order_private`：anon 沒有 SELECT／INSERT／UPDATE／DELETE table privilege；authenticated 有部分 table privilege，但實際仍受 RLS policy 限制。
- `radish_orders`：authenticated 有 SELECT／UPDATE table privilege，RLS 限定管理員讀取／更新；匿名角色沒有 CRUD privilege。
- `radish_order_items`：authenticated 有 SELECT，管理員讀取 policy；未授予 authenticated INSERT／UPDATE／DELETE。

注意：table privilege 與 RLS 是兩層檢查；有 privilege 不代表能讀寫任意資料，仍須檢查 policy。反之，撤除 privilege 也可能影響既有前端及管理後台，須先做相容性驗證。

### Active 測試 Edge Functions

目前 Supabase Edge Function 清單有多支名稱為 `line-order-test`、`line-order-test-2` 至 `line-order-test-7` 的 Active 函式，均設定 `verify_jwt=false`，抽查內容為簡單回傳 OK／JSON 的測試端點。

另有 `tiktok-live-room-test`，會接受 query string 的 user 名稱並呼叫外部服務取得直播房間／串流資訊；`tiktok-live-chat` 是未見登入驗證的 WebSocket 入口，`tiktok-live-proxy` 是公開代理用途。這些不屬於本階段顧客 App 核心功能，需確認是否仍有實際使用者或網站依賴；未經盤點不可直接停用。

建議：
1. 逐一標記每個 Active Function 的正式用途、呼叫端、負責人及是否必要。
2. 無使用中的測試 Function 移至獨立測試專案或停用；停用前先查網頁／自動化／LINE webhook 呼叫紀錄。
3. TikTok 相關功能若不屬於目前 App 上線範圍，先從新 App API 清單排除，但不要直接停掉現有直播功能。
4. 對所有公開 proxy／WebSocket 加入合理的速率限制、輸入限制與成本監控。
