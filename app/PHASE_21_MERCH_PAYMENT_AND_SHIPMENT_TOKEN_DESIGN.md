# Phase 21｜周邊商品付款流程與出貨 Token 相容遷移設計

日期：2026-11-08  
分支：app/phase-1-planning  
範圍：讀取 active branch 前端程式與既有 Function source，產出不套用的設計及測試案例。正式 Supabase／官網完全唯讀。

## 1. 本階段新增確認

### 1.1 周邊商品客戶結帳頁 merch.html

在 active branch 讀取 `merch.html` 完整訂單送出段落後，確認：
- 客戶結帳直接 INSERT `merch_orders`。
- 訂單欄位寫入 `payment_status: 'unpaid'`、`shipment_status: 'unprepared'`，並寫入匯款後五碼。
- 隨後 INSERT `merch_order_items`。
- 表單沒有付款證明檔案 input、Storage upload、`payment_proof_url` 寫入。
- 沒有呼叫 `line-payment-notify` 或 `merch-payment-sync`。

因此，目前 active branch 的周邊商品結帳並未實作「上傳付款證明」流程。這比單純搜尋不到 caller 更明確：已讀到客戶結帳完整 submit handler，流程中沒有該功能。

### 1.2 周邊商品管理頁 merch-admin.html

- 後台可直接更新 `payment_status`、`shipment_status`。
- 後台可更新訂單備註及個資；刪除個資時會把 `payment_proof_url` 設為 NULL。
- 沒有付款證明檔案上傳或預覽／簽名 URL 產生流程。
- 目前後台付款狀態下拉選單使用 pending／paid／refunded；客戶結帳初始值使用 unpaid。兩邊狀態字典不一致，需在新付款流程統一，不可直接覆蓋舊值。

### 1.3 周邊商品管理頁 merch-admin-v2.html

- 主要讀取訂單及顯示狀態；此版本沒有付款證明上傳。
- 商品圖片上傳使用 `merch-images` bucket，屬商品圖，不是訂單付款證明。
- 此頁與 merch-admin.html 使用不同欄位／狀態模型，正式合併前須釐清實際入口與使用者習慣。

## 2. 周邊商品付款證明：結論與新流程設計

### 2.1 現況結論
目前可見的 `merch.html` → `merch_orders` 建單流程只寫匯款後五碼，沒有付款證明 upload；`payment_proof_url` 目前僅在通知 Function 中被讀取，在後台個資刪除流程中被清空。尚未找到客戶上傳端，因此不能把 `line-payment-notify`／`merch-payment-sync` 當成已串接付款通知的流程。

### 2.2 建議的新流程（設計稿，尚未實作）
1. 客戶建立周邊商品訂單，狀態維持待付款；取得訂單專屬短效上傳 capability。
2. 客戶上傳檔案至 private bucket；路徑由 server capability 綁定 order_id，不能讓客戶任意指定其他訂單路徑。
3. 上傳完成後呼叫 server-side finalize endpoint；後端驗證 capability、object 存在、大小、MIME、order_id 綁定及重播狀態。
4. 後端寫入 storage path（優先存 path，不存公開 URL），付款狀態轉為 `proof_submitted`；這代表「已送交證明待人工核對」，不是 paid。
5. 後端以唯一 event_id／idempotency key 發出管理員通知；重試不得重複通知或重複更新。
6. 管理員於後台核對實際入帳後，才將 payment_status 改為 paid／confirmed；通知訊息清楚區分「待核對」與「已確認收款」。
7. 管理員讀取證明時，由後端產生短效 signed URL；不可讓 private bucket 檔案變成 public。

### 2.3 相容性要求
- 不直接更改既有 `payment_status` 值；先盤點現有列的 distinct 狀態及前端使用者。
- 對舊訂單：NULL `payment_proof_url` 保持「未提供證明」，不可自動補成已付款。
- 暫時保留舊後台狀態選項與既有訂單查詢，待狀態轉換表與操作流程驗收後再移除。
- `payment_proof_url` 建議遷移為私有 storage object path；若需保留舊欄位，先採雙讀／單寫過渡策略，禁止在未確認資料內容前批次轉換。
- `line-payment-notify` 與 `merch-payment-sync` 目前功能近似且都可匿名呼叫；在正式 caller 清單完整前不可停用或撤銷。

## 3. 出貨通知 Token：相容遷移設計

### 3.1 目標安全模型
將 token 改為一次性、短效、訂單綁定的通知能力。token 本身只授權一個已核准的出貨通知事件；不授權 caller 自行決定收件人或訊息內容。

建議資料欄位（提案，尚未建立）：
- `shipment_notify_token_hash`：只存 SHA-256 hash（或 HMAC digest），不存原始 token。
- `shipment_notify_token_expires_at`：到期時間。
- `shipment_notify_token_consumed_at`：成功消耗時間。
- `shipment_notify_event_id`：事件唯一識別，用於冪等。
- `shipment_notify_token_version`：遷移版本或 key version，支援輪替。
- `shipment_notify_token_revoked_at`：必要時撤銷。

原始 token 只由 server 產生並交給可信任的 server-to-server caller；不得寫入 log、URL query string、GitHub、客戶端可讀欄位或錯誤訊息。

