# Phase 23｜正式切換前確認表與安全 Patch 草案

日期：2026-11-08  
分支：app/phase-1-planning  
性質：唯讀稽核結果＋未套用 patch 設計。此文件不是 migration，也沒有任何正式環境變更。

## 1. 本階段新確認的正式 Schema 現況

本次只讀查詢 Supabase metadata（欄位、預設值、CHECK／UNIQUE constraints），沒有查詢顧客個資或訂單明細。

### 1.1 merch_orders 欄位

| 欄位 | 型別 | Nullable | Default |
|---|---|---:|---|
| id | bigint | NO | — |
| order_number | text | NO | — |
| status | text | NO | pending |
| payment_status | text | NO | unpaid |
| shipment_status | text | NO | unprepared |
| remittance_last5 | text | YES | — |
| payment_proof_url | text | YES | — |
| payment_notification_sent | boolean | NO | false |
| created_at／updated_at | timestamptz | NO | now() |

### 1.2 正式 CHECK constraints

- `merch_orders.status`: pending、confirmed、preparing、shipped、completed、cancelled
- `merch_orders.payment_status`: unpaid、proof_submitted、confirmed、rejected
- `merch_orders.shipment_status`: unprepared、preparing、shipped、delivered

這是資料庫實際允許值，不是 UI label，也不是 Phase 22 helper 的示意值。

### 1.3 舊後台選項與正式 Schema 不相容

| 欄位 | 舊後台選項 | DB 允許值 | 判斷 |
|---|---|---|---|
| payment_status | pending／paid／refunded | unpaid／proof_submitted／confirmed／rejected | pending、paid、refunded 不可直接寫入 |
| shipment_status | pending／processing／shipped／completed | unprepared／preparing／shipped／delivered | pending、processing、completed 不可直接寫入 |

因此舊後台 select 若直接將值寫入資料庫，會遇到 CHECK constraint violation。實際使用影響仍需在不修改資料的前提下，以受控測試帳號／隔離環境重現；本次未送出任何 UPDATE。

### 1.4 狀態相容建議（只作 UI／API adapter）

| 舊 UI 值 | 建議 canonical value | 備註 |
|---|---|---|
| pending（付款） | unpaid | UI 待付款，不寫入 pending |
| paid | confirmed | 只有管理員核實入帳後才可轉 |
| refunded | 暫不允許直接映射 | DB CHECK 沒有 refunded；需先定義退款欄位／狀態及稽核流程 |
| pending（出貨） | unprepared | 尚未開始處理 |
| processing | preparing | 製作／備貨中 |
| shipped | shipped | 可直接對應 |
| completed | delivered | 需先確認舊 UI「完成」是否代表顧客已收貨 |

**注意**：退款不是單純 UI 文字映射。建議新增退款獨立欄位／退款紀錄，或在經核准的 schema change 中增加明確的 refunded 狀態及退款時間、金額、操作者、原因。不得把退款記錄簡化成改一個字串。

### 1.5 查詢資料量限制

本次 distinct status 統計查詢回傳空集合；因此本報告不推定目前有任何特定舊狀態資料，也不推定資料表一定沒有訂單。以上狀態字典以 schema CHECK constraint 為準。

## 2. 正式切換前管理者外部 Caller 確認表

以下控制台無法由 PostgreSQL metadata 或 GitHub 程式搜尋完整代替。請由具備管理權限的人員逐項查看，僅記錄「存在／不存在／不確定」，不要複製 secret、token、客戶資料或完整 URL。

### A. Supabase Dashboard
- [ ] Edge Functions：記錄 line-customer-notify、line-payment-notify、merch-payment-sync、line-order-notify、line-payment-order-notify 的 active version、verify_jwt、最近部署時間。
- [ ] Edge Functions Logs：查明這些 Function 是否有外部呼叫及呼叫來源；空 log 不可視為沒有 caller。
- [ ] Database Webhooks：確認 orders、merch_orders、cooling_pickup_orders、radish_orders 是否有 webhook。
- [ ] Cron／Integrations／排程：確認有無第三方排程或 Dashboard 建立的工作。
- [ ] Storage：確認付款證明 bucket、private/public、allowed MIME、size limit、object policies。
- [ ] API Settings：確認 exposed schema；不更改設定。

### B. LINE Developers／官方帳號
- [ ] Messaging API webhook URL 對應哪個 Function。
- [ ] 是否有第三方平台轉發訂單、付款或出貨事件。
- [ ] 是否有管理員工具、LINE Bot 後台或手機捷徑直接呼叫通知 Function。
- [ ] 是否有出貨通知由人工操作觸發。
- [ ] 不在回報或截圖中顯示 Channel Secret、Access Token、簽章密鑰。

### C. 外部主機與自動化
- [ ] GitHub Actions／CI workflows。
- [ ] Vercel／Netlify／Cloudflare／自架主機 API routes、環境變數名稱。
- [ ] Zapier／Make／n8n／Pipedream／自建 cron。
- [ ] 物流商 webhook／callback。
- [ ] 外部表單、管理員工具、其他 GitHub repositories。
- [ ] 其他 Supabase 專案或正式部署舊版網頁。

