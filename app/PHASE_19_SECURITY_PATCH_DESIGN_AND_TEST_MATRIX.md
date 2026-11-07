# Phase 19｜付款證明／通知／出貨安全修補方案與驗收矩陣

日期：2026-11-08  
分支：app/phase-1-planning  
性質：修補規格、程式差異設計、測試矩陣；不部署、不執行正式 SQL。

> 本文件是可供下一階段實作的 patch design，不是已套用的 migration 或 Function source。正式環境保持唯讀。caller 未知、付款證明上傳端點未找到等項目仍是上線阻擋條件。

## 1. 本階段結論

已把 Phase 12–18 的 P0/P1 風險整理成五個修補工作包：

| 工作包 | 優先級 | 修補目標 | 能否直接上正式環境 |
|---|---|---|---|
| A. transfer-proofs 上傳授權 | P0 | 移除匿名任意上傳，訂單綁定、短效授權、檔案限制 | 否；需先確認真實上傳 caller |
| B. 周邊商品付款通知 | P0 | 封鎖未授權 order_id 觸發、統一 proof_submitted 語意、冪等 | 否；caller 未確認 |
| C. 涼糕／冷藏寄放通知 | P0 | 可信內部事件、移除固定 secret、正確付款語意 | 否；需 caller 相容遷移 |
| D. 顧客出貨通知 | P1 | token 驗證後由 DB 讀取 recipient 與所有顯示欄位 | 否；需先定義 shipment token lifecycle |
| E. RPC／trigger 權限收斂 | P0 | 私有 payload 與旗標操作只讓可信服務端執行 | 否；需所有 caller 完整盤點 |

## 2. 工作包 A｜transfer-proofs 私人付款證明上傳

### 2.1 現況證據
- Bucket：`transfer-proofs`，private。
- 匿名與 authenticated INSERT policy 只檢查 bucket_id 與 `proof/` prefix。
- bucket size limit、allowed MIME types 均未設定。
- 本輪查詢時 bucket object count 為 0。
- `orders.transfer_proof_path` 與 `submit_customer_payment(uuid,text,text)` 存在；RPC source 未見檔案存在性、訂單授權或上傳授權檢查。
- 已檢查的主要結帳頁未找到此 bucket 的實際 upload caller；周邊商品 `payment_proof_url` 上傳 caller 也未找到。

### 2.2 目標流程（建議）
1. 客戶建立訂單後，使用訂單建立時發出的高熵 guest capability，或已登入會員的本人身份，請求付款證明上傳授權。
2. 後端驗證訂單存在、尚可提交付款資料、guest capability 有效且未過期；會員流程則驗證訂單 ownership。
3. 後端產生不可由客戶指定的 object path，綁定 order_id、用途、允許 MIME、最大 bytes、到期時間及一次性 nonce。
4. 透過短效 signed upload URL 或受控上傳端點上傳到 private bucket。不可將 service_role key 放入瀏覽器。
5. 上傳完成後，後端檢查 object metadata（bucket、path、size、MIME、時間、nonce、訂單綁定），再呼叫內部付款證明提交程序。
6. 付款狀態只轉成 `proof_submitted`；不得由客戶端把狀態設成 paid／confirmed。
7. 管理員使用登入後授權取得短效 signed download URL 查看證明；不得把 bucket 改成 public。
8. 重複上傳策略明確化：每筆訂單每次提交使用不同 object key；新證明替換舊證明須保留稽核紀錄，不允許客戶端任意 upsert 覆蓋。

### 2.3 需新增／調整的程式差異（設計，不是可執行 SQL）
- 移除目前 `customer_upload_transfer_proof` 的 anon INSERT 開放策略；但必須在新上傳流程完成整合測試後才撤除。
- 增加私有授權紀錄（建議欄位）：`id`、`order_id`、`token_hash` 或 nonce hash、`object_path`、`expected_mime`、`max_bytes`、`expires_at`、`consumed_at`、`created_at`。
- 授權 token 僅保存 hash；高熵、短效、限次；不得放在公開 URL query string 或 log。
- Storage bucket 限制需先依實際接受格式與手機照片大小定案，再設定 max file size 與 allowlist（初步候選 image/jpeg、image/png、image/webp；HEIC 是否接受待實機與後端解碼能力驗證）。
- 前端只負責選檔與顯示進度；後端才是授權、檔案路徑與付款狀態權威。
- private bucket 管理員檢視使用 Authenticated JWT + SELECT policy，或管理後端簽發短效 signed URL；禁止永久公開連結。

