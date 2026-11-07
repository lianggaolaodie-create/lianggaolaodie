# Phase 68｜Staging Readiness、Auth／API 架構與正式上線閘門

日期：2026-11-08  
分支：`app/phase-1-planning`  
狀態：架構決策草案／上線準備文件；不是部署完成。

## 1. 本階段目的與邊界

把 Phase 65–67 的 API 契約與 HTTP mock，整理成可安全進入隔離測試環境的方案。此文件不代表已建立 staging、已啟用 Auth、已部署 Edge Function 或已修補正式 RLS。

**本階段沒有執行：**
- 建立 Supabase project／branch、啟用付費方案或任何會產生費用的服務。
- 正式 Supabase DDL、DML、migration、RLS、GRANT、RPC 或 Function 變更。
- 修改 Secrets、正式官網、正式訂單、會員資料、金流或物流設定。
- 將 Phase 67 mock server 公開部署。

正式環境保持唯讀。所有正式變更必須有獨立變更清單與明確核准。

## 2. 建議環境拓樸

| 環境 | 用途 | 資料 | 連線規則 |
|---|---|---|---|
| Local／CI | 單元、契約、mock HTTP 測試 | 固定合成 fixtures | 不讀取 Supabase |
| Staging | Auth、RLS、Edge Function、官網/App 整合測試 | 全新合成資料 | 獨立 Supabase project；不得複製正式個資 |
| Production | 正式官網與未來 App | 正式資料 | 只在核准變更窗口操作 |

### 隔離要求
1. Staging 必須是獨立 project，不能把 production URL、anon key、service-role key 或資料庫密碼帶入 staging。
2. Staging 使用獨立 Auth 使用者、Storage bucket、Function secrets、Webhook URL、LINE 測試帳號與付款 sandbox。
3. Staging 通知只能送到測試收件端；禁止誤發顧客 LINE／Email／SMS／Push。
4. Staging 不匯入真實會員、地址、電話、訂單、匯款證明或正式 token。
5. GitHub Actions 預設只跑本地 mock。未設定隔離環境與人工核准前，不得執行 staging integration job。
6. 建立 staging 前先確認 Supabase 當前方案、專案數限制、暫停政策及可能費用；若有新增費用，先取得使用者同意。不得以 production branch 代替隔離 project。

## 3. 環境變數命名清單（只列名稱，不放值）

### 共用／前端可公開
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `PUBLIC_API_BASE_URL`
- `PUBLIC_APP_ENV`

以上公開值只可指向目前 build 對應環境；anon key 不是授權邊界，仍必須由 RLS 保護。