### 回報格式
| 系統／控制台 | Function | 用途 | 是否仍使用 | 最近使用日期 | 確認人 |
|---|---|---|---|---|---|
| 例：物流商後台 | line-customer-notify | 出貨 LINE 通知 | 未確認 | 未確認 | 待填 |

未回報項目一律維持「未確認」，不可推定無 caller。所有未知 caller 確認前，不停用 Function、不撤銷舊 RPC、不刪除舊 token 欄位。

## 3. 出貨 Token Lifecycle Patch 草案（不執行）

### 3.1 建議新增欄位

在 `public.orders` 增加（具體型別與命名仍待 patch review）：
- `shipment_notify_token_hash`：只存 digest，不存原始 token。
- `shipment_notify_token_expires_at`：到期時間。
- `shipment_notify_token_consumed_at`：成功消耗時間。
- `shipment_notify_token_revoked_at`：撤銷時間。
- `shipment_notify_event_id`：冪等事件識別。
- `shipment_notify_token_version`：輪替版本。

舊欄位 `shipment_notify_token` 在遷移窗口保留，不能直接刪除或將舊明文 token 自動當成新 hash token。

### 3.2 發 token 與驗證流程

1. 可信任後端確認訂單已進入可通知的出貨狀態。
2. 以 CSPRNG 產生至少 32 bytes 隨機 token；只在可信任服務端短暫持有原文。
3. 將 token digest、order_id、event_id、expiry、version 寫入 DB。
4. 內部呼叫使用 HMAC-SHA-256 簽署 envelope：HTTP method、固定 path、timestamp、event_id、order_id、token digest／token；使用固定 canonical serialization。
5. Edge Function 驗證 HMAC（constant-time compare）、timestamp skew、event_id、method、path。
6. 私有 schema 的 RPC 在單一 transaction 內 SELECT ... FOR UPDATE，驗證 order_id、digest、expiry、revoked、consumed、event_id 與出貨狀態。
7. 同一交易建立唯一 notification event 並消耗 token；以 UNIQUE(event_id) 或等效唯一鍵處理併發重送。
8. RPC 回傳 DB 已驗證的 recipient、order_number、pickup_type、pickup_store；Function 忽略 body 同名欄位。
9. LINE 推播以 event_id 記錄結果；LINE 暫時失敗時重試同一 event，不重新簽發或重複消耗 token。

### 3.3 RPC 權限原則

- 優先使用非 exposed schema。
- SECURITY DEFINER 只有在確實需要跨越 RLS 的最小內部用途才採用；固定 search_path、限定 schema/table/function。
- 函式內驗證可信 caller；不能只依賴 function 名稱隱藏。
- 撤銷 PUBLIC／anon／authenticated 的 EXECUTE 必須等所有 caller 遷移及隔離測試通過後再做。
- 不允許客戶端直接取得原始 token、hash 或管理員簽章 secret。

### 3.4 回滾原則

- 新欄位採 additive migration，不刪舊欄位。
- 新 Function 使用新名稱／版本，不直接覆蓋舊 Function。
- 切換期間保留舊流程，但不將舊 token 自動升級為新 token。
- 回滾只切回舊 caller 路由；不可將 hash 還原成原始 token。
- 舊 RPC grants／欄位退場另開變更單，完成外部 caller 確認後再審核。

## 4. 周邊商品付款證明 Patch 草案（不執行）

### 4.1 Bucket／上傳
- 使用專用 private bucket（建議 `merch-payment-proofs`），不要與商品圖片 bucket 共用。
- server 端確認 order_number／order_id、付款狀態與訂單仍可付款。
- server 產生不可猜測且 order-bound 的 object path；禁止客戶自行傳入其他訂單 path。
- 允許 MIME 僅 JPEG／PNG／WebP（是否允許 PDF 需老闆確認）；設定合理檔案大小上限。
- 不開 public bucket，不允許 overwrite；檔名不含姓名、電話或訂單個資。
- 使用 server-side signed upload capability 或自有短效 capability。Supabase signed upload URL 官方文件指出其有效期為 2 小時；若業務要求更短時效，需另以 server capability／finalize expiry 限制，不能誤稱 Storage signed URL 可自訂為 10 分鐘。
- Storage private object 讀取只由授權後台取得短效 signed URL；signed URL 生成後在有效期內可使用，故應採最短可用有效時間。

### 4.2 Finalize API
- 客戶上傳完成後呼叫 finalize。
- server 驗證 capability、order binding、object path、object exists、MIME、size、expiry、single-use 與 event_id。
- 成功後只寫入 private storage path（不要寫 public URL），付款狀態轉為 proof_submitted。
- proof_submitted 只代表已提交證明，不代表已確認收款。
- 管理員核對實際入帳後，才轉 confirmed。
- 同一 event_id 重送回傳同一結果，不重複建立通知。
- 未 finalize 的孤兒檔案需有安全清理流程與保留期限。