### 2.4 上線阻擋條件
- 找不到真實付款證明上傳頁面／App caller。
- 尚未確認訪客訂單短效授權如何安全交付給顧客。
- 未測試 iPhone HEIC／JPEG／PNG、Android 相片、超大檔案及錯誤 MIME。
- 未確認管理員後台查看憑證的流程與歷史 path 相容性。

## 3. 工作包 B｜周邊商品付款通知

### 3.1 現況
- `line-payment-notify` v4、`merch-payment-sync` v3 均 ACTIVE、verify_jwt=false。
- source 接受 body.order_id，使用 service_role 查 merch_orders、items 與管理員 LINE recipients；source 未見內部認證。
- 兩支 Function 功能高度重疊；已檢查 DB trigger／官網頁面未找到 caller，外部 caller 未排除。
- `payment_status='proof_submitted'` 的訊息仍使用「付款完成」文案。
- `payment_notification_sent` 布林旗標無法完整代表每位 recipient、每次 event 的發送結果；重試／部分失敗需重新設計。

### 3.2 目標事件契約
內部事件只包含最小必要欄位：
- `event_id`：唯一 UUID／高熵識別。
- `event_type`：`merch_payment_proof_submitted` 或 `merch_payment_confirmed`。
- `order_id`：內部識別。
- `issued_at`：UTC timestamp。
- `key_version`：簽章版本。
- 簽章：HMAC-SHA-256 覆蓋固定 canonical payload；驗證時間窗、nonce／event_id 與 constant-time compare。

不得從 request body 接受客戶姓名、電話、收件資料、recipient、商品明細、付款狀態等通知內容；這些由後端根據 order_id 查詢，並依 event_type 決定可用欄位。

### 3.3 Function 差異設計
- 先選定唯一正式 Function；另一支在 caller 完整確認前保留但不再新增 caller。
- 新 Function handler 必須先驗證內部事件簽章與時間窗，再查資料庫；未授權請求不得查詢 payload 或呼叫 LINE。
- 使用事件紀錄／outbox 做原子 claim；unique(event_id)；記錄每位 recipient 的 queued／sent／failed 狀態與 LINE response code。
- proof_submitted 訊息標示「已收到匯款資料，待老爹核對」，不可用「付款完成／已付款」。
- 僅在管理員核款後產生 payment_confirmed 事件，才可發送「已確認入帳」。
- LINE 部分失敗時只重試失敗 recipient；不得重新發送成功 recipient。
- 不將 LINE access token、內部 HMAC secret 或 service role key 寫入 GitHub、SQL 明文或回應 body。

## 4. 工作包 C｜涼糕新單／付款與冷藏寄放通知

### 4.1 已知 caller
- orders INSERT trigger → notify_line_on_new_order() → line-order-send-v2。
- orders payment fields trigger → notify_line_on_payment_proof() → line-order-payment-send-v2。
- cooling_pickup_orders trigger → notify_line_on_cooling_order_payment() → cooling-order-line-notify。

### 4.2 差異設計
- trigger 不再包含長期明文 secret；改為可信內部事件傳遞。若選擇 signed envelope，secret 只能放在受控 Secrets，並設計 key_version 雙 key 過渡。
- 新單通知只提供管理員處理訂單所需最小欄位；匯款末五碼、完整地址、完整電話預設不放入一般通知，需查看時由登入後台。
- 付款證明提交事件與付款確認事件分開。
- 冷藏寄放 payment_last5 非空只可觸發「收到付款資料／待核款」，不得表示已付款。
- 事件 idempotency key 建議由來源表、record id、event type 與版本組成，並確保同一狀態更新不重複發送。
- trigger／Function 需先部署相容版本，caller 切換完成並驗證後才可撤銷舊 secret／RPC grants。

## 5. 工作包 D｜顧客出貨通知

### 現況
`line-customer-notify` 驗證 `verify_shipment_notify_token(order_id, token)`，但仍信任 request body 的 recipient、order_number、pickup_type、pickup_store 等內容。

### 目標差異
- token 驗證成功後，以 order_id 由 DB 取得 LINE recipient、order_number、shipment status、delivery method、store name。
- request body 只允許 `order_id`、`notify_token`、必要的 event_id；忽略或拒絕任何 recipient／門市／物流方式／訂單號欄位。
- token 採高熵、hash storage、有效期限、單次或事件範圍使用；成功通知後記錄已使用 event，避免重播。
- token 與 LINE recipient 必須在同一訂單關聯中驗證；不得只因 token 正確就接受客戶提供其他訂單顯示資料。
- 如果顧客尚未綁定 LINE，應回傳可稽核的 skipped 狀態，不可將訊息推送到 body 提供的任意 LINE user id。