### 僅伺服器端／CI Secrets
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`
- `AUTH_ADMIN_SECRET`（若實際架構需要）
- `PAYMENT_PROVIDER_SECRET`
- `PAYMENT_WEBHOOK_SECRET`
- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `EMAIL_PROVIDER_API_KEY`
- `SMS_PROVIDER_API_KEY`
- `STORAGE_PRIVATE_BUCKET`

**禁止事項：** service-role、資料庫密碼、金流／LINE／Email／SMS secret 不得進入前端 bundle、Git、HTML、測試 fixture、issue 或 log。每個環境使用不同 secret；洩漏時先撤銷／輪替，再調查使用紀錄。

## 4. Auth 建議

### 顧客
- 優先以 Supabase Auth 作為唯一會員身份來源，官網與 App 共用同一 Auth project（正式切換須另行核准）。
- 第一版可先評估 Email magic link／Email OTP，避免未確認成本前啟用手機簡訊 OTP；SMS 供應商與費率確認後再決定。
- 訪客結帳與會員登入分開。訪客訂單查詢使用高熵 claim token、期限與撤銷；資料庫只保存 token hash，不以訂單編號單獨授權。
- 會員查詢只能由 Auth subject 對應的 owner identity 讀取本人訂單；不得信任前端傳入 member_id。
- 登出、session 到期、帳號停用、Email 更換與訂單認領均需測試。

### 老闆／管理員
- 管理後台使用獨立受控入口，不接受僅靠前端隱藏按鈕。
- 管理角色由可信資料庫／後端驗證；重要操作採 MFA／重新驗證與稽核。
- 個資管理、付款核對、商品管理、訂單履約權限分離。
- 管理員不能因為能看個資，就自動取得改付款或出貨權限。
- MFA 可用性與方案限制需在 staging 實測；未確認前不得宣稱已啟用。

## 5. API hosting 建議

### 暫定首選：Supabase Edge Functions 作為受控 API 層
理由：
- 現有資料與 Auth 已在 Supabase，能減少額外主機與資料庫憑證管理面。
- 可集中實作 quote、checkout authorization、會員／訪客訂單查詢、後台管理等 API。
- 可在 server-side 驗證身份、角色、價格、配送費、版本、冪等鍵，再執行受控資料庫操作。

### 必要設計
1. 前端只呼叫公開 API；不得直接以高權限 key 寫入受保護資料表。
2. 每支 Function 明確定義 JWT／呼叫者驗證、角色、輸入 schema、速率限制、CORS allowlist、request ID、錯誤遮罩與稽核。
3. Service-role 僅限最少數 server-side Function 使用；每支 Function 必須自行完成身份與資源授權，不能把 service-role 當作授權。
4. 金額與運費由後端可信資料重新計算；前端 quote 僅供顯示，結帳時再次驗證。
5. 訂單建立必須具備資料庫交易、唯一冪等鍵、庫存／開單競爭處理與完整 audit。
6. 通知走 outbox／背景處理；通知失敗不能把已成立訂單回滾成未成立。
7. 若後續需要長時間工作、複雜排程或獨立擴充，再評估獨立 API 主機；目前不先增加另一個付費服務。

Phase 67 HTTP mock 是契約測試工具，沒有真實 Auth／DB adapter，禁止直接公開部署。

## 6. 已知 RLS／權限風險修補順序（只規劃，不執行）

### P0：先封住可被一般帳號利用的寫入／個資面
1. `merch_products`、`merch_categories` 的 authenticated permissive ALL policy（USING true／WITH CHECK true）需先確認有效 grants、所有政策及舊官網依賴，再移除寬鬆政策並建立明確管理 predicate。
2. 核對 LINE 訂單個資 payload RPC：匿名／一般會員不得讀取不屬於自己的完整個資。
3. 核對付款通知旗標 RPC：只允許可信 server-side 呼叫者；不可讓一般登入使用者任意觸發。
4. 逐支審查使用 service_role 的通知 Edge Functions，確認 JWT、角色、Webhook signature、payload 來源與重播防護。
5. 移除程式碼內固定密鑰；先輪替，再安全更新各環境 secrets。
6. 通知收件人與個資必須由後端根據訂單查詢，不信任前端傳入 payload。

### P1：角色一致性與資料隔離
1. 對齊 `admin-products.html` 前端允許角色與 flavors／daily tables 的 RLS predicate。
2. 定義 super_admin、product_admin、order_admin、payment_admin、personal_data_admin 的最小權限。
3. 測試會員 A 不能讀取會員 B 訂單；訪客 claim 失效、撤銷與過期後不可再查。
4. 對每個管理 API 做允許角色與拒絕角色雙向測試。

### P2：函式、Storage 與其他安全設定
1. 對 SECURITY DEFINER functions 逐支檢查 owner、search_path、輸入驗證、資料範圍與呼叫者授權；不可批次撤銷所有 EXECUTE。
2. 修正 mutable search_path，明確限定可信 schema。
3. LINE webhook 驗證 HMAC、event ID 去重與重播。
4. 匯款憑證 bucket 驗證 MIME、大小、路徑、覆寫及私有讀取。
5. 對無 policy 的 LINE binding／notification tables 查明用途、grants、API exposure，再決定策略。
6. 評估並啟用 leaked password protection；先確認 Auth 設定影響與使用者溝通方式。

### 修補驗收原則
每一項需有：修補前 policy／grant snapshot、精確 SQL、正向測試、負向測試、官網回歸、備份點、rollback SQL、執行人與核准記錄。不可只因 CI mock 通過就視為正式安全修補完成。

## 7. Staging 測試資料與測試矩陣

只建立不含真實個資的 fixtures：
- 兩名顧客會員 A／B。
- 一個訪客 claim token（含有效、過期、撤銷案例）。
- 一個 super_admin、商品管理員、訂單管理員、付款管理員、個資管理員。
- 涼糕餐車場次（含價格）與擺攤場次（公開 payload 不含價格）。
- 蘿蔔糕冷凍店到店、冷凍宅配兩種配送。
- 待付款、付款證明待審、已付款、已取消、待出貨、已送達等合成訂單。
- 不同版本價格、停用口味、售完、開單關閉、配送區域不支援案例。

| 測試面向 | 必測情境 | 通過條件 |
|---|---|---|
| Auth | 未登入、過期 session、會員 A／B | 未授權請求拒絕；會員只讀本人 |
| Guest | claim 正確／錯誤／過期／撤銷 | 只有有效 claim 可查指定訂單 |
| RLS | anon、authenticated、各管理角色 | 依最小權限允許／拒絕 |
| 商品 | 價格變動、停售、每日快照 | 伺服器使用當下可信資料；歷史訂單不變 |
| 排程 | 餐車／擺攤 | 餐車可顯價；擺攤公開 DTO 不含價格欄位 |
| Checkout | 客戶端改價、重複送出、過期 quote | 伺服器重新報價；冪等且拒絕竄改 |
| 訂單 | 併發、取消、重送 | 不重複建單；狀態合法 |
| 付款 | 假通知、重播 webhook、未核款出貨 | 不可偽造已付款；未付款不可出貨 |
| 通知 | 測試收件人、重試、永久失敗 | 不誤發正式顧客；可追蹤重試 |
| 官網相容 | 舊頁面讀寫、管理端操作 | 既有官網核心流程不退化 |
| Storage | 錯誤 MIME、超大檔、跨會員讀取 | 拒絕不合規檔案與未授權讀取 |

## 8. 回復與事故處理

### 變更前
- 匯出 schema／policy／grant／Function source 與設定快照。
- 確認資料庫備份可用與還原程序；只備份不代表已驗證可還原。
- 記錄目前官網 commit、環境設定版本、Function deployment 版本。
- 設定變更窗口、負責人、監控指標與停止條件。

### 變更後異常
1. 先停止新功能流量／關閉 feature flag，不先刪資料。
2. 回復前端至上一個已驗證版本，保留舊官網入口。
3. Function 回復到上一個已驗證部署版本；確認資料庫相容性後才回復 schema。
4. 若資料已寫入，先評估資料修復腳本與對帳，不以盲目反向 SQL 覆蓋新資料。
5. 檢查訂單、付款、通知 outbox 與物流是否有部分成功；逐筆對帳後再恢復流量。
6. 記錄事故時間、影響範圍、請求 ID、回復步驟與後續修正。

### 必須停止上線的條件
- 會員可讀取他人訂單或個資。
- 一般會員可寫入商品／付款／管理資料。
- 付款未確認卻可出貨，或重複扣款／重複建單。
- 擺攤價格外洩。
- 正式通知誤發至 staging 或 staging 通知誤發給正式顧客。
- 無法回復官網或無法對帳訂單／付款。

## 9. 進入 Staging 的 Go／No-Go 閘門

### Go 前置條件
- [ ] 使用者同意建立獨立 staging project，並已確認費用／方案。
- [ ] Staging 不含正式個資，所有外部服務皆為 sandbox／測試收件端。
- [ ] 各環境 URL／keys／secrets 完全分離。
- [ ] API Auth、角色、RLS、Storage 設計與測試案例備妥。
- [ ] RLS P0 修補 SQL、rollback 與官網相容測試已審閱。
- [ ] 備份與還原程序有可驗證結果。
- [ ] 測試通過，且沒有 P0／P1 未解決安全問題。

### No-Go
上述任一項未完成，就不得連正式官網、正式會員、正式付款或正式訂單。

## 10. 決策紀錄與待核准事項

| 項目 | 暫定建議 | 狀態 |
|---|---|---|
| 測試環境 | 獨立 Supabase project | 待確認費用及使用者核准 |
| API hosting | 優先評估 Supabase Edge Functions | 待 staging 驗證 |
| 顧客登入 | Supabase Auth；先評估 Email OTP／magic link | 待產品決定 |
| 手機簡訊 OTP | 不先啟用 | 待費率與需求確認 |
| 管理員安全 | MFA、最小角色、重新驗證 | 待 staging 實測 |
| 金流 | 僅 sandbox；未選定供應商 | 待確認 |
| 物流 | 先用模擬 provider；未選定正式串接 | 待確認 |
| 正式 RLS／Function 修補 | 先在 staging 驗證 | 未執行，需逐項核准 |

## 11. 本階段驗收結論

- [x] 環境隔離拓樸草案
- [x] 環境變數名稱與 secret 管理規則
- [x] 顧客／管理員 Auth 策略草案
- [x] API hosting 暫定建議與安全要求
- [x] 已知 RLS／Function 風險修補順序
- [x] Staging 合成資料與測試矩陣
- [x] 回復程序與 Go／No-Go 閘門
- [ ] 實際 staging project 建立
- [ ] 真實 Auth／RLS／Function 整合測試
- [ ] 正式環境安全修補與部署

**結論：Phase 68 文件交付完成；尚未進入真實 staging 或 production 串接。**