### 4.3 Admin
- merch-admin.html 與 merch-admin-v2.html 需先確認正式使用入口，再決定共用哪個管理頁。
- 後台只有具付款核對權限的管理員可產生 proof signed URL。
- 管理員確認入帳時需記錄操作者、時間、原狀態、新狀態及核款依據。
- 個資刪除／訂單保留政策需定義證明檔案同步刪除或封存；不可只清欄位留下孤兒物件。

### 4.4 狀態相容修補
- UI 的待付款映射到 DB unpaid。
- UI 的已付款映射到 DB confirmed，且僅管理員核款操作可執行。
- UI 不得直接寫 pending／paid／refunded 到 payment_status。
- 退款流程先確認會計與客服規則，再決定獨立 refund table 或欄位；不可偷偷擴大 CHECK constraint。
- shipment_status UI 必須使用 DB 允許值 unprepared／preparing／shipped／delivered，並確認「完成」與「已送達」語意。

## 5. 建議逐檔 Patch 清單

| 檔案／物件 | 修改目的 | 依賴／阻擋 |
|---|---|---|
| 新 migration：orders token metadata | 新增 hash／expiry／consumed／revoked／event／version | 需確認 caller 與 rollback |
| 新 private schema RPC | 原子驗證／消耗 token，建立通知 event | 需確認 schema、owner、grants |
| 新版 line-customer-notify | 驗 HMAC、DB 取 recipient／物流資料 | 需確認內外部 caller、LINE 測試 |
| 新 migration：merch proof metadata | 私有 proof path、事件與稽核欄位 | 需確認資料保留政策 |
| 新 Function：merch-proof-capability | 建立訂單綁定上傳能力 | 需驗證訂單與速率限制 |
| 新 Function：merch-proof-finalize | 驗 object 並更新 proof_submitted | 需原子交易與重播防護 |
| 新版 merch.html | 增加付款證明選擇／上傳／送出狀態 | 保留舊 checkout 相容 |
| merch-admin.html | 狀態值修正、signed URL 檢視、核款紀錄 | 確認正式後台入口 |
| merch-admin-v2.html | 與主要後台合併或明確標示唯讀 | 確認是否仍有人使用 |
| 通知 Function | 單一官方 proof_submitted 通知入口 | caller inventory 完成前不可停用舊入口 |

## 6. 必須通過的驗收

### Token
- HMAC 正確／錯誤、timestamp 過期、method/path 不符。
- token 對錯訂單、到期、消耗、撤銷。
- 兩個併發請求只建立一筆 event。
- LINE timeout 重試不重複通知。
- request body 偽造 recipient／order／門市全部忽略。
- 未綁定 LINE recipient 不推播。
- logs 不包含 token、digest、LINE recipient 或顧客個資。

### 付款證明
- 未授權、過期、重播 capability 拒絕。
- path 跨訂單、MIME 不符、檔案過大、空檔拒絕。
- object 不存在時 finalize 拒絕。
- finalize 成功只進 proof_submitted，不得自動 confirmed。
- 重複 event_id 不重複通知。
- 非付款管理員不能取得 signed URL 或確認付款。
- 舊訂單 NULL proof path 正常相容。
- 個資刪除／資料保留流程與 Storage object 同步。

### 後台狀態
- payment_status 只能送 DB CHECK 允許值。
- shipment_status 只能送 DB CHECK 允許值。
- 未確認的退款語意不可用 paid/refunded 字串猜測。
- 失敗時 UI 顯示具體錯誤，不假報更新成功。

## 7. 本階段執行範圍與限制

- 讀取 merch_orders／orders 的欄位 metadata 與 CHECK／UNIQUE constraints。
- 查詢 distinct 狀態聚合結果為空集合；沒有推定資料列數或舊狀態分布。
- 讀取 Supabase Storage 官方文件：private bucket 檔案需經授權下載或短效 signed URL；JavaScript createSignedUploadUrl 文件說明 signed upload URL 有效 2 小時。
- 沒有讀取客戶訂單列、個資、付款證明物件、token 值或 LINE recipient。
- 沒有執行任何 INSERT／UPDATE／DELETE／DDL／GRANT／RLS 修改。
- 沒有部署 Edge Function、修改 Secrets、呼叫 LINE、上傳檔案或覆蓋官網。
- 本文件及 patch 清單均為草案，不可直接複製到正式環境執行。

## 8. 下一階段 Phase 24

1. 逐一確認 merch-admin.html 與 merch-admin-v2.html 的實際使用入口與操作者。
2. 補齊 shipment token 發出端及所有出貨 caller 的證據；Dashboard 外部 caller 仍待管理者回報。
3. 在本機加入 Node crypto HMAC 真實測試：簽章正確、錯誤、timestamp skew、canonical payload tampering。
4. 製作不連正式 DB 的 merch proof upload state fixtures，測試 capability expiry、order binding、single-use、finalize idempotency。
5. 產出逐檔可審閱 diff、測試命令、部署前備份／回滾清單；仍不部署、不改正式環境。