## 6. 工作包 E｜RPC 權限與 trigger 收斂

| 物件 | 目標權限／行為 | 前置條件 |
|---|---|---|
| get_line_order_notification_payload(uuid) | 僅可信後端取得最小化 payload | 所有 Function／trigger caller 已切換 |
| get_cooling_order_line_notification_payload(bigint) | 同上，不再由 publishable key 作內部信任 | cooling Function 已改為受控服務端 |
| mark_line_payment_notification_sent(uuid) | 移除 anon／authenticated 直接執行；由 event/outbox 原子記錄 | 所有呼叫者確認 |
| submit_customer_payment(uuid,text,text) | 會員 ownership 或 guest capability；只可提交 proof_submitted | 新舊付款頁 adapter 已驗證 |
| verify_shipment_notify_token(uuid,text) | 僅通知 Function 可使用，且需避免可被一般角色用作 token oracle | 出貨通知 token lifecycle 定案 |
| notify_line_on_* trigger functions | 不在 trigger source 保留固定明文密鑰 | 內部事件方案與 retry 完成 |

注意：不得在 caller 未完整盤點前直接 REVOKE 或修改 trigger；否則可能造成訂單成立但無通知、付款資料無法提交、出貨通知失效。

## 7. 具體測試矩陣

### 7.1 Storage／付款證明
| ID | 測試 | 預期結果 |
|---|---|---|
| STO-01 | anon 直接 INSERT transfer-proofs | 拒絕 |
| STO-02 | 未授權 order_id 取得 upload capability | 拒絕，無可用 path |
| STO-03 | Guest capability 過期／重用 | 拒絕 |
| STO-04 | 會員嘗試上傳他人訂單 | 拒絕 |
| STO-05 | 偽造 object path／跨訂單 path | 拒絕 |
| STO-06 | 超過 max bytes | 拒絕 |
| STO-07 | MIME 與實際內容不符 | 拒絕 |
| STO-08 | JPEG／PNG／WebP 手機照片 | 按已核准 allowlist 成功 |
| STO-09 | HEIC 上傳 | 依明確支援策略成功或清楚拒絕 |
| STO-10 | 未登入讀取 private object | 拒絕 |
| STO-11 | 管理員登入取得短效 signed URL | 可讀取，過期後失效 |
| STO-12 | 顧客提交不存在的 object path | 拒絕，不改付款狀態 |
| PAY-01 | 提交末五碼／證明 | 只成為 proof_submitted |
| PAY-02 | 客戶端嘗試傳 paid／confirmed | 忽略或拒絕 |
| PAY-03 | 管理員核款 | 產生唯一 payment_confirmed event |

### 7.2 通知／出貨
| ID | 測試 | 預期結果 |
|---|---|---|
| NTF-01 | 無簽章／錯誤簽章 | 401／403；不得查 payload |
| NTF-02 | 過期 timestamp | 拒絕 |
| NTF-03 | 重播 event_id／nonce | 不重複推播 |
| NTF-04 | proof_submitted event | 只顯示待核款 |
| NTF-05 | payment_confirmed event | 才顯示已確認入帳 |
| NTF-06 | LINE API 部分 recipient 失敗 | 只重試失敗 recipient |
| NTF-07 | 同一事件併發處理 | 僅一個 worker 成功 claim |
| NTF-08 | request body 偽造 customer／recipient | 以 DB 驗證欄位為準或拒絕 |
| SHP-01 | 有效出貨 token + 正確訂單 | DB recipient／物流資料通知 |
| SHP-02 | 有效 token + 偽造 recipient／store | 不使用偽造欄位 |
| SHP-03 | 過期／重用 shipment token | 拒絕 |
| SHP-04 | 未綁定 LINE recipient | 安全 skipped，不推送 body recipient |

### 7.3 RPC／官網相容性
| ID | 測試 | 預期結果 |
|---|---|---|
| RPC-01 | anon 呼叫 payload RPC | permission denied |
| RPC-02 | authenticated 非管理員呼叫 payload RPC | permission denied |
| RPC-03 | 舊版官網 create_cooling_pickup_order | 過渡 adapter 保持建單 |
| RPC-04 | 舊版官網 create_customer_order | 送到府建單成功 |
| RPC-05 | radish create_radish_delivery_order | 蘿蔔糕冷凍物流流程成功 |
| RPC-06 | guest payment capability | 只能提交本人訂單付款資料 |
| RPC-07 | admin 後台查看付款證明 | 可授權查看，非管理員拒絕 |
| RPC-08 | trigger 重試／網路超時 | 不漏通知、不重複通知 |
| RPC-09 | Function 舊／新 key 雙 key 窗口 | 切換期間合法 caller 持續成功 |
| RPC-10 | 舊 key 撤銷後 | 新 caller 正常，舊 caller 拒絕 |