### 3.2 新流程
1. 可信任後台出貨流程先更新出貨狀態，建立 event_id。
2. server 端以 CSPRNG 產生高熵 token，計算 hash 後存 DB；設定短效期限（例如 10 分鐘，最終值依寄送／重試延遲測試決定）。
3. server 對內部通知 Function 發送簽章 envelope（timestamp、event_id、order_id、token、signature）；驗證 HMAC、時效及 event_id。
4. Function 以原子化 DB RPC 驗證 token hash、訂單、出貨狀態、expires_at、consumed_at；同一交易中消耗 token 或建立可冪等重試的 notification event。
5. DB 後端回傳經驗證的 recipient 與訂單物流資料；Function 不使用 request body 的 recipient、order_number、pickup_type、pickup_store。
6. Function 只用 DB 回傳資料組 LINE 訊息；若訂單沒有有效 LINE 綁定，安全地 skip，不可由 body 指定替代 recipient。
7. LINE 成功時標記 delivered；LINE 暫時失敗時使用 event_id 做有限次冪等重試，不重新開放 token；過期或已消耗 token 不得再推送。

### 3.3 舊版相容策略
- 先建立新欄位與新內部 endpoint 的設計／測試，不直接刪除 `shipment_notify_token`。
- 舊 Function v5 及舊 RPC 暫時保留，直到確認所有內部與外部 caller 已遷移。
- 遷移窗口內，舊 token 不應自動視為新 token；需明確制定「重新產生新 token」策略。
- 切換前比對每一個出貨狀態來源、通知入口、LINE 綁定資料來源及管理員手動補送流程。
- 完成端到端測試與回滾演練後，才提出舊 RPC 權限收斂及舊欄位移除的獨立變更清單。

## 4. Patch package 草案（不執行）

### A. Shipment token migration
- Migration A1：新增 token hash／expiry／consumed／event id／version／revoked metadata。
- Function A2：新增 issue-and-verify-consume RPC；驗證與消耗原子化。
- Function A3：更新 line-customer-notify，僅接受可信任內部簽章 envelope；DB 取回 recipient／物流欄位。
- Cutover A4：caller 遷移後才收斂舊 verify RPC grants；保留回滾窗口。

### B. Merch proof upload
- Storage B1：private bucket，限制 MIME、檔案大小與路徑；客戶不可任意寫入其他 order_id。
- API B2：建立短效 upload capability 與 finalize endpoint。
- DB B3：以 server-side finalize 更新 proof path／proof_submitted 狀態。
- Notification B4：單一官方付款證明通知入口，使用 HMAC／timestamp／event_id；proof_submitted 不等於 paid。
- Admin B5：後台以 signed URL 檢視證明，人工確認後才設 paid。

### C. Caller／status compatibility
- Inventory C1：列出 merch.html、merch-admin.html、merch-admin-v2.html、外部表單及 Dashboard caller。
- State C2：制定 unpaid／proof_submitted／paid／refunded 與 shipment_status 的單一轉換表。
- Cutover C3：保留舊頁面相容，按使用率與測試結果分階段切換。

## 5. 驗收測試案例（下一階段可直接實作為 fixtures）

### Shipment token
1. 正確 order_id + 正確 token + 未過期 + 未消耗 → 可建立一次通知事件。
2. token 過期 → 403／expired，不可推播。
3. token 已消耗 → 回傳 already_processed，不得第二次推播。
4. token 對應另一筆 order_id → 拒絕。
5. body 自帶 recipient／order_number／pickup_store／pickup_type → 全部忽略，使用 DB 驗證資料。
6. 訂單沒有已綁定 LINE recipient → skip，不可使用 body recipient。
7. timestamp 過期或 HMAC 錯誤 → 拒絕。
8. 同 event_id 併發兩次 → 只建立一筆通知事件。
9. LINE API timeout 後重試 → event_id 冪等，不重複通知。
10. token revoked → 拒絕。
11. log 與錯誤回應不得包含 token、hash、LINE recipient 或客戶個資。

### Merch payment proof
1. 未授權／無效 capability 上傳 → 拒絕。
2. capability 綁定 order A，嘗試寫入 order B path → 拒絕。
3. 非允許 MIME、超出大小限制、空檔案 → 拒絕。
4. object 未成功上傳卻呼叫 finalize → 拒絕。
5. 上傳成功 finalize → proof_submitted，不是 paid。
6. 同一 event_id finalize 重送 → 同一結果，不重複通知。
7. 管理員確認入帳 → paid；未確認前不得顯示付款完成。
8. 非管理員嘗試產生 proof signed URL → 拒絕。
9. 舊訂單 NULL proof path → 舊資料可正常查詢，不錯誤顯示「已上傳」。
10. 個資刪除流程 → 依政策刪除或封存 proof object，不能只清欄位留下孤兒檔案。

## 6. 本階段狀態與限制

- 已讀取 active branch 的 `merch.html`、`merch-admin.html`、`merch-admin-v2.html` 相關完整程式段落。
- 已讀取 Supabase `line-customer-notify` v5 source（Phase 20 已記錄），並對照 DB token 驗證函式與 grants。
- 沒有查詢任何客戶訂單列、付款證明物件、LINE recipient 或實際 token 值。
- 沒有呼叫通知 Function、LINE API 或 Storage upload。
- 沒有執行 DDL／DML、修改 RLS／GRANT、部署 Function、修改 Secrets 或官網檔案。
- 這是設計稿與測試規格，不是已上線的修補。

## 7. 下一階段 Phase 22
1. 完成所有周邊商品訂單建立／更新／付款／出貨頁面的 caller matrix，並確認正式入口。
2. 列出需由專案管理者在 Supabase Dashboard、LINE webhook 設定、第三方自動化控制台確認的外部 caller 清單。
3. 建立可在本機執行的純函式 token lifecycle／payment state test fixtures；先跑單元測試，不連正式 DB。
4. 完成逐項 Patch Diff、部署順序、回滾步驟與驗收條件後，另行交付審核；未經明確批准不做任何正式變更。