## 8. 上線前 caller 封鎖清單（必須逐項解決）

- [ ] transfer-proofs 目前實際上傳端點與所有 caller。
- [ ] merch_orders.payment_proof_url 的寫入來源、App／官網／第三方表單。
- [ ] line-payment-notify、merch-payment-sync 的外部／Dashboard／cron／webhook caller。
- [ ] line-order-notify、line-payment-order-notify 的舊版／外部 caller。
- [ ] line-customer-notify shipment token 的產生、傳遞、失效與重試來源。
- [ ] 所有 DB trigger、pg_net／cron／webhook、外部自動化的完整依賴圖。
- [ ] 舊官網所有版本與部署中靜態檔的 caller 相容。
- [ ] 管理員 LINE recipient 綁定流程已改成既有管理員核准／一次性邀請，不依賴公開文字指令。

只要任何 caller 仍未知，就不能移除對應 Function、RPC 或 Storage policy。

## 9. 備份與回復方案

正式變更前必須：
1. 匯出受影響 function definitions、trigger definitions、RPC signatures、EXECUTE ACL、Storage policies、bucket configuration。
2. 保存目前所有 Edge Function source、active version、verify_jwt 與依賴清單。
3. 建立可還原 DB 備份並驗證還原權限；不要將客戶付款圖片複製到 GitHub。
4. 記錄官網目前部署 commit／靜態頁版本。
5. Secrets 僅記錄名稱、用途、版本、輪替狀態；不記錄值。
6. 先部署相容新端點，再遷移 caller，最後收斂舊入口。
7. 回復時按 caller dependency graph 成組回復；不得回復到已知可匿名讀取個資或匿名任意上傳的漏洞版本。
8. 每一批變更後執行本文件測試矩陣及訂單建立 smoke test。

## 10. 免費驗證路徑

- 本機 Node.js：純函式、HMAC canonical payload、timestamp、nonce、idempotency、狀態語意測試。
- 本機 Supabase CLI／Docker：僅在使用者現有設備可用且不產生額外費用時，建立 disposable local test stack；本階段未啟動。
- 固定 fixtures：使用虛構訂單、虛構電話、虛構 LINE user id；不得匯出正式顧客資料。
- Storage integration：本機測試 bucket、policy、upload／download、signed URL 到期與 MIME／size。
- 不建立付費 Supabase branch、不開新付費服務、不使用正式 LINE 群組測試。
- 任何隔離環境或付費需求先告知費用並取得同意。

## 11. Supabase 官方文件參考

- Storage Buckets： https://supabase.com/docs/guides/storage/buckets/fundamentals
- Storage Access Control： https://supabase.com/docs/guides/storage/security/access-control
- Edge Function Authorization headers： https://supabase.com/docs/guides/functions/auth-headers
- Securing Edge Functions： https://supabase.com/docs/guides/functions/auth

本設計依目前官方文件：private bucket 的讀取仍受 RLS 控制；短效 signed URL 可用於受控下載；Storage upload 仍需 INSERT policy；服務端呼叫可使用專用 secret key 或簽章驗證。正式實作前需再次核對最新文件與專案目前 API key 模式。

## 12. 本階段狀態

| 項目 | 狀態 |
|---|---|
| 五個修補工作包 | 已整理 |
| Storage 上傳目標流程 | 已設計 |
| 周邊商品通知事件契約 | 已設計 |
| 涼糕／冷藏寄放通知修補 | 已設計 |
| 顧客出貨通知修補 | 已設計 |
| RPC／trigger 權限收斂順序 | 已設計 |
| 測試矩陣 | 已列出 |
| 備份／回復計畫 | 已列出 |
| 最終可部署 SQL／Function patch | 未完成，caller 與付款上傳端點仍未知 |
| 本機整合測試 | 未執行 |
| 正式環境變更 | 未執行，維持唯讀 |

### 下一階段
Phase 20：只讀追查剩餘未知 caller 與 token lifecycle；優先查 pg_net／pg_cron／Database Webhooks、所有 RPC 定義與 merch_orders/payment_proof_url 的寫入路徑。caller 完整後，才可產生逐檔完整 patch diff 與本機測試 fixtures。
