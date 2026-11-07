# 老爹．涼糕 App｜全項目一次完成總清單（主控版）

更新日期：2026-11-08  
GitHub 分支：app/phase-1-planning  
狀態：規劃／盤點／原型階段；尚非正式 App。

本文件作為唯一主控清單。後續各階段文件、程式碼與驗收結果都應回填，避免功能遺漏。

## 0. 已確認的範圍與限制

### 本階段要完成
- 顧客 App（iOS、Android）。
- 官方網站持續營運，逐步與 App 共用會員、商品、訂單及出攤資料。
- 老闆專用管理後台（電腦優先、手機可檢視）。
- 涼糕與蘿蔔糕商品、訂購、付款、物流、庫存、餐車／擺攤、會員、行銷、通知及報表整合。

### 明確暫緩
- 員工帳號／員工登入與角色。
- PDA、條碼／QR 掃描器整合。
- 員工揀貨、複核、包裝、出貨工作站。
- 員工現場銷售、員工庫存操作、員工日結。
- 上述功能保留未來擴充設計，不列入本階段交付或驗收。

### 費用及正式環境限制
- 不建立額外按時計費的 Supabase development branch。
- 若未來任何測試環境或第三方服務會產生額外費用，先說明並取得同意。
- 不在正式 Supabase 執行資料庫結構、資料、migration、RLS 或權限變更。
- 不部署或替換正式 Edge Functions，不更改 Secrets，不停用任何現有 Function。
- 不覆蓋、關閉或切換現有官網。
- 正式環境變更須先提供精確變更清單、影響、備份及回復計畫，並取得使用者對該清單的明確核准。

## 1. 目前真實完成狀態

| 工作 | 狀態 | 備註 |
|---|---|---|
| 官網程式碼唯讀盤點 | 已完成一輪 | 仍需完整回歸盤點 |
| Supabase 核心資料表盤點 | 已完成一輪 | 仍需補完整資料字典及關聯 |
| 涼糕建單 RPC 盤點 | 已完成一輪 | 尚未修正 |
| 蘿蔔糕建單 RPC overload 盤點 | 已完成一輪 | 尚未修正 |
| 付款、後台權限與 LINE 安全盤點 | 已完成一輪 | 尚未修正 |
| Storage bucket／部分 policies 盤點 | 已完成一輪 | 尚未修正 |
| 部分 Active Edge Function 原始碼審查 | 已完成一輪 | 尚未逐支完成 |
| 系統架構、整合藍圖與執行計畫 | 已建立 | 規劃文件，不是實作 |
| 顧客端畫面原型 | 已建立初版 | 假資料／原型，非正式串接 |
| 老闆端畫面原型 | 已建立初版 | 假資料／原型，非正式串接 |
| 免費開發與驗證計畫 | 已建立 | 不代表整合測試通過 |
| 正式 App 可安裝／可上架 | 未開始 | 尚未完成 App 工程、簽章與商店審核 |
| 真實會員／付款／物流 API 串接 | 未完成 | 尚待安全驗證 |
| 正式官網與 App 同步 | 未完成 | 尚未切換共用服務 |
| 正式安全修補與部署 | 未開始 | 等隔離測試與核准 |

## 2. 顧客 App（iOS／Android）

### 品牌首頁
- [ ] 品牌首頁與黑金／暖白視覺。
- [ ] 首頁 Banner、公告、活動訊息及後台內容維護。
- [ ] 涼糕、純米涼糕／蘿蔔糕及未來商品分類。
- [ ] 搜尋、商品推薦、客服／聯絡方式。
- [ ] App 版本、服務條款、隱私政策及通知設定入口。

### 商品中心
- [ ] 商品列表、詳情、圖片、規格、口味及說明。
- [ ] 商品分類、上架／下架、停售、售完與可訂購狀態。
- [ ] 涼糕口味、夾心／雙層／單一口味等規格管理。
- [ ] 蘿蔔糕商品、規格、重量／數量與冷凍商品說明。
- [ ] 商品價格、活動價、會員價及有效期間。
- [ ] 商品圖片上傳與安全檢查。
- [ ] 前台只讀取可信後端發布資料，不可自行決定售價。

### 購物與結帳
- [ ] 訪客免註冊購物。
- [ ] 會員登入購物。
- [ ] 購物車新增、刪除、數量修改。
- [ ] 不同商品類型混購時的配送限制與分單規則。
- [ ] 優惠券／活動折扣驗證。
- [ ] 收件人、電話、地址、備註欄位驗證。
- [ ] 下單前重新驗證價格、庫存、開單狀態及配送方式。
- [ ] 建單成功顯示獨立訂單編號與付款／取貨說明。
- [ ] 重複點擊、網路重送不會建立重複訂單。

### 訂單查詢
- [ ] 訂單列表與訂單詳情。
- [ ] 涼糕送到府訂單。
- [ ] 涼糕超商冷藏寄放訂單。
- [ ] 蘿蔔糕冷凍店到店訂單。
- [ ] 蘿蔔糕冷凍宅配訂單。
- [ ] 餐車／現場取貨訂單（僅實際開放時）。
- [ ] 訂單狀態、付款狀態、物流狀態分開顯示。
- [ ] 訂單取消／客服處理規則。
- [ ] 訪客訂單以短效驗證方式查詢，不只憑訂單號公開個資。
- [ ] 歷史訪客訂單只能經本人驗證後認領。

### 會員中心
- [ ] 免費會員註冊、登入、登出。
- [ ] 忘記密碼／重設密碼。
- [ ] Email 或手機驗證方式定案及實作。
- [ ] 會員基本資料與聯絡偏好。
- [ ] 會員訂單紀錄。
- [ ] 收藏商品／收藏市場（若保留此功能）。
- [ ] 會員 QR Code（先作會員識別；現場核銷因員工端暫緩而不啟用）。
- [ ] 會員優惠券、活動資格與使用紀錄。
- [ ] 會員資料匯出／刪除及客服處理流程。
- [ ] 官網與 App 共用同一會員身份。

### 餐車與擺攤資訊
- [ ] 今日／未來行程。
- [ ] 縣市、行政區篩選。
- [ ] 日期、場地／市場名稱、地址及服務時間。
- [ ] 當日販售口味及公開價格。
- [ ] 臨時取消、延後、地點變更及公告。
- [ ] 地址／座標確認後才顯示地圖導航。
- [ ] 收藏地區／市場。
- [ ] 出攤提醒及口味預告通知（使用者授權後）。
- [ ] 售完資訊必須由可信庫存／管理流程更新。

### 行銷與活動
- [ ] 優惠券及使用期限。
- [ ] 會員價／限定場次優惠。
- [ ] 活動 Banner 與公告。
- [ ] 刮刮樂／抽獎活動設定。
- [ ] 抽獎資格、次數、有效期限及兌換紀錄。
- [ ] 防重複領取、重複兌換及異常操作。
- [ ] 優惠不可超出適用商品、日期及使用條件。

## 3. 商品訂單、付款與物流

### 涼糕送到府
- [ ] 保留既有開單日期、地區、口味及價格設定。
- [ ] 驗證配送地區、地址格式及實際服務範圍。
- [ ] 確認最低訂購量等既有規則。
- [ ] 確認運費規則與配送時段。
- [ ] 訂單、地址、商品明細與價格快照完整保存。
- [ ] 訂單成立、付款及出貨通知相容。

### 涼糕超商冷藏寄放
- [ ] 清楚標示「冷藏寄放」，不可誤稱冷藏宅配。
- [ ] 7-ELEVEN／全家門市資料欄位及縣市／門市驗證。
- [ ] 寄放費由可信後端設定讀取，不接受前端任意金額。
- [ ] 付款後五碼／付款證明提交及核對。
- [ ] 取件期限、領取人身分核對及超時處理說明。
- [ ] 舊官網寄放流程相容。
- [ ] 明細名稱、價格、數量以資料庫已驗證資料建立快照。

### 蘿蔔糕冷凍物流
- [ ] 冷凍店到店配送方式。
- [ ] 冷凍宅配配送方式。
- [ ] 物流合約、門市支援與費率待確認。
- [ ] 運費由可信設定來源提供，不沿用未核實硬編碼。
- [ ] 新舊 RPC overload 相容與退場計畫。
- [ ] 蘿蔔糕開單開關由後端 RPC 再次驗證。
- [ ] 商品、數量、冷凍包裝與運費明細快照。
- [ ] 不把涼糕最低訂購量規則套用到蘿蔔糕。

### 餐車／現場取貨
- [ ] 僅在管理後台明確開放的場次顯示。
- [ ] 場次、取貨時段、地點與商品可售狀態。
- [ ] 訂單保留來源與取貨資訊。
- [ ] 員工現場核銷／PDA 作業本階段不啟用。

### 付款
- [ ] 確認實際付款方式及正式銀行資料。
- [ ] 付款設定由老闆後台管理。
- [ ] 匯款證明上傳、檔案大小／MIME／路徑及訂單綁定。
- [ ] 待付款、已提交證明、核對中、已付款、退件、退款等狀態分離。
- [ ] 只有管理員核實入帳或可信金流 webhook 可標記 paid。
- [ ] 貨到付款獨立收款流程。
- [ ] 付款通知與實際付款狀態不可混為一談。
- [ ] 退款及取消的財務稽核紀錄。

### 物流追蹤
- [ ] 物流方式與費率設定。
- [ ] 託運單號／門市資訊。
- [ ] 待出貨、已出貨、配送中、已送達、異常等狀態。
- [ ] 每張訂單保存物流方式、運費快照、收件／門市快照。
- [ ] 後續費率調整不得改變歷史訂單金額。
- [ ] 物流通知與顧客查詢。

## 4. 老闆管理後台

### 登入與權限
- [ ] 老闆專用登入。
- [ ] 既有 admin_profiles 角色盤點與權限矩陣。
- [ ] 商品管理、訂單管理、付款核對、個資管理權限分離。
- [ ] 高風險操作二次確認。
- [ ] 操作紀錄、登入紀錄及設定異動稽核。
- [ ] 伺服器／資料庫強制授權，不能只靠隱藏按鈕。

### 營運總覽
- [ ] 今日／期間訂單量。
- [ ] 待付款、待核款、待處理、待出貨、異常訂單。
- [ ] 涼糕與蘿蔔糕分開統計。
- [ ] 銷售額、退款及實收分開計算。
- [ ] 庫存警示。
- [ ] 餐車／擺攤行程摘要。

### 商品與口味
- [ ] 商品分類、商品、口味、規格。
- [ ] 圖片上傳與管理。
- [ ] 價格、會員價、活動價。
- [ ] 上架／下架、停售及開單控制。
- [ ] App 與官網同步發布。
- [ ] 涼糕與蘿蔔糕商品管理語意分開。

### 訂單管理
- [ ] 涼糕送到府訂單管理。
- [ ] 涼糕超商冷藏寄放訂單管理。
- [ ] 蘿蔔糕冷凍店到店訂單管理。
- [ ] 蘿蔔糕冷凍宅配訂單管理。
- [ ] 訂單搜尋、篩選、明細及狀態歷程。
- [ ] 訂單取消／作廢保留紀錄，不以直接刪除作日常操作。
- [ ] 訂單來源標記 App／官網／現場（現場功能只保留資料欄位，不啟用員工流程）。

### 付款與物流管理
- [ ] 匯款證明查看與核款。
- [ ] 付款狀態更新權限及紀錄。
- [ ] 配送方式、運費、門市／宅配設定。
- [ ] 託運單號、出貨狀態及異常處理。
- [ ] 付款／出貨通知重送及冪等管理。
- [ ] 不可任意修改歷史訂單快照。

### 餐車與擺攤管理
- [ ] 餐車出攤日期、服務地區、時間。
- [ ] 擺攤日期、服務地區、時間。
- [ ] 當日販售口味與價格。
- [ ] 擺攤前台不顯示價格（依既有需求）。
- [ ] 臨時異動、公告及公開／隱藏。
- [ ] App 與官網同步發布。
- [ ] 地址／座標欄位待現況 schema 核對。

### 會員、行銷與報表
- [ ] 會員搜尋、資料及驗證狀態。
- [ ] 優惠券、會員價、活動規則。
- [ ] 刮刮樂／抽獎設定與兌換紀錄。
- [ ] 每日／每週／每月營收報表。
- [ ] 商品／口味銷售排行。
- [ ] 地區、訂單來源及物流類型分析。
- [ ] 退款、折讓、實收及未收款報表。
- [ ] 匯出報表與操作權限。

## 5. 官網與 App 共用服務
- [ ] 共用會員身份及安全 session。
- [ ] 共用商品、口味、價格及上架狀態。
- [ ] 共用餐車／擺攤行程。
- [ ] 共用購物車／訂單 API 契約。
- [ ] 共用付款與物流狀態查詢。
- [ ] 官網舊頁面逐一回歸測試。
- [ ] 保留官網原有下單入口及必要相容層。
- [ ] 功能旗標控制新舊流程逐步切換。
- [ ] 新功能故障時可回復舊官網流程。
- [ ] 官網、App 顯示相同已發布資料。
## 6. 資安、資料與通知（上線阻擋項）
- [ ] P0：限制匿名／一般會員讀取 LINE 訂單個資 payload RPC。
- [ ] P0：限制付款通知旗標 RPC 僅可信服務端使用。
- [ ] P0：逐支修正使用 service_role 的通知 Edge Functions 呼叫者授權。
- [ ] P0：移除程式碼內固定密鑰，輪替並移至 Function Secrets。
- [ ] P0：通知 payload 由後端查詢，不信任前端提供收件人／個資。
- [ ] P0：通知冪等、重試、重播防護與錯誤遮罩。
- [ ] 會員只能讀取自己的訂單及明細。
- [ ] 訪客訂單查詢採高熵短效驗證。
- [ ] merch_backend_sync RLS disabled 問題先查依賴、有效 grants 及 API exposure，再設計修正。
- [ ] 檢查寬鬆 merch_* policies。
- [ ] 固定 SECURITY DEFINER search_path 並收斂 EXECUTE 權限。
- [ ] Auth leaked password protection 評估與設定。
- [ ] Storage 匯款憑證限制 MIME、大小、路徑、覆寫及存取。
- [ ] LINE webhook 保留 HMAC 簽章並加入 event 去重。
- [ ] 逐支盤點 Active Edge Functions 的用途、呼叫者、Secrets、CORS、速率限制。
- [ ] 不明用途的測試／TikTok Functions 先確認依賴，不可直接停用。
- [ ] 備份、稽核、監控與回復演練。

## 7. 測試、上架與正式交付
- [ ] 顧客流程：瀏覽、購物車、訪客下單、會員下單。
- [ ] 商品停售、庫存不足、開單關閉、價格異動測試。
- [ ] 涼糕各物流流程端到端測試。
- [ ] 蘿蔔糕各冷凍物流流程端到端測試。
- [ ] 付款證明、核款、COD、退款測試。
- [ ] 會員跨帳號隔離、訪客訂單驗證測試。
- [ ] 管理員各角色權限測試。
- [ ] LINE 訂單、付款、出貨通知測試。
- [ ] 重複請求、併發下單、重複 webhook、斷網與重試測試。
- [ ] 官網所有既有下單頁與後台回歸測試。
- [ ] iPhone／Android 裝置與不同螢幕測試。
- [ ] 隱私政策、服務條款、客服聯絡資訊。
- [ ] Apple Developer／Google Play 帳號、簽章、商店圖示、截圖及審核。
- [ ] 備份正式資料庫、Storage metadata、Function source、設定及官網版本。
- [ ] 灰度發布、監控、回復與正式上線核准。

## 8. 建議交付順序
1. 完成規格與現況盤點：資料字典、API 契約、角色矩陣、狀態機、物流／付款設定來源。
2. 顧客 App 假資料完整原型：所有主要頁面與完整購物流程。
3. 老闆後台假資料完整原型：商品、訂單、付款、物流、行程、會員、行銷、報表。
4. 安全修正程式草案：SQL、Edge Functions、Storage、Auth；不部署。
5. 免費靜態檢查與 mock 測試：不連正式顧客資料、不假稱已完成整合測試。
6. 取得隔離測試環境後做完整整合測試；若有費用先徵求同意。
7. 正式環境變更審核：逐項列出差異、影響、備份、回復與驗收結果，取得明確核准。
8. 正式串接與分批上線：官網保持可用，App 逐步開放。
9. 商店上架與營運交接：監控、客服、資料保護、回復演練。

## 9. 完成狀態定義
- 未開始：尚無可驗收實作。
- 規劃中：已有需求／規格文件。
- 製作中：已有可執行程式或原型，仍未驗收。
- 待測試：實作已完成，等待指定環境驗證。
- 已完成：有可重現驗收證據，且符合正式環境要求。
- 暫緩：使用者已決定本階段不做。

任何文件、原型或 SQL 草案不得標成正式功能「已完成」。只有可實際操作、測試通過及符合部署核准條件才可結案。

## 10. 下一個實際交付
接下來依本主控清單，先完成：
1. 資料字典與現有 API 呼叫對照。
2. 顧客 App 完整畫面／流程原型。
3. 老闆後台完整畫面／流程原型。
4. 付款、物流、訂單三套狀態機。
5. 全部高風險 SQL／Edge Function 修正草案及免費靜態測試。

不會把「文件完成」誤報成「App 已做好」，也不會為了趕進度修改正式資料或造成額外費用。


---

## 11. 2026-11-08 原型進度更新

| 交付 | 狀態 | 範圍／限制 |
|---|---|---|
| 顧客＋老闆整合互動原型 V1 | 已建立 | `app/full-platform-prototype-v1.html`；展示首頁、商品、會員、行程及後台導覽，模擬資料 |
| 顧客結帳流程原型 V2 | 已建立 | `app/full-platform-flow-prototype-v2.html`；購物車、配送、收件、付款、確認、追蹤 |
| 老闆訂單操作原型 V2 | 已建立 | 訂單詳情、付款核對、物流更新、商品編輯、費率／開單設定 |
| 真實下單、付款及物流串接 | 未完成 | 原型不連正式 Supabase，不會產生真實訂單 |
| 正式後端權限與金額驗證 | 未完成 | 必須由後端執行，尚未部署或修改正式環境 |

### 原型驗收提醒
- 涼糕送到府、涼糕超商冷藏寄放、蘿蔔糕冷凍店到店、蘿蔔糕冷凍宅配採不同配送選項。
- 冷藏寄放明確標示為寄放，不稱冷藏宅配。
- 運費、寄放費、銀行資料不預填未核實金額。
- 訂單狀態、付款狀態、物流狀態分開呈現。
- 訪客訂單查詢需本人驗證，不只憑訂單編號公開資料。
- 商品價格、庫存、開單狀態及配送費正式版必須由可信後端重新驗證。
- 員工及 PDA 功能仍依使用者決定暫緩。
- 上述均為介面與流程原型，不能視為已完成正式 App 或後端功能。

### 下一階段
建立「訂單／付款／物流狀態機與轉換規則」文件，逐一定義允許轉換、執行角色、必要資料、通知時機、重試／取消／退款及稽核紀錄，再製作免費靜態測試案例。正式環境仍維持唯讀，不新增付費 Supabase branch。


## 12. 2026-11-08 狀態機規格交付

| 交付 | 狀態 | 備註 |
|---|---|---|
| 訂單狀態機規格 | 已建立初稿 | 含允許轉換、取消、異常及完成規則 |
| 付款狀態機規格 | 已建立初稿 | 含付款證明、核款、失敗、退款與 COD 收款分離 |
| 物流狀態機規格 | 已建立初稿 | 含送到府、冷藏寄放、蘿蔔糕冷凍店到店／宅配 |
| 角色權限與稽核欄位 | 已建立初稿 | 尚待對照實際角色、RLS、RPC |
| 免費 Mock 驗收案例 | 已列出 | 尚未執行自動化測試 |
| 正式資料庫／Function 變更 | 未執行 | 維持正式環境唯讀 |

狀態機文件：`app/ORDER_PAYMENT_LOGISTICS_STATE_MACHINES.md`

### 下一個實際交付
1. 逐項對照目前資料表、RPC、Edge Functions 與狀態機，標出可沿用、缺欄位、需相容處理的部分。
2. 建立免費、無外部連線的狀態轉換測試程式與固定測試資料。
3. 執行靜態檢查與 Mock 測試，回報通過／失敗項目。
4. 依測試結果產生安全修正草案；不部署、不修改正式 Supabase、不更動正式官網。


## 13. 2026-11-08 Phase 10 唯讀 Schema／RPC 對照交付

| 交付 | 狀態 | 備註 |
|---|---|---|
| 核心資料表欄位／主外鍵／RLS metadata | 已唯讀盤點 | 僅 metadata，未讀顧客個資 |
| 三種訂單表 status CHECK | 已確認 | orders、cooling_pickup_orders、radish_orders |
| RPC TypeScript signatures | 已取得 | 參數摘要，不等於重新審查函式內部 |
| ACTIVE Edge Function 清單 | 已確認 | 名稱、狀態、verify_jwt；沒有部署或修改 |
| 舊欄位與新狀態機差異 | 已整理 | 需相容 adapter，不直接改寫歷史狀態 |
| RLS policy／table grants 逐條核對 | 未完成 | 下一階段只讀審查 |
| 狀態 mapping 純函式與 fixture 測試 | 未完成 | 下一階段免費實作 |
| 正式 Supabase 變更 | 未執行 | 維持正式環境唯讀 |

詳細文件：`app/PHASE_10_SCHEMA_RPC_STATE_MAPPING.md`

### Phase 10 重要發現
- 涼糕 orders.status 同時包含付款、物流及訂單狀態語意，payment_status 也只涵蓋部分付款流程。
- 冷藏寄放主表 status 混合付款、製作、出貨、寄放與取貨。
- 蘿蔔糕主表只有單一 status，payment_method 不是付款狀態，亦未見通用物流追蹤欄位。
- 餐車排程表目前未見地址／座標欄位；排程口味關聯表有三個價格欄位，需要確立唯一權威來源。
- 目前不可直接改名舊 status 或移除 RPC overload，需先建立 adapter 與官網回歸方案。

### 下一個實際交付
1. 只讀核對相關 RLS policies、table grants、RPC EXECUTE grants 與 SECURITY DEFINER。
2. 建立舊狀態到新狀態機的純函式 mapping。
3. 加入 fixture 測試，涵蓋未知狀態、非法跳轉、付款與物流分離、重複事件。
4. 執行免費靜態測試並提交結果；不連正式寫入、不建立付費 Supabase branch。


## 14. 2026-11-08 Phase 11 免費狀態映射測試

| 交付 | 狀態 | 備註 |
|---|---|---|
| 舊訂單狀態映射 helper | 已建立 | `app/tests/status-mapping.js` |
| Fixture 測試 | 已建立 | `app/tests/status-mapping.test.js` |
| 本機 Node.js 測試 | 已執行，8／8 通過 | 純函式與固定測試資料，未連 Supabase |
| 正式資料庫／API 整合測試 | 未執行 | 需隔離環境；不建立付費 branch |

### 已通過的測試情境
- 舊 orders.status=paid 不會被當成付款已完成。
- proof_submitted 不會被當成 paid。
- 冷藏寄放「已寄放」只映射為到店，不會誤判顧客已取貨。
- 冷藏寄放「已取貨」可映射交付完成，但付款狀態未知時會標記人工複核。
- 蘿蔔糕付款方式不會被誤當成付款狀態。
- 未知舊狀態會保留來源值並標記 exception／needsReview。
- 禁止取消後重新製作、完成後回到製作等非法訂單轉換。
- 重複事件 ID 只保留第一次。

**測試限制：**這是免費本機 Node.js fixture 測試，不證明正式 RPC、RLS、Edge Function、併發交易或 webhook 已安全。舊資料的業務語意仍有部分待老闆確認，mapping helper 只作為相容層草案，尚不可部署。

### 下一步
只讀核對 RLS policies、table grants、RPC EXECUTE grants 與 SECURITY DEFINER；完成後才整理正式安全修正草案。正式環境維持不變。


## 15. 2026-11-08 Phase 12 RLS／Grants／RPC 安全唯讀稽核

| 交付 | 狀態 | 備註 |
|---|---|---|
| 核心資料表 RLS policies | 已唯讀盤點 | 包含 orders、order_items、order_private、冷藏寄放、蘿蔔糕、商品、每日開單、管理設定 |
| 核心資料表 grants | 已唯讀盤點 | 聚焦 anon／authenticated／service_role 的資料操作權限 |
| 指定 RPC EXECUTE ACL | 已唯讀盤點 | 包含 SECURITY DEFINER、search_path 與函式原始碼 |
| Supabase Security Advisor | 已檢查 | 多支 SECURITY DEFINER 函式提醒；Auth leaked password protection disabled |
| 高風險修正清單 | 已建立提案 | 未執行任何修正 |
| 正式環境變更 | 未執行 | 維持唯讀，未建立付費 branch |

詳細文件：`app/PHASE_12_RLS_GRANTS_RPC_SECURITY_AUDIT.md`

### Phase 12 優先發現
- P0：兩支 LINE 訂單 payload SECURITY DEFINER RPC 有 PUBLIC／anon／authenticated EXECUTE，函式未見 caller／訂單授權，可能回傳顧客個資與匯款末五碼。
- P0：`submit_customer_payment` 允許 anon／authenticated 執行，依傳入 order_id 更新付款資料，未見會員 ownership 或訪客短效驗證。
- P0：`mark_line_payment_notification_sent` 允許 PUBLIC／anon／authenticated 執行，未見 caller authorization。
- P1：冷藏寄放訂單與明細允許 anon direct INSERT，需先確保 RPC／官網相容再收斂。
- P1：`merch_backend_sync` RLS disabled；目前 grants 輸出未見 anon／authenticated 資料操作權限，但仍須確認 schema exposure、views、functions 與 service-role 依賴。
- P1：`order_items`、蘿蔔糕訂單與明細目前沒有會員本人讀取政策，會員訂單中心需安全查詢方式。
- P1：LINE 綁定函式需確認一次性驗證或可信 webhook caller，不可只以電話比對作身份證明。
- P2：Auth leaked password protection disabled，需評估相容性後再提出設定變更。

### 下一階段
建立 RPC／Edge Function 呼叫來源矩陣，逐支確認前端、trigger、LINE webhook、service-role caller、排程與外部依賴；產出 P0 修正 SQL／Function patch 草案、相容測試與回復計畫。仍不部署、不修改正式 Supabase、不切換官網、不建立付費 branch。


## 16. 2026-11-08 Phase 13 RPC／Edge Function 呼叫來源矩陣

| 交付 | 狀態 | 備註 |
|---|---|---|
| LINE 通知 DB trigger 呼叫鏈 | 已唯讀確認 | orders 新單、付款證明、冷藏寄放付款末五碼 |
| 主要 LINE Edge Function 原始碼 | 已唯讀檢查 | line-order-send-v2、line-order-payment-send-v2、cooling-order-line-notify、line-customer-notify、line-webhook 等 |
| RPC payload 呼叫關係 | 已確認一輪 | 兩支 LINE payload RPC 被多個 Function 呼叫 |
| caller authentication 風險 | 已確認 | line-order-send-v2 verify_jwt=false 且沒有自訂 caller 驗證 |
| 付款狀態通知文字錯誤 | 已確認 | 提交匯款末五碼不等於已付款 |
| 硬編碼密鑰風險 | 已確認 | Function source 與 DB trigger definition 有明文密鑰，未於報告重印 |
| 修補與 Mock 測試計畫 | 已建立 | 尚未執行部署或正式端到端測試 |
| 正式環境變更 | 未執行 | 維持唯讀 |

詳細文件：`app/PHASE_13_RPC_EDGE_FUNCTION_CALLER_MATRIX_AND_PATCH_PLAN.md`

### Phase 13 重要發現
- P0：`line-order-send-v2` ACTIVE、verify_jwt=false，且沒有 JWT／secret／HMAC caller 驗證；可用任意 order_id 觸發查詢 payload 並推播管理員 LINE。
- P0：兩支 payload RPC 仍對 PUBLIC／anon／authenticated 開放，且未驗證呼叫者或訂單所有權。
- P0：付款通知 Function 將「已提交匯款末五碼」誤顯示成「已付款」，應與管理員核款狀態分離。
- P1：通知 Function 與 DB trigger 中存在硬編碼驗證密鑰，需先設計 Secrets 遷移與雙 key 輪替，避免通知中斷。
- P1：line-customer-notify 驗證 token 後仍信任 request body 的 recipient／訂單顯示欄位，應由後端依 token 查詢資料。
- P1：LINE 手機綁定未有 OTP／一次性驗證，電話字串不足以證明本人身份。

### 下一階段
製作免費本機靜態測試與安全 patch 草案：包含 caller authentication、payload 最小化、付款狀態正確顯示、通知冪等與 LINE 綁定驗證。同步建立舊官網相容測試；仍不部署、不修改正式 Supabase、不更改官網、不建立付費 branch。


## 17. 2026-11-08 Phase 14 通知安全免費 Mock 測試

| 交付 | 狀態 | 備註 |
|---|---|---|
| 通知授權／時間戳／事件 ID helper | 已建立 | `app/tests/notification-security.js` |
| 通知安全 fixture tests | 已建立 | `app/tests/notification-security.test.js` |
| 本機 Node.js 測試 | 已執行，9／9 通過 | 無 Supabase／LINE 外部連線 |
| 正式 Edge Function／DB 整合測試 | 未執行 | 未部署，正式環境維持唯讀 |

### 通過情境
- 未帶內部驗證密鑰的請求會被拒絕。
- 過期時間戳會被拒絕。
- 合法內部通知 envelope 可通過。
- 訂單 ID 格式驗證可在查 DB 前執行。
- proof_submitted 不會顯示為已付款。
- 付款通知需有真實付款證明事件及有效付款狀態。
- 出貨通知只採用已驗證服務端的收件人及訂單欄位。
- 缺少已驗證收件人時拒絕通知。
- 重複 event ID 可被識別。

**測試限制：**這些是純函式／Mock 測試，沒有測試真實 HMAC 密碼學實作、Supabase RLS／RPC、LINE API、DB trigger、Edge Function runtime、併發或重試佇列；不可視為正式安全修補已完成。

### 下一階段
完成正式修補前的精確差異清單：每一支 RPC／Function／trigger 的修改前後、caller 遷移、密鑰輪替順序、官網相容性、備份與回復計畫。仍須取得針對該變更清單的明確核准才可碰正式環境。


## 18. 2026-11-08 Phase 15 正式修補差異清單與回復計畫
| 交付 | 狀態 | 備註 |
|---|---|---|
| RPC／trigger 修補物件清單 | 已整理 | 包含 payload RPC、付款提交、通知旗標、LINE 綁定及通知 trigger |
| Edge Function 修補清單 | 已整理 | 包含 caller authentication、Secrets、payload 最小化、付款狀態與冪等 |
| LINE 管理員綁定風險 | 列為 P0 必查 | LINE HMAC 只驗證平台來源，不代表訊息使用者具管理員身份；需核對 allowlist／邀請授權 |
| caller 遷移與相容順序 | 已制定 | 先遷移 caller，再收斂 RPC grants；冷藏寄放 anon INSERT 需舊官網相容 |
| 備份與回復原則 | 已制定 | 不可回復到重新暴露個資的舊權限狀態 |
| 免費驗收矩陣 | 已建立 | 真實 HMAC、Supabase／LINE 整合測試尚未執行 |
| 最終可部署 SQL／Function diff | 未完成 | caller inventory 仍不完整，不可直接套用 |
| 正式 Supabase／官網變更 | 未執行 | 維持正式環境唯讀；未部署、未改 Secrets、未修改權限 |

詳細文件：`app/PHASE_15_PRODUCTION_PATCH_INVENTORY_AND_ROLLBACK_PLAN.md`

### Phase 15 重要提醒
- 不可先撤銷 payload RPC 權限再追查 caller，否則可能中斷現有 LINE 通知。
- 匯款末五碼／付款證明提交不等於已付款，核款成功才可發送付款確認。
- LINE「綁定管理員」必須有獨立管理員授權，不能只憑 LINE 訊息文字。
- 所有正式變更仍須逐批提供精確 diff、caller、影響、備份、回復與測試證據，並取得對該批變更的明確核准。

### 下一階段
Phase 16：補齊所有通知 Functions、網站與 trigger 的 caller inventory，特別追查 line-order-notify、line-payment-order-notify、line-payment-notify、line-customer-notify 及 test Functions；再產出逐支 Function patch diff 與測試 fixtures。正式環境維持唯讀。


## 19. 2026-11-08 Phase 16 通知 Function／官網／DB Caller Inventory

| 交付 | 狀態 | 備註 |
|---|---|---|
| 三條 DB trigger LINE 通知鏈 | 已唯讀確認 | orders 新單、orders 付款欄位更新、冷藏寄放付款末五碼 |
| 主要官網結帳 RPC caller | 已確認一輪 | create_cooling_pickup_order、create_customer_order、create_radish_delivery_order |
| 已檢查官網頁面直接呼叫 LINE Function | 未發現 | 只代表已檢查頁面，外部 caller 尚未排除 |
| line-order-notify／line-payment-order-notify | source 已檢查 | 目前 DB trigger／已檢查官網未找到 caller；不可直接停用 |
| line-payment-notify／merch-payment-sync | source 已檢查 | 兩支周邊商品付款通知 Function 功能重疊，實際 caller 未知 |
| line-customer-notify | source 已檢查 | token 驗證後仍信任 body recipient／顯示欄位；token lifecycle caller 未完成追查 |
| line-webhook 管理員綁定 | P0 風險已確認 | 固定文字分支未見 allowlist／邀請授權，需安全替換 |
| line-order-test-* | source 已檢查 | 目前是簡單 stub；外部依賴未知，不停用 |
| 正式環境變更 | 未執行 | 未呼叫通知端點、未發 LINE、未部署、未修改 DB／Secrets／官網 |

詳細文件：`app/PHASE_16_NOTIFICATION_CALLER_INVENTORY.md`

### Phase 16 重要發現
- P0：LINE「綁定管理員」目前 source 路徑未見管理員身份驗證；LINE HMAC 不等於管理員授權。
- P1：line-payment-notify 與 merch-payment-sync 都能以 order_id 查周邊商品付款資料並通知，實際 caller 尚未確認，存在重複推播與未授權入口風險。
- 已檢查的舊官網結帳頁使用 Supabase RPC 建立訂單，未發現直接呼叫 LINE 通知 Function；通知主要由 DB trigger 驅動。
- admin-orders-fixed-v3 有直接資料表更新／刪除及每日開單設定寫入流程，後續權限收斂必須先保留相容管理流程。
- line-order-test-* 目前為 stub，但不可僅因名稱含 test 就停用。

### 下一階段
Phase 17：追查所有 RPC function definitions、pg_net／cron／webhook／Storage／外部呼叫紀錄，補齊出貨通知 token 生命週期及周邊商品付款通知 caller；完成後才產生逐支可審核 patch diff。正式環境維持唯讀。


## 20. 2026-11-08 Phase 17 RPC／排程／出貨通知 Token Lifecycle Audit

| 交付 | 狀態 | 備註 |
|---|---|---|
| public schema RPC HTTP caller | 已唯讀盤點 | 目前找到三支 net.http_post caller，對應三條既有 DB trigger |
| DB Webhook trigger | 未發現 | information_schema.triggers 無 http／webhook action statement |
| pg_cron | 未見 cron schema | 本輪無法列出 cron.job |
| pg_net request queue | 查詢時為空 | 未讀取 request body／headers |
| shipment_notify_token 欄位 | 已確認 | 24-byte random default、text、nullable |
| shipment token verify RPC | 已確認 | SECURITY DEFINER，anon/authenticated 可 EXECUTE，只回傳 boolean |
| token mint／rotate／revoke／expiry | 未找到完整流程 | 需繼續追查下單 RPC、舊訂單與外部物流 callback |
| line-customer-notify caller | 未確認 | Function 驗證 token 後仍信任 request body recipient／顯示欄位 |
| 近 24 小時 Function Edge Logs | 已唯讀查詢 | 可見 line-webhook、TikTok chat/proxy；未見其他 LINE 通知端點呼叫 |
| Dashboard／Storage／外部自動化 | 未完成 | 尚須控制台設定核對 |
| 正式環境變更 | 未執行 | 全程唯讀，未讀訂單／客戶資料列、未發通知、未部署 |

詳細文件：`app/PHASE_17_RPC_SCHEDULE_TOKEN_LIFECYCLE_AUDIT.md`

### Phase 17 重要發現
- public DB function definitions 中目前只找到三支 `net.http_post` 通知 caller，均對應已知 orders／cooling_pickup_orders triggers。
- `orders.shipment_notify_token` 使用 24-byte 隨機值預設，但欄位允許 NULL；資料庫只找到 verify function，沒有專用 mint／rotate／revoke／expiry function。
- verify_shipment_notify_token 為 SECURITY DEFINER，anon／authenticated 可執行；只回傳 boolean，但應考慮移至非 exposed schema 或由 Edge Function 內部 service_role 驗證。
- line-customer-notify 驗證 token 後仍信任 request body 的 recipient 與部分通知欄位，需改成由後端依 order_id 讀取已驗證資料。
- 近 24 小時 log 沒有其他 LINE 通知端點請求，但不可把單一時間窗無紀錄解讀為無外部 caller。
- 沒有 cron schema、沒有 DB Webhook trigger；Supabase Dashboard Storage／外部自動化仍待核對。

### 下一階段
Phase 18：追查 Storage bucket／付款證明上傳流程、Dashboard Webhook 與外部物流 callback 的可見設定；比對 create_customer_order／物流 RPC 是否產生或輪替 token；補上出貨通知事件與冪等設計。正式環境維持唯讀。


## 21. 2026-11-08 Phase 18 Storage／付款證明／通知來源稽核

| 交付 | 狀態 | 備註 |
|---|---|---|
| Storage bucket inventory | 已唯讀盤點 | 5 buckets；transfer-proofs 為 private |
| Storage RLS policies | 已唯讀盤點 | transfer-proofs 匿名與登入使用者可 INSERT，只限制 proof/ prefix |
| transfer-proofs bucket limits | 未設定 | file_size_limit、allowed_mime_types 均為 NULL |
| transfer-proofs objects | 查詢時 0 筆 | 未讀取檔案內容 |
| 涼糕付款證明流程 | 部分追查 | orders 欄位與 submit_customer_payment RPC 存在；主要客戶下單頁未找到上傳 caller |
| 周邊商品付款證明流程 | 未確認 | payment_proof_url 欄位存在，已檢查頁面未找到客戶上傳 caller |
| 周邊商品 LINE 通知 Functions | 已讀取 source | line-payment-notify v4、merch-payment-sync v3 均 verify_jwt=false，caller 未確認 |
| Storage Webhook／外部自動化 | 未完成 | 尚需 Dashboard／第三方控制台核對 |
| 正式環境變更 | 未執行 | 全程唯讀，未讀付款證明或客戶資料 |

詳細文件：`app/PHASE_18_STORAGE_PAYMENT_PROOF_AUDIT.md`

### Phase 18 重要發現
- transfer-proofs bucket 雖為 private，但匿名 INSERT policy 只檢查物件名稱以 proof/ 開頭，沒有訂單授權／所有權／短效 token 綁定。
- transfer-proofs 未設定 bucket 層檔案大小與 MIME 限制；本輪查詢時物件數為 0。
- `submit_customer_payment` 會更新付款狀態與證明路徑，但 source 未見檔案存在、訂單綁定或上傳授權驗證。
- 目前檢查的主要客戶下單頁未找到 transfer-proofs 或周邊商品付款證明上傳 caller；外部／未列頁面來源尚未排除。
- line-payment-notify 與 merch-payment-sync 都是 verify_jwt=false，未見 request authentication；均能以 request order_id 觸發管理員通知。caller 未確認前不得停用。
- 周邊商品與涼糕通知訊息將 proof_submitted／匯款末五碼稱作付款完成，必須改成「待核對」，真正核款後才可標示已付款。

### 下一階段
Phase 19：整理付款／通知／出貨安全修補的精確 patch diff 與測試矩陣；把 caller 未知項目列為上線阻擋條件。正式環境仍維持唯讀，變更需逐項明確核准。


## 22. 2026-11-08 Phase 19 安全修補方案與驗收矩陣

| 交付 | 狀態 | 備註 |
|---|---|---|
| transfer-proofs 上傳授權目標流程 | 已設計 | 訂單綁定、短效 capability、private bucket、MIME／size 限制 |
| 周邊商品付款通知修補設計 | 已設計 | 內部事件簽章、proof_submitted／payment_confirmed 分流、冪等 |
| 涼糕／冷藏寄放通知修補設計 | 已設計 | trigger caller 遷移、移除固定 secret、最小化 LINE payload |
| 顧客出貨通知修補設計 | 已設計 | token 驗證後由 DB 讀 recipient／物流欄位 |
| RPC／trigger 權限收斂順序 | 已設計 | 先 caller 遷移與驗收，再收斂 EXECUTE／Storage policy |
| Storage／付款／通知測試矩陣 | 已列出 | 含匿名上傳、guest token、MIME／size、HMAC、重播、冪等及舊官網相容 |
| 備份／回復方案 | 已列出 | caller dependency graph 成組回復，禁止回到已知公開漏洞 |
| 最終可部署 SQL／Function diff | 未完成 | 真實上傳 caller、周邊商品通知 caller、shipment token lifecycle 尚未確認 |
| 本機整合測試 | 未執行 | 尚未啟動本機 Supabase stack |
| 正式環境變更 | 未執行 | 維持唯讀；未部署、未修改 Storage policy／Function／RPC |

詳細文件：`app/PHASE_19_SECURITY_PATCH_DESIGN_AND_TEST_MATRIX.md`

### Phase 19 上線阻擋條件
- transfer-proofs 實際上傳端點及所有 caller 未確認。
- merch_orders.payment_proof_url 寫入來源未確認。
- line-payment-notify／merch-payment-sync 外部 caller 未確認。
- line-customer-notify shipment token 產生與生命週期未確認。
- 所有未知 caller 未排除前，不移除 Function、不 REVOKE RPC、不改 Storage policy。
- 所有付款證明提交只能代表 proof_submitted；只有管理員實際核款後才可 confirmed／paid。

### 下一階段
Phase 20：唯讀追查 pg_net／pg_cron／Database Webhooks、所有 RPC 定義，以及 merch_orders／payment_proof_url 寫入路徑；caller 完整後才產生逐檔完整 patch diff 與本機測試 fixtures。


## 23. 2026-11-08 Phase 20 未知 Caller／pg_net／付款欄位／出貨 Token 稽核

| 交付 | 狀態 | 備註 |
|---|---|---|
| pg_cron／DB webhook metadata | 已唯讀盤點 | 未安裝 pg_cron；可見 webhook trigger／catalog 未找到 |
| pg_net caller inventory | 已唯讀盤點 | 找到 3 條已知 LINE trigger caller |
| pg_net queue／response summary | 已唯讀盤點 | 查詢時 queue 0 筆；近 30 日 response metadata 1 筆 HTTP 200 |
| merch_orders.payment_proof_url | 部分追查 | 欄位存在；DB function writer／trigger／客戶 upload caller 尚未找到 |
| shipment_notify_token lifecycle | 已唯讀盤點 | 預設 24-byte random token；明文欄位、無 expiry／consumed metadata |
| verify_shipment_notify_token ACL | 已唯讀盤點 | SECURITY DEFINER；anon／authenticated 可執行 |
| line-customer-notify v5 | 已讀取 source | token 驗證後仍信任 body recipient、order number、pickup type、store；未見 consume／expiry |
| 24h notification Function logs | 已聚合查詢 | 指定 8 支 Function 無結果；不代表無外部 caller |
| 正式環境變更 | 未執行 | 維持唯讀，未呼叫通知端點或 LINE |

詳細文件：`app/PHASE_20_CALLER_TOKEN_LIFECYCLE_AUDIT.md`

### Phase 20 重要發現
- pg_cron 未安裝，cron catalog 不存在；本次可見 DB trigger 未發現 webhook/http trigger，但 Dashboard／第三方外部自動化仍需專案管理者確認。
- pg_net function definitions 找到 3 條現有通知 trigger caller；周邊商品兩支通知 Function 未找到 DB pg_net caller。
- `merch_orders.payment_proof_url` 寫入端點仍未知；目前搜尋到後台個資清除欄位與通知 Function 讀取欄位，未找到客戶上傳流程。
- shipment token 雖使用 24-byte 隨機值，仍以明文保存；沒有 expiry／consumed 欄位，驗證 RPC 允許 anon／authenticated 執行。
- `line-customer-notify` v5 驗證 token 後仍使用 body 中 recipient、訂單號、物流方式與門市資料，必須改由 DB 驗證欄位。
- 未知 caller 未排除前，不刪除 Function、不 REVOKE RPC、不修改 Storage policy。

### 下一階段
Phase 21：建立 shipment token lifecycle 相容遷移設計；逐頁檢查 active branch 周邊商品結帳／後台付款欄位寫入端點；整理需由專案管理者在 Dashboard／第三方控制台確認的外部 caller 清單。正式環境維持唯讀。


## 24. 2026-11-08 Phase 21 周邊商品付款流程／出貨 Token 相容遷移設計

| 交付 | 狀態 | 備註 |
|---|---|---|
| merch.html 客戶結帳完整流程 | 已唯讀檢查 | 建立 merch_orders 與 items；只寫匯款後五碼，沒有付款證明 upload |
| merch-admin.html | 已唯讀檢查 | 可更新付款／出貨狀態；個資清除時清空 proof URL；無 proof upload |
| merch-admin-v2.html | 已唯讀檢查 | 可讀取商品訂單；商品圖上傳與付款證明無關 |
| 周邊商品付款證明新流程 | 已完成設計稿 | 私有 bucket、短效 capability、server finalize、proof_submitted 與 paid 分離 |
| 出貨 Token lifecycle | 已完成設計稿 | token hash、expiry、consume、event_id、DB 派生 recipient／物流欄位 |
| Patch package／相容遷移 | 已完成設計稿 | 尚未產生或套用正式 migration／Function patch |
| 單元測試規格 | 已完成測試案例 | 下一階段建立本機純函式 fixtures |
| 正式環境變更 | 未執行 | 無 DDL／DML、Function deploy、Secrets 或官網變更 |

詳細文件：`app/PHASE_21_MERCH_PAYMENT_AND_SHIPMENT_TOKEN_DESIGN.md`

### Phase 21 新確認
- active branch `merch.html` 完整 submit handler 建立訂單、寫入 unpaid 及匯款後五碼，沒有付款證明檔案欄位、Storage upload 或付款證明 URL 寫入。
- `merch-admin.html` 可直接更新付款／出貨狀態，但沒有付款證明 upload；`merch-admin-v2.html` 的 Storage upload 是商品圖片。
- merch 前台初始付款狀態使用 unpaid，舊後台下拉選單使用 pending／paid／refunded，存在狀態字典不一致，遷移前必須先做相容轉換表。
- 因此周邊商品付款證明流程在 active branch 尚未完成，兩支匿名通知 Function 不應被視為已串接的有效客戶付款流程。
- 已產出 token lifecycle 與 merch proof upload 的 patch package、測試規格及相容策略；均為設計稿，未套用。

### 下一階段
Phase 22：補齊周邊商品所有頁面與外部 caller matrix、列出 Dashboard／第三方 caller 人工確認清單，建立本機純函式 token lifecycle／payment state fixtures 並執行測試。正式環境維持唯讀。


## 25. 2026-11-08 Phase 22 Caller Matrix／本機安全測試

| 交付 | 狀態 | 備註 |
|---|---|---|
| 周邊商品客戶結帳入口 | 已唯讀確認 | merch.html 直接建立 merch_orders／items，無付款證明 upload |
| 周邊商品後台入口 | 已唯讀確認 | merch-admin.html 更新付款／物流狀態；merch-admin-v2.html 只讀訂單、商品圖 upload |
| 涼糕冷藏寄放 caller | 已確認 | convenience-order.html／v2 透過 create_cooling_pickup_order |
| 蘿蔔糕訂單 caller | 部分確認 | radish-order.html 前端頁面已找到；完整 RPC 參數／後續呼叫仍待補查 |
| 通知 Function caller matrix | 已整理 | 三條已知 DB trigger caller；多支 Function 外部 caller 未確認 |
| Dashboard／LINE／第三方外部 caller 清單 | 已建立 | 需專案管理者在各控制台人工核對；不可將未知當作不存在 |
| 本機安全 helper | 已建立 | app/tests/phase22-security.js |
| 本機安全 fixture tests | 已建立並通過 | app/tests/phase22-security.test.js，10／10 passed |
| HMAC 真實密碼學整合測試 | 未完成 | 目前只測純函式授權／token 條件，不代表正式加密實作 |
| 正式環境變更 | 未執行 | 無 DB／Storage／Function／LINE／Secrets／官網寫入 |

詳細文件：`app/PHASE_22_CALLER_MATRIX_AND_LOCAL_SECURITY_TESTS.md`

### Phase 22 結論
- 已讀取 active branch 的周邊商品結帳完整 submit handler：只建立訂單、寫匯款後五碼，沒有付款證明檔案上傳。
- 已確認冷藏寄放兩個前端頁面透過 create_cooling_pickup_order RPC 建單。
- 已整理通知 Function 已知 DB caller 與未知外部 caller；未知 caller 仍需由專案管理者核對 Supabase Dashboard、LINE Developers、CI、主機與第三方自動化。
- 新增 shipment token lifecycle／merch payment state 本機純函式 helper 與測試，10／10 通過。
- 測試未連 Supabase、未呼叫 LINE，不能視為 DB／Edge Function 整合驗收。

### 下一階段
Phase 23：整理管理者外部 caller 確認表；核對 merch_orders 現有付款狀態字典與相容規則；產出 token lifecycle SQL／RPC／Edge Function 及付款證明上傳的逐檔 Patch Diff 草案。僅提交設計與程式草案，不部署、不修改正式環境。


## 26. 2026-11-08 Phase 23 正式切換前確認表／Patch 草案

| 交付 | 狀態 | 備註 |
|---|---|---|
| merch_orders 欄位與 CHECK constraints | 已唯讀確認 | payment_status、shipment_status 的實際允許值已整理 |
| 舊後台與 DB 狀態不一致 | 已確認 | payment UI pending／paid／refunded 與 DB CHECK 不一致；shipment UI pending／processing／completed 亦不一致 |
| 現有狀態資料分布 | 未能確認 | distinct 聚合查詢回傳空集合；不推定資料列數或狀態分布 |
| 外部 Caller 管理者確認表 | 已建立 | Supabase Dashboard、LINE Developers、第三方主機／自動化 |
| 出貨 Token lifecycle Patch | 已建立草案 | 新增欄位、private RPC、HMAC envelope、原子消耗與相容回滾 |
| 周邊商品付款證明 Patch | 已建立草案 | private bucket、order-bound capability、finalize、proof_submitted、admin signed URL |
| Supabase Storage 文件核對 | 已完成 | private bucket 與 signed upload URL 2 小時有效期已納入設計限制 |
| 正式環境變更 | 未執行 | 無 DDL／DML／GRANT／RLS／Function／Secrets／LINE／官網變更 |

詳細文件：`app/PHASE_23_PREDEPLOY_CHECKLIST_AND_PATCH_DRAFTS.md`

### Phase 23 重要發現
- merch_orders.payment_status CHECK 只允許 unpaid／proof_submitted／confirmed／rejected；舊後台選單的 pending／paid／refunded 不可直接寫入。
- merch_orders.shipment_status CHECK 只允許 unprepared／preparing／shipped／delivered；舊後台選單的 pending／processing／completed 不可直接寫入。
- UI 狀態必須透過明確 adapter 對應 DB canonical values；退款語意須另行定義，不能直接以字串代替退款稽核。
- 出貨 token 與付款證明安全修補已整理為可審閱 patch package，但沒有套用。
- 外部 caller 尚待管理者逐一確認，未知 caller 不可視為不存在。

### 下一階段
Phase 24：確認兩個周邊商品後台的實際使用入口；補齊出貨 token 發出端 caller 證據；增加 Node crypto HMAC 真實測試與付款證明上傳狀態 fixtures；整理逐檔 diff、部署前備份與回滾清單。仍維持正式環境唯讀。


## 27. 2026-11-08 Phase 24 HMAC／付款證明 fixtures 與 Caller 追查

| 交付 | 狀態 | 備註 |
|---|---|---|| Node crypto HMAC-SHA256 helper | 已建立 | canonical envelope、constant-time compare、timestamp skew |
| HMAC 單元測試 | 已完成 | 15 個 Phase 24 測試全數通過 |
| 付款證明 capability／finalize fixtures | 已建立 | order binding、expiry、single-use、MIME／size、object existence、idempotency |
| merch-admin.html 實際功能 | 已檢視 | 直接寫入舊 UI status，尚無付款證明上傳 |
| merch-admin-v2.html 實際功能 | 已檢視 | 訂單查詢／商品管理，沒有付款／出貨狀態更新及付款證明上傳 |
| Token DB 驗證 RPC | 已檢視 | 只比對 order id 與明文 token |
| Token 發送端 caller | 未確認 | DB 欄位 default 會產生 token；未找到可信任讀取／傳送 caller |
| 正式環境整合測試／修補 | 未執行 | 無 DB 寫入、Function 部署、Storage 上傳或 LINE 推播 |

詳細文件：`app/PHASE_24_HMAC_PROOF_FIXTURES_AND_CALLER_REVIEW.md`

### Phase 24 重要限制
- 15/15 測試是在本機 Node runtime 對 fixture 執行，不代表正式 Edge Function／DB／Storage／LINE 整合測試通過。
- merch-admin.html 與 merch-admin-v2.html 功能不等價，正式使用入口待管理者確認。
- shipment_notify_token default 會產生隨機值，但未找到可信 caller 將 token 傳給 line-customer-notify；不可推定 caller 不存在。
- radish-order.html 使用 create_radish_delivery_order RPC，與 merch_orders 建單流程分開。

### 下一階段
Phase 25：追查正式網站導覽及管理員入口；整理 merch-admin.html canonical status 修正 diff；規劃隔離 Supabase 專案整合測試。仍不對正式環境做寫入或部署。


## 28. 2026-11-08 Phase 25 後台入口／狀態修正 Diff／隔離測試規劃

| 交付 | 狀態 | 備註 |
|---|---|---|
| 官網公開導覽入口 | 已唯讀檢查 | 公開選單指向 merch.html；未見兩個管理後台的公開連結 |
| merch-admin.html 與 v2 差異 | 已確認 | 前者可直接更新訂單狀態；v2 訂單區以檢視為主，兩者不等價 |
| 正式部署／實際使用後台 | 未確認 | active branch 不足以證明正式主機部署版本或實際管理入口 |
| payment/shipment canonical status Diff | 已建立草案 | 使用 DB CHECK 允許值；未知值需人工核對 |
| refunded 退款語意 | 待需求定義 | 不可映射成 rejected／confirmed 等付款審核狀態 |
| updateOrder 白名單與失敗回復 | 已建立參考草案 | 尚未修改 merch-admin.html |
| 統計卡片 canonical 化 | 已列入草案 | 不可保留舊 UI status 判斷 |
| shipment token caller | 未確認 | DB default 會產生 token；未找到可信任讀取／傳遞端 |
| 免費隔離 Supabase 測試計畫 | 已建立 | 本機 Supabase／synthetic fixtures／假 Secrets／LINE mock |
| 正式環境變更 | 未執行 | 無 DB／Storage／Function／Secrets／LINE／官網寫入 |

詳細文件：`app/PHASE_25_ADMIN_ENTRY_STATUS_PATCH_AND_ISOLATED_TEST_PLAN.md`

### Phase 25 結論
- 官網公開選單連到周邊商品顧客頁 `merch.html`，未發現管理後台公開入口；但正式主機部署版本及實際管理者入口仍待主機／CI 控制台確認。
- `merch-admin.html` 與 `merch-admin-v2.html` 功能不等價；未確認實際使用者前不合併、不刪除。
- 舊後台付款／出貨選項與 DB CHECK 不一致，已整理 canonical select、欄位白名單、錯誤回復、未知值處理及統計卡片修正草案。
- `refunded` 不可映射為 `rejected` 或其他付款狀態，需另行定義退款紀錄與稽核流程。
- shipment token 發出端 caller 仍未知；不得把未找到視為不存在。
- 已建立不使用付費 Supabase Branch 的隔離整合測試計畫，以本機 stack、合成假資料、假 Secrets 與 LINE mock 為原則。

### 下一階段
Phase 26：在使用者開發環境確認 Docker／Supabase CLI 可用性，建立本機隔離 stack 與 synthetic fixtures；先驗證 schema／migration 可重建，再將 merch 狀態修正與 token／付款證明流程移入本機整合測試。正式環境持續唯讀，所有正式變更仍需逐項核准。


## 29. 2026-11-08 Phase 26 本機隔離環境可用性檢查

| 交付 | 狀態 | 備註 |
|---|---|---|
| Node.js | 可用 | v22.16.0 |
| Docker CLI | 不可用 | 目前工作容器找不到執行檔 |
| Supabase CLI | 不可用 | 目前工作容器找不到執行檔 |
| Deno | 不可用 | 目前工作容器找不到執行檔 |
| 本機 Supabase stack | 未建立 | 缺少 Docker／Supabase CLI |
| migration／RPC／RLS 整合驗收 | 未執行 | 不可用純函式測試代替 |
| Storage／Edge Function runtime 整合驗收 | 未執行 | 缺少本機 runtime |
| 正式環境變更 | 未執行 | 無正式 DB／Function／Secrets／LINE／官網寫入 |

詳細文件：`app/PHASE_26_LOCAL_ENVIRONMENT_READINESS_AND_BLOCKERS.md`

### Phase 26 結論
- 已確認目前 ChatGPT 工作容器有 Node.js v22.16.0，但沒有 Docker CLI、Supabase CLI、Deno。
- 本機 Supabase stack 尚未啟動；DB／Storage／Edge Function 整合測試尚未執行。
- 既有 HMAC／fixture 單元測試仍只屬純函式測試，不代表整合驗收。
- 下一步需在使用者自己的 Mac／Windows／Linux 開發電腦確認 Docker、Supabase CLI、Deno，再安全地啟動本機 stack。不得使用正式 Supabase 專案代替隔離測試，不建立付費雲端專案。

### 下一階段
Phase 27：在具備 Docker 的開發電腦取得 repo 後，審閱 Supabase config／migration／Edge Functions，確認本機連線隔離，再建立 synthetic fixtures 並啟動本機 stack。若使用者目前只有 iPhone，先安排可行的開發電腦環境，不在手機上執行 Docker。


## 30. 2026-11-08 Phase 27 iPhone-only 免電腦前置工作

| 交付 | 狀態 | 備註 |
|---|---|---|
| 使用者設備限制 | 已確認 | 目前只有 iPhone，沒有 Windows／Mac／Linux 開發電腦 |
| iPhone-only 安全工作計畫 | 已建立 | `app/PHASE_27_IPHONE_ONLY_SAFE_PREPARATION_PLAN.md` |
| 測試矩陣／合成資料字典 | 待建立 | 僅使用虛構資料，不使用正式顧客資料 |
| Docker／本機 Supabase stack | 未建立 | iPhone 不作為 Docker 執行環境 |
| DB／RLS／Storage／Edge Function 整合測試 | 未執行 | 不以文件或 mock 規格代替 |
| 新增付費環境 | 未執行 | 未建立雲端專案或付費 Branch |
| 正式環境變更 | 未執行 | 正式 DB／Storage／Functions／Secrets／LINE／官網維持唯讀 |

### Phase 27 結論
- 使用者確認目前只有 iPhone，因此本階段不要求在手機安裝或執行 Docker、Supabase CLI、Deno。
- 已建立免電腦前置工作計畫，先整理測試範圍、合成資料、狀態轉換案例及未來本機啟動順序。
- 本階段不新增付費雲端服務、不使用正式資料、不執行正式環境變更。
- 本機 Supabase stack 與 DB／Storage／Edge Function 整合測試仍未執行；不得標示為通過。

### 下一階段
Phase 28：建立合成測試資料字典與完整測試案例清單，涵蓋涼糕及蘿蔔糕各物流、訪客／會員隔離、付款證明、核款／退款／COD、shipment token lifecycle、通知冪等與 LINE mock。所有資料均為虛構內容；正式環境維持唯讀。

## 31. 2026-11-08 Phase 28 合成測試資料字典與整批驗收矩陣

| 交付 | 狀態 | 備註 |
|---|---|---|
| 合成資料字典 | 已建立初稿 | 全部為虛構資料，不含正式顧客個資 |
| 涼糕／蘿蔔糕四種物流測試 | 已建立 | 送到府、冷藏寄放、冷凍店到店、冷凍宅配 |
| 商品／價格／庫存／優惠測試 | 已建立 | 含停售、改價、超賣、重複送單 |
| 訂單／訪客／會員隔離測試 | 已建立 | 含本人查詢、跨會員拒絕、訪客短效驗證 |
| 付款／退款／COD 測試 | 已建立 | proof_submitted、核款、退款、代收款分離 |
| Token／HMAC／LINE mock 測試 | 已建立 | 有效、過期、重放、簽章、冪等及通知失敗 |
| 後台／官網同步測試 | 已建立 | 權限、稽核、發布同步、錯誤回復 |
| iOS／Android 上架前測試 | 已建立 | 裝置、網路、隱私政策、簽章與商店審核 |
| 自動化 DB／Storage／Edge Function 整合測試 | 未執行 | 尚無本機 Supabase stack |
| 正式環境變更 | 未執行 | 正式 DB／Storage／Functions／Secrets／LINE／官網維持唯讀 |

詳細文件：`app/PHASE_28_SYNTHETIC_FIXTURES_AND_ACCEPTANCE_MATRIX.md`

### Phase 28 結論
- 已建立完整合成資料字典與整批驗收矩陣，涵蓋商品、購物車、四種物流、訂單、會員、付款、退款、COD、token、HMAC、LINE mock、後台、官網同步及上架前品質檢查。
- 文件中所有資料均為虛構測試識別碼，不代表已 seed 至任何資料庫。
- 本階段交付是測試規格，不代表所有測試已執行或通過。
- 因使用者目前只有 iPhone，本機 Supabase 整合測試仍受 Docker／CLI 環境限制；不建立付費雲端替代環境。
- 正式環境仍維持唯讀，沒有部署、資料庫寫入、Storage 上傳、LINE 推播或官網修改。

### 下一階段（整批工作包）
Phase 29：把現有純函式安全測試、狀態機規格與 Phase 28 矩陣合併為一致的可執行測試套件；先進行無外部連線的靜態／純函式檢查，將可在目前工具環境執行的部分一次跑完，並將 DB／Storage／Edge Function／真機測試列為明確阻擋項，不虛報通過。


## 32. 2026-11-08 Phase 29 跨模組純函式測試整合

| 交付 | 狀態 | 備註 |
|---|---|---|
| 跨模組測試入口 | 已建立 | `app/tests/phase29-cross-module.test.js` |
| 通用付款與 merch_orders 狀態邊界 | 已建立測試 | 明確區分通用流程與資料表 CHECK 值 |
| 退款獨立語意 | 已建立測試 | refunded 不可直接寫入 merch_orders.payment_status |
| proof_submitted 與 confirmed 分離 | 已建立測試 | 付款證明提交不等於核款 |
| Shipment 通知資料來源 | 已建立測試 | 以已驗證訂單資料為準，不信任 request body |
| HMAC 訂單／事件綁定 | 已建立測試 | 使用虛構 secret 與資料 |
| 測試實際執行 | 尚未執行 | 目前未在 repo checkout 的 Node runtime 執行新測試檔 |
| DB／RLS／Storage／Edge Function 整合測試 | 未執行 | 缺少 Docker／Supabase CLI／Deno |
| 正式環境變更 | 未執行 | 維持唯讀 |

詳細文件：`app/PHASE_29_CROSS_MODULE_TEST_SUITE.md`

### Phase 29 結論
- 已新增跨模組測試檔，將 Phase 22 通用付款 helper 與 Phase 24 merch_orders canonical 狀態 helper 的語意差異明確測試。
- 覆蓋退款獨立處理、付款證明不等於核款、出貨狀態白名單、通知 payload 信任邊界與 HMAC 綁定。
- 測試程式已提交 GitHub，但本階段未聲稱已執行或通過；必須在取得 repo 的 Node.js 環境後執行指定命令。
- 本階段沒有正式資料庫、Storage、Edge Function、Secrets、LINE 或官網變更。

### 下一階段（整批工作包）
Phase 30：檢查 repo 現有 package scripts、GitHub Actions 與測試檔依賴，建立單一測試入口與 CI 執行設定；在不觸碰正式服務的前提下，盡可能讓純函式測試可由 GitHub 自動執行，並確認目前分支的 CI 狀態。


## 33. 2026-11-08 Phase 30 純函式測試 CI 自動入口

| 交付 | 狀態 | 備註 |
|---|---|---|
| GitHub Actions workflow | 已建立 | `.github/workflows/pure-node-safety-tests.yml` |
| Node.js runtime | CI 指定 | Node.js 22 |
| Phase 22／24／29 測試入口 | 已接入 workflow | 僅執行純函式安全測試 |
| workflow 執行結果 | 待 GitHub Actions 回報 | 建立 workflow 不等於已通過 |
| DB／RLS／Storage／Edge Function | 不在此 CI 範圍 | 仍需隔離 Supabase stack |
| 正式環境變更 | 未執行 | 維持唯讀 |

### Phase 30 結論
- 已新增 GitHub Actions workflow，當 `app/phase-1-planning` 分支 push、PR 或手動觸發時，以 Node.js 22 執行 Phase 22、24、29 純函式測試。
- workflow 不設定 Supabase URL／key，不讀寫正式服務，不呼叫 LINE。
- 尚未取得 GitHub Actions run 結果前，不標示 CI 通過；須待 workflow 回報。
- DB／Storage／Edge Function／真機驗收仍是獨立阻擋項。


## 34. 2026-11-08 Phase 31 App 工程現況與可交付缺口盤點

| 交付 | 狀態 | 備註 |
|---|---|---|
| App 規格／架構文件盤點 | 已完成一輪 | 以 app README、系統架構、tracker 為依據 |
| 可安裝 iOS／Android 工程 | 未證實存在 | 目前可確認交付以規格／原型／測試 helper 為主 |
| App 真實 Auth／商品／訂單 API | 未完成 | 不可把既有官網頁面當成 App 串接 |
| 新老闆後台完整功能 | 未完成 | 既有兩個 merch admin 頁面不等於完整營運後台 |
| 優惠／刮刮樂後端 | 未完成 | 尚無完整後端防重複兌換驗收證據 |
| App Store／Google Play build | 未建立 | 未有可提交簽章 build／商店審核證據 |
| 正式環境變更 | 未執行 | 維持唯讀 |

詳細文件：`app/PHASE_31_APP_ENGINEERING_GAP_AUDIT.md`

### Phase 31 結論
- 目前分支可確認的 App 交付以規格、盤點、原型與純函式安全測試為主，不能宣稱已有可安裝 App。
- 新會員、App API、顧客購物結帳、共用官網資料、完整老闆後台、行銷後端及商店 build 仍是工程工作，不是單靠補文件即可完成。
- 已將真實工程缺口與外部建置限制列明；員工 PDA／員工作業仍依本階段範圍暫緩。
- 正式 Supabase、官網、LINE 與商店均未變更。

### 下一階段（整批工作包）
Phase 32：盤點目前 repo 中可重用的官網頁面、Supabase RPC、資料表及後台元件，建立「現有程式 → App 功能 → 所需 API／資料權限」對照表；標示可直接重用、需包裝、需重寫及不可安全重用的項目。


## 35. 2026-11-08 Phase 32 既有官網／Supabase 至 App 重用對照

| 交付 | 狀態 | 備註 |
|---|---|---|
| 涼糕商品／口味來源 | 已辨識 | `flavors`、`products.html` |
| 涼糕冷藏寄放建單入口 | 已辨識 | `create_cooling_pickup_order` |
| 涼糕送到府資料來源 | 已辨識 | `orders`、`order_items`、`order_private` |
| 蘿蔔糕商品及建單入口 | 已辨識 | `site_admin_content.radish_products`、`create_radish_delivery_order` |
| 餐車／擺攤排程來源 | 已辨識 | `food_truck_schedules`、`food_truck_schedule_flavors` |
| 老闆後台入口及模組 | 已辨識 | `admin-dashboard.html` 與相關管理頁 |
| App API endpoint | 尚未建立 | Phase 32 提供建議契約，不代表 API 已存在 |
| 正式 schema／RPC／RLS 完整驗證 | 尚未完成 | 需要隔離測試環境 |
| 正式環境變更 | 未執行 | 維持唯讀 |

詳細文件：`app/PHASE_32_EXISTING_SITE_TO_APP_REUSE_MATRIX.md`

### Phase 32 結論
- 涼糕冷藏寄放與蘿蔔糕冷凍物流有各自的建單 RPC，不應在 App 前端把兩種訂單合併成一種付款／物流狀態。
- 餐車與擺攤共用排程資料來源，但公開呈現規則不同：餐車可顯示價格，擺攤不顯示價格。
- 蘿蔔糕商品目前可見的官網管理方式使用 `site_admin_content` JSON；需注意併發覆寫、圖片 Storage 政策及商品主資料正規化。
- 現有前端的最低訂購量、運費、價格檢查不能取代 RPC 伺服器端重新驗證；蘿蔔糕頁面可見固定運費顯示值，不應直接當作 App 最終報價來源。
- 舊管理頁直接更新／刪除訂單與狀態的模式不可直接複製到 App；需由安全管理 API、狀態機及稽核機制承接。
- 本階段只有程式與資料來源對照，未建立 API、未修改正式服務。

### 下一階段（整批工作包）
Phase 33：將 App 所需 API 的 request／response、狀態、錯誤碼、權限與資料映射整理成可實作契約，涵蓋公開商品／行程／內容、訪客報價與建單、會員／訪客訂單查詢及老闆管理操作。

## 36. 2026-11-08 Phase 33 App API 契約草案

| 交付 | 狀態 | 備註 |
|---|---|---|
| 共通 API 格式／錯誤碼／冪等規則 | 已建立草案 | request_id、cursor、Idempotency-Key、TWD 整數金額 |
| 商品／口味／公開內容 API | 已建立草案 | 公開欄位白名單；待完整 schema 核對 |
| 餐車／擺攤行程 API | 已建立草案 | 伺服器強制擺攤不回傳價格 |
| 報價／四類履約方式 | 已建立草案 | 涼糕送到府、冷藏寄放、蘿蔔糕冷凍店到店／宅配 |
| 冷藏寄放／蘿蔔糕建單契約 | 已建立草案 | 對照既有 RPC；server-side recalculation 尚待驗證 |
| 會員／訪客 Auth 與訂單存取 | 已建立草案 | 本人隔離、訪客短效存取憑證 |
| 訂單／付款／履約狀態 adapter | 已建立草案 | API 領域狀態與各資料表原生 CHECK 分離 |
| 付款證明／核款／物流 API | 已建立草案 | 私密上傳、授權核款、履約狀態機 |
| 優惠券／刮刮樂 API | 提案，待 schema 核對 | 尚無完整正式 schema／RPC 證據 |
| 老闆管理 API／權限／稽核 | 已建立草案 | admin_profiles、RLS、RPC ACL 尚待完整核對 |
| 正式 API 實作／整合測試 | 未完成 | 尚未建立 endpoints；未執行 DB／RLS／Storage／真機測試 |
| 正式環境變更 | 未執行 | 正式 Supabase、官網、LINE 維持唯讀 |

詳細文件：`app/PHASE_33_APP_API_CONTRACTS.md`

### Phase 33 結論
- 已定義 API 共通格式、商品／內容／行程讀取、報價、不同商品建單、會員／訪客訂單存取、狀態 adapter、付款證明、管理 API、錯誤碼及驗收門檻。
- 餐車可顯示價格、擺攤 API 不回傳價格；此規則由伺服器端 DTO 強制，而非只靠 App 隱藏。
- 客戶端提交的單價、運費、寄放費、折扣與總額均不可信；正式建單前須由後端重新計價及檢查短效報價。
- 涼糕、冷藏寄放、蘿蔔糕與周邊商品的資料表原生狀態不可直接合併；需以逐表 adapter 對照 CHECK constraints 與歷史資料。
- 優惠券／刮刮樂完整 schema 尚未確認，Phase 33 僅定義未來契約提案，不代表現有活動後端已完成。
- 本階段只提交契約文件，沒有建立 API、修改正式資料庫／RLS／Functions／Secrets／LINE 或官網，也未執行整合測試。

### 下一階段（Phase 34）
建立逐 endpoint 的 schema／RPC／RLS 權限對照與實作分解清單：先確認商品、內容、行程公開讀取所需欄位及安全來源，再逐一核對兩個建單 RPC 的 server-side 計價、冪等、狀態與私密資料邊界。優惠券／刮刮樂先查現有 schema，未知項目維持待確認；不部署、不修改正式環境。

## 37. 2026-11-08 Phase 34 API／Schema／權限逐項對照

| 交付 | 狀態 | 備註 |
|---|---|---|
| 商品／內容／行程現有前端呼叫對照 | 已完成第一輪 | 依可讀 GitHub 預設分支程式碼；非正式部署證明 |
| 冷藏寄放 RPC 呼叫參數 | 已確認前端呼叫 | `create_cooling_pickup_order`；完整 SQL 定義與 ACL 尚待取得 |
| 蘿蔔糕 RPC 呼叫參數 | 已確認前端呼叫 | `create_radish_delivery_order`；overload／完整 SQL／ACL 尚待取得 |
| 餐車／擺攤欄位與隱價規則 | 已確認頁面讀取欄位 | API 必須伺服器端省略擺攤價格 |
| 蘿蔔糕 JSON 商品管理 | 已確認前端模式 | `site_admin_content.radish_products` 整份 JSON upsert；有併發覆寫風險 |
| 舊訂單後台寫入風險 | 已確認前端模式 | 直接更新／刪除訂單及個資，不可複製到新 API |
| Auth／RLS／Storage／GRANT 完整核對 | 未完成 | 本階段沒有查詢正式 Supabase metadata |
| 優惠券／刮刮樂 schema | 未確認 | 僅有契約提案，不推定現有資料表 |
| 正式 API／Edge Function 實作 | 未開始 | 未建立 endpoint、未部署 |
| 正式環境變更 | 未執行 | Supabase／官網／LINE／Secrets 維持唯讀 |

詳細文件：`app/PHASE_34_API_SCHEMA_PERMISSION_IMPLEMENTATION_MAP.md`

### Phase 34 結論
- 公開商品、內容與行程可先開發唯讀 DTO 原型，但正式公開讀取仍須確認 schema、RLS 與 Storage。
- 冷藏寄放與蘿蔔糕前端確實呼叫各自 RPC；目前可見冷藏寄放前端會傳入小計、寄放費與總額，蘿蔔糕前端自行顯示固定運費。兩者都必須證明 RPC 伺服器端重新計價，否則不可安全上線。
- 餐車可顯示價格、擺攤不得顯示價格，必須在 API 回應層落實。
- 蘿蔔糕商品目前以 `site_admin_content` JSON array 管理，整份 upsert 有併發覆寫風險。
- 舊訂單後台可直接更新／刪除訂單與個資，不可複製到新 App 管理 API。
- 本階段只檢視程式碼，沒有讀取正式顧客資料、修改正式 Supabase／官網／LINE 或部署。

### 下一階段（Phase 35）
建立不連外的 Node mock reference implementation：公開 catalog、content、food-truck schedule、stall schedule DTO、擺攤隱價、欄位白名單、cursor 分頁與錯誤處理，並加入合成資料自動測試。此為可執行原型，不連正式 Supabase、不視為正式 API。

## 38. 2026-11-08 Phase 35 公開讀取 API Mock 原型

| 交付 | 狀態 | 備註 |
|---|---|---|
| 公開 catalog DTO adapter | 已建立 | 合成資料；涼糕／蘿蔔糕啟用規則分離 |
| 公開 content DTO adapter | 已建立 | section allowlist、published=true fail closed |
| 餐車／擺攤 schedule DTO | 已建立 | 擺攤不回傳 price／currency 欄位 |
| DTO 欄位白名單 | 已建立 | 不複製內部欄位 |
| Cursor mock pagination | 已建立 | offset cursor 僅供原型，正式版需穩定排序／綁定條件 |
| 結構化輸入錯誤 | 已建立 | ApiError、limit／cursor／type 驗證 |
| 合成資料 Node tests | 已建立 | 尚未取得本次 CI 執行結果，不標示測試通過 |
| GitHub Actions workflow | 已建立 | Node.js 22，相關檔案變更時執行 |
| Supabase／HTTP 正式串接 | 未完成 | 無資料庫連線、無正式 endpoint |
| 正式環境變更 | 未執行 | Supabase／官網／LINE／Secrets 維持唯讀 |

新增檔案：
- `app/mock-api/public-read-api.js`
- `app/mock-api/public-read-api.test.js`
- `.github/workflows/app-public-read-api.yml`
- `app/PHASE_35_PUBLIC_READ_API_MOCK_AND_TESTS.md`

### Phase 35 結論
- 已建立純 Node.js 公開讀取 adapter 原型，涵蓋商品、公開內容、餐車／擺攤行程、欄位白名單、隱價、分頁與錯誤驗證。
- 擺攤 DTO 結構完全不含價格欄位；未發布內容 fail closed。
- 測試資料全部為合成資料，不連正式 Supabase。
- GitHub Actions workflow 已提交，但尚未取得本次 CI run 結果，不能宣稱測試通過。
- 本階段沒有建立 HTTP server、沒有正式 API／Edge Function、沒有資料庫串接，也沒有修改正式環境。

### 下一階段（Phase 36）
建立 Node.js built-in HTTP mock server 與標準 response envelope，讓 App 前端可先對接固定路徑；補 request_id、query validation、錯誤 envelope 與 HTTP integration tests。繼續使用合成 fixtures，不連正式 Supabase。

## 39. 2026-11-08 Phase 36 HTTP Mock Server 與 Integration Tests

| 交付 | 狀態 | 備註 |
|---|---|---|
| GET /api/v1/catalog | 已建立 mock route | 商品列表、cursor／limit |
| GET /api/v1/content | 已建立 mock route | 公開發布內容 |
| GET /api/v1/schedules | 已建立 mock route | 餐車／擺攤、type／cursor／limit |
| 共通成功／錯誤 envelope | 已建立 | request_id、api_version、error code |
| Query allowlist／重複參數檢查 | 已建立 | 非法輸入 400 |
| 未知路徑／非 GET 防護 | 已建立 | 404／405，無寫入 endpoint |
| HTTP integration tests | 已建立 | Node fetch + localhost ephemeral port + synthetic fixtures |
| GitHub Actions | 已更新 | 執行 app/mock-api/*.test.js；CI run 尚待確認 |
| 正式 API／Supabase 串接 | 未完成 | 無正式 DB、Auth、HTTP hosting |
| 正式環境變更 | 未執行 | 官網／Supabase／LINE／Secrets 維持唯讀 |

新增檔案：
- `app/mock-api/http-server.js`
- `app/mock-api/http-server.test.js`
- `app/PHASE_36_HTTP_MOCK_SERVER_AND_INTEGRATION_TESTS.md`

更新檔案：
- `.github/workflows/app-public-read-api.yml`

### Phase 36 結論
- 已建立三個 GET mock routes：catalog、content、schedules。
- 所有成功／錯誤回應有 request_id 與 api_version；錯誤使用標準 envelope。
- 僅允許各 endpoint 白名單 query keys，拒絕重複參數與無效值。
- 沒有任何寫入路由；非 GET 回傳 405。
- HTTP tests 使用 localhost ephemeral port 與合成 fixtures，不讀正式資料。
- GitHub Actions 已涵蓋所有 mock API tests，但尚未取得本階段 workflow run 結果，不能標記測試通過。
- 本階段沒有部署正式服務或修改任何正式環境。

### 下一階段（Phase 37）
建立可供 App 前端移植的 API client reference：fetch wrapper、endpoint contract examples、timeout／abort、錯誤解析、cursor pagination helper，並透過 Phase 36 HTTP mock server 測試。維持合成資料，不連正式 Supabase。

## 40. 2026-11-08 Phase 37 App API Client 與測試

| 交付 | 狀態 | 備註 |
|---|---|---|
| 可移植 fetch API client | 已建立 | 無框架依賴，可供 Web／App 前端移植 |
| catalog／content／schedules methods | 已建立 | 僅對應 Phase 36 三個 GET mock routes |
| Timeout／AbortSignal | 已建立 | 區分逾時與呼叫端取消 |
| 統一錯誤解析 | 已建立 | ApiClientError、requestId、fieldErrors、retryable |
| 全頁分頁 helper | 已建立 | maxPages 上限防止無限分頁 |
| API client integration tests | 已建立 | 合成 fixtures + localhost mock server |
| GitHub Actions | 已涵蓋 | workflow 執行全部 app/mock-api/*.test.js；CI run 結果未確認 |
| 正式 App 串接／正式 HTTPS API | 未完成 | 尚無 production API host |
| Supabase／Auth／下單／付款串接 | 未完成 | 本階段不連正式資料 |

新增檔案：
- `app/mock-api/api-client.js`
- `app/mock-api/api-client.test.js`
- `app/PHASE_37_APP_API_CLIENT_AND_TESTS.md`

### Phase 37 結論
- 已建立商品目錄、公開內容、餐車／擺攤行程三組 client methods。
- 已建立 timeout、AbortSignal cancellation、錯誤 envelope 解析與分頁 helper。
- 使用合成資料和本機 HTTP mock server 撰寫測試。
- 尚未取得 GitHub Actions 執行結果，不標記測試通過。
- 沒有正式 App 串接、正式 API 部署或 Supabase／官網變更。

### 下一階段（Phase 38）
建立前端 API contract／DTO schema，明確列出欄位型別、必填／選填、分頁、錯誤碼及餐車／擺攤價格差異，新增 contract validation tests，檢查 mock server、client 與文件一致；不連正式 Supabase。

## 41. 2026-11-08 Phase 38 Public API Contract／DTO Validation

| 交付 | 狀態 | 備註 |
|---|---|---|
| Catalog DTO 規格 | 已建立 | 涼糕／蘿蔔糕類型、價格、幣別、可售狀態 |
| Content DTO 規格 | 已建立 | 已發布 allowlist section，未知欄位拒絕 |
| Schedule DTO 規格 | 已建立 | food_truck／stall 分流 |
| 餐車價格欄位 | 已定義 | price／currency 可選 |
| 擺攤價格欄位 | 已定義 | price／currency 欄位禁止出現 |
| Pagination／Error envelope | 已定義 | cursor、limit、request_id、api_version、錯誤欄位 |
| DTO validators | 已建立 | 無第三方依賴，嚴格 allowlist |
| Contract tests | 已建立 | mapper DTO、成功／錯誤 envelope、價格洩漏與未知欄位 |
| 未定價商品處理 | 已修正 mock | null／undefined／空字串不再轉成 0 元 |
| CI 結果 | 待確認 | 已發現先前 run 有 1 項既有測試失敗，Phase 38 修正後需看新 run |
| 正式 schema／API／App 串接 | 未完成 | 尚未連正式 Supabase 或部署 |

新增檔案：
- `app/mock-api/api-contract.js`
- `app/mock-api/api-contract.test.js`
- `app/PHASE_38_PUBLIC_API_CONTRACT_AND_DTO_VALIDATION.md`

更新檔案：
- `app/mock-api/public-read-api.js`（null price handling 修正）

### Phase 38 結論
- 明確定義 catalog、content、schedule 的 DTO 必填與選填欄位。
- 餐車可包含價格；擺攤 DTO 嚴格禁止 price／currency key。
- DTO validators 拒絕未知欄位，避免內部欄位被意外暴露。
- 發現並修正 null price 被 JavaScript Number(null) 轉成 0 的缺陷。
- 已新增 contract tests；CI 最新 run 結果尚待確認。
- 無正式資料庫、官網、Edge Function、RLS、GRANT、Storage 或 Secrets 變更。

### 下一階段（Phase 39）
建立 App／官網可共用的 repository／adapter 入口與 mock implementation，統一公開讀取呼叫；將 public read 與未來需驗證身份的會員／訂單寫入 API 明確隔離。繼續只使用合成資料。

## 42. 2026-11-08 Phase 39 Public Data Repository

| 交付 | 狀態 | 備註 |
|---|---|---|
| 共用公開 Repository 介面 | 已建立 | catalog／content／schedules |
| HTTP API adapter | 已建立 | 委派 Phase 37 client，保留 envelope/meta |
| Synthetic mock adapter | 已建立 | 使用 Phase 35 mock API，無外部連線 |
| 商品／行程完整分頁 | 已建立 | 含 maxPages 安全上限 |
| 餐車／擺攤資料規則 | 已保留 | 餐車可有價格；擺攤完全無 price／currency |
| 公開與寫入 API 隔離 | 已建立原型邊界 | repository 無訂單／付款／會員寫入方法 |
| Repository tests | 已建立 | adapter 委派、mock 資料、分頁、錯誤 envelope |
| 正式 App／官網串接 | 未完成 | 尚未選定正式 App bundler／部署方式 |
| 正式 API／Supabase 串接 | 未完成 | 不連正式服務、不讀真實顧客資料 |

新增檔案：
- `app/mock-api/public-repository.js`
- `app/mock-api/public-repository.test.js`
- `app/PHASE_39_PUBLIC_DATA_REPOSITORY.md`

### Phase 39 結論
- 建立 App／官網未來共用的公開資料 repository 介面。
- 正式 HTTP client 與 mock adapter 共用同一組方法。
- 公開讀取與訂單、付款、會員等寫入／個資操作保持分離。
- 保留餐車可顯示價格、擺攤完全不含價格欄位的規則。
- 沒有正式環境變更；CI 最新結果需依本階段提交後的 workflow run 核實。

### 下一階段（Phase 40）
建立公開資料 View Model／Presenter，將 catalog、content、food_truck、stall DTO 轉換成顧客 App／官網可直接顯示的安全資料模型，對缺圖、缺時間、缺地區及無價格採明確處理，並以合成資料測試。

## 43. 2026-11-08 Phase 40 Public View Models

| 交付 | 狀態 | 備註 |
|---|---|---|
| 商品列表 View Model | 已建立 | 涼糕／蘿蔔糕、規格、圖片 fallback、價格／可售狀態 |
| 公開內容 View Model | 已建立 | 僅 published=true，安全圖片 URL |
| 餐車行程 View Model | 已建立 | 可顯示有效 TWD 價格 |
| 擺攤行程 View Model | 已建立 | 強制移除 price／currency，畫面不會取得價格欄位 |
| 缺漏資料 fallback | 已建立 | 缺圖、日期、時間、地區、名稱 |
| URL 安全檢查 | 已建立 | 僅 HTTP／HTTPS 圖片 URL |
| View Model tests | 已建立 | 商品、內容、行程、價格、缺漏資料、安全 URL |
| 正式 App UI 串接 | 未完成 | 尚未選定／建立正式 UI framework 與 build |
| 正式資料來源 | 未完成 | 使用 mock DTO，沒有 Supabase／官網正式串接 |

新增檔案：
- `app/mock-api/public-view-models.js`
- `app/mock-api/public-view-models.test.js`
- `app/PHASE_40_PUBLIC_VIEW_MODELS.md`

### Phase 40 結論
- 建立顧客 App／官網可共用的顯示資料轉換層。
- 商品缺價不顯示成 0 元；不可訂購商品明確標示。
- 不安全圖片 URL 不會進入 View Model。
- 餐車可顯示有效價格；擺攤 View Model 完全不輸出價格欄位。
- 尚未接入正式 App 畫面或正式 API，沒有任何正式環境變更。

### 下一階段（Phase 41）
建立 Screen State model，統一首頁、商品列表、行程列表的 loading／success／empty／error／retry／refresh 狀態，並使用 mock repository 測試逾時、取消、重試及資料為空的畫面狀態。

## 44. 2026-11-08 Phase 41 Screen State／載入錯誤與重試模型

| 交付 | 狀態 | 備註 |
|---|---|---|
| 首次載入／成功／空資料狀態 | 已建立 | framework-independent reducer |
| 逾時／網路錯誤狀態 | 已建立 | 依 ApiClientError.retryable 判斷 |
| 重試能力 | 已建立 | 僅提供 canRetry 狀態，不自動重試 |
| 重新整理保留舊資料 | 已建立 | 更新中及更新失敗都保留舊資料 |
| 請求取消 | 已建立 | 支援 AbortController signal 的 loader |
| 舊請求回應保護 | 已建立 | requestId 不符的回應忽略 |
| 自動化測試 | 已建立 | 首次載入、空資料、錯誤、重試、取消、過期回應 |
| 正式 App UI 串接 | 未完成 | 尚未接入正式畫面與真機測試 |
| 正式 API／Supabase 串接 | 未完成 | 仍使用 mock repository |

新增檔案：
- `app/mock-api/screen-state.js`
- `app/mock-api/screen-state.test.js`
- `app/PHASE_41_SCREEN_STATE_AND_RETRY_MODEL.md`

### Phase 41 結論
- 首次載入、空資料、成功、錯誤、重新整理等狀態已統一。
- 可重試錯誤與不可重試錯誤分開處理；沒有自動重試或輪詢。
- 更新失敗保留舊資料，避免畫面突然清空。
- 舊請求回應不會覆蓋新請求。
- loader 支援取消請求；尚未整合正式 App lifecycle。
- 本階段不涉及正式環境、資料庫、官網或付費服務。

### 下一階段（Phase 42）
建立顧客首頁／商品目錄／餐車與擺攤列表的 screen controller 組合層，串接 Phase 39 repository、Phase 40 view models、Phase 41 screen state，提供 load／refresh／cancel，並以 mock fixtures 驗證擺攤資料不會帶出價格。

## 45. 2026-11-08 Phase 42 顧客端畫面資料整合控制器

| 交付 | 狀態 | 備註 |
|---|---|---|
| 首頁已發布內容載入 | 已建立 | 使用公開 repository 與內容 view model |
| 涼糕／蘿蔔糕商品目錄載入 | 已建立 | 使用完整分頁 repository 方法 |
| 餐車行程載入 | 已建立 | 僅查詢 food_truck |
| 擺攤行程載入 | 已建立 | 僅查詢 stall，view model 不輸出價格 |
| 畫面狀態／重新整理 | 已整合 | 使用 Phase 41 reducer |
| 取消／過期請求保護 | 已建立 | 每畫面獨立 AbortController 與 requestId |
| 狀態訂閱／dispose | 已建立 | 供未來 UI 綁定 |
| Mock 自動化測試 | 已建立 | 覆蓋首頁、目錄、行程、空狀態、錯誤、取消、過期回應 |
| 正式原生 UI／真機測試 | 未完成 | 尚無可安裝 App |
| 正式 API／Supabase 串接 | 未完成 | 僅 mock／隔離測試 |

新增檔案：
- `app/mock-api/customer-screen-controller.js`
- `app/mock-api/customer-screen-controller.test.js`
- `app/PHASE_42_CUSTOMER_SCREEN_CONTROLLER.md`

### Phase 42 結論
- 已將 Phase 39 repository、Phase 40 view models、Phase 41 screen state 組合成顧客端四個畫面資料控制器。
- 首頁、商品目錄、餐車與擺攤各自獨立載入、取消及重新整理。
- 擺攤資料輸出不含價格欄位。
- 重新整理失敗保留最後成功資料；舊請求回應不覆蓋新資料。
- 本階段不涉及正式環境或額外費用。

### 下一階段（Phase 43）
建立首頁資訊架構與導覽頁面模型：Banner／公告、商品分類、餐車／擺攤入口、載入／空／錯誤狀態與互動驗收測試；維持框架無關，不誤報成正式可安裝 App。

## 46. 2026-11-08 Phase 43 顧客首頁資訊架構與導覽模型

| 交付 | 狀態 | 備註 |
|---|---|---|
| 顧客主要導覽定義 | 已建立 | 首頁、涼糕、蘿蔔糕、餐車、會員 |
| 首頁快捷入口 | 已建立 | 含擺攤、訂單查詢、客服 |
| Banner／公告／服務說明模型 | 已建立 | 對應已發布 API content keys |
| 首頁商品與行程摘要 | 已建立 | 讀取 Phase 42 畫面狀態 |
| Loading／empty／refreshing／error 呈現 | 已建立 | 不以假資料填補 |
| 未知路由安全回退 | 已建立 | 回到首頁 |
| 導覽及首頁模型測試 | 已建立 | 路由、內容、狀態、暫緩路由 |
| 正式原生 UI／真機測試 | 未完成 | 尚未可安裝 |
| 會員／購物車／訂單正式功能 | 未完成 | 僅宣告資訊架構入口 |

新增檔案：
- `app/mock-api/customer-navigation.js`
- `app/mock-api/customer-navigation.test.js`
- `app/PHASE_43_CUSTOMER_HOME_AND_NAVIGATION.md`

### Phase 43 結論
- 已建立顧客 App 主要導覽、首頁快捷卡片及內容區塊模型。
- 首頁 Banner／公告／服務說明只接受已發布資料，不自行編造。
- 首頁能呈現商品、餐車、擺攤摘要與各自載入狀態。
- 未知路由安全回首頁；不建立本階段暫緩的員工／PDA 功能。
- 本階段仍為框架無關模型與測試，並非正式 App UI。

### 下一階段（Phase 44）
建立涼糕／蘿蔔糕商品專區畫面模型：分類、搜尋、商品卡、停售／缺價狀態、詳情欄位及購物車入口可用性規則；只用 mock 資料與測試。


## 47. 2026-11-08 Phase 44 涼糕／蘿蔔糕商品專區畫面模型

| 交付 | 狀態 | 備註 |
|---|---|---|
| 涼糕／蘿蔔糕分類 | 已建立 | 分類資料隔離 |
| 商品搜尋 | 已建立 | 名稱、介紹、規格 |
| 商品卡與圖片 fallback | 已建立 | 缺圖有明確提示 |
| 價格／停售狀態 | 已建立 | 缺價或停售不可加入購物車 |
| 商品詳情欄位 | 已建立 | 介紹、規格、價格、販售狀態 |
| 購物車入口 gating | 已建立 | 僅回傳導覽意圖，不建立訂單 |
| 合成資料單元測試 | 已建立 | CI 結果待本次提交後確認 |
| 正式商品 API／原生 UI | 未完成 | 仍為純 JS 畫面模型 |
| 正式購物車／下單／付款 | 未完成 | 本階段不寫入任何資料 |

新增檔案：
- `app/mock-api/product-catalog-screen.js`
- `app/mock-api/product-catalog-screen.test.js`
- `app/PHASE_44_PRODUCT_CATALOG_SCREEN_MODELS.md`

### Phase 44 結論
- 涼糕與蘿蔔糕商品專區已具備分類、搜尋、卡片與詳情的顯示模型。
- 不自行計算或補造價格；缺價、待確認價格、停售商品均禁止加入購物車。
- 圖片缺漏時提供 fallback；搜尋無結果與空分類提供不同提示。
- 購物車入口只代表畫面導覽意圖，沒有建立購物車資料或訂單。
- 本階段使用合成測試資料，沒有修改正式 Supabase、官網、LINE、Secrets 或部署。

### 下一階段（Phase 45）
建立購物車純模型：加入／移除商品、數量調整、重複商品合併、價格快照呈現與缺價／停售阻擋；只定義購物車本地資料契約，不建立正式訂單。


## 48. 2026-11-08 Phase 45 購物車本地資料模型

| 交付 | 狀態 | 備註 |
|---|---|---|
| 加入／移除商品 | 已建立 | 純本地不可變狀態 |
| 數量調整 | 已建立 | 1–99；0 代表移除 |
| 相同商品合併 | 已建立 | 商品與規格相同才合併 |
| 商品／價格快照 | 已建立 | 僅顯示加入當下資訊 |
| 缺價／停售阻擋 | 已建立 | 不可加入購物車 |
| 購物車摘要 | 已建立 | 件數、品項數；不計算應付金額 |
| 正式結帳／訂單 | 未完成 | 結帳關閉，沒有任何正式寫入 |
| 持久化／會員同步 | 未完成 | 尚未接入 App UI 或資料庫 |
| 自動化測試 | 已建立 | CI 結果待本次提交後確認 |

新增檔案：
- `app/mock-api/cart-model.js`
- `app/mock-api/cart-model.test.js`
- `app/PHASE_45_CART_MODEL.md`

### Phase 45 結論
- 已建立購物車加入、移除、數量調整與相同商品／規格合併模型。
- 加入時保留商品名稱、規格與價格顯示快照；不代表結帳價格保證。
- 缺價、價格待確認或停售商品無法加入；數量限制為 1 至 99。
- 購物車摘要不計算應付金額，正式結帳維持關閉，需由伺服器重新驗證價格、庫存及費用。
- 本階段只有純 JavaScript 模型與合成測試，沒有正式資料庫、官網或付款變更。

### 下一階段（Phase 46）
建立配送方式與結帳資料模型，區分涼糕送到府／超商冷藏寄放，以及蘿蔔糕冷凍店到店／冷凍宅配；先定義欄位與驗證，不提交訂單、不計收正式運費。


## 49. 2026-11-08 Phase 46 配送方式與結帳資料模型

| 交付 | 狀態 | 備註 |
|---|---|---|
| 涼糕送到府 | 已建立 | chilled 溫層 |
| 涼糕超商冷藏寄放 | 已建立 | 明確不是冷藏宅配 |
| 蘿蔔糕冷凍店到店 | 已建立 | frozen 溫層 |
| 蘿蔔糕冷凍宅配 | 已建立 | frozen 溫層 |
| 混合溫層購物車 | 已建立 | 涼糕／蘿蔔糕要求分開結帳 |
| 收件／門市欄位驗證 | 已建立 | 依配送方式要求欄位 |
| 運費／應付金額 | 未完成 | 保持 null，等待伺服器報價 |
| 正式結帳／建單 | 未完成 | 送單關閉，無正式寫入 |
| 自動化測試 | 已建立 | CI 結果待本次提交後確認 |

新增檔案：
- `app/mock-api/fulfillment-model.js`
- `app/mock-api/fulfillment-model.test.js`
- `app/PHASE_46_FULFILLMENT_MODEL.md`

更新檔案：
- `app/mock-api/cart-model.js`：保留商品類別快照。

### Phase 46 結論
- 涼糕與蘿蔔糕各有兩種明確配送方式，並標示 chilled／frozen 溫層。
- 涼糕超商方式明確為冷藏寄放，不是冷藏宅配。
- 同一購物車混合涼糕與蘿蔔糕時，要求分開結帳。
- 依配送方式檢查收件人、電話、地址或超商門市欄位。
- 運費與應付金額不使用舊前端常數，保持未報價；正式送單維持關閉。
- 本階段只有純 JavaScript 模型與合成測試，沒有修改正式 Supabase、官網或物流服務。

### 下一階段（Phase 47）
建立伺服器報價契約 mock，定義商品價格、配送費、有效期限、幣別、報價版本與購物車摘要；測試不得信任 client 傳入價格或運費，不建立正式訂單。


## 50. 2026-11-08 Phase 47 伺服器權威報價契約模型

| 交付 | 狀態 | 備註 |
|---|---|---|
| 伺服器商品價格快照 | 已建立 | 只讀 trusted catalog，不信任 client 價格 |
| 伺服器物流費率快照 | 已建立 | 不信任 client 運費／總額 |
| 四種配送方式報價分流 | 已建立 | 涼糕 chilled／蘿蔔糕 frozen |
| 報價 ID／版本／幣別 | 已建立 | TWD、quote version |
| 報價有效期限 | 已建立 | 過期即拒絕 |
| 購物車指紋 | 已建立 | 商品／規格／數量／配送方式變更需重報價 |
| 停售／缺價／缺運費阻擋 | 已建立 | fail-closed |
| 正式報價 API／簽章／資料庫保存 | 未完成 | 目前只有 reference model |
| 報價一次性消耗／正式建單交易 | 未完成 | 尚未實作 |
| 自動化測試 | 已建立 | CI 結果待本次提交後確認 |

新增檔案：
- `app/mock-api/quote-model.js`
- `app/mock-api/quote-model.test.js`
- `app/PHASE_47_SERVER_QUOTE_CONTRACT.md`

### Phase 47 結論
- 商品價格與運費只能由可信伺服器快照提供，前端傳入價格／運費／總額不具權威性。
- 報價包含 ID、版本、幣別、明細、小計、運費、總額、期限與購物車指紋。
- 報價逾期、購物車或配送方式變更、商品停售、缺價或缺費率均拒絕使用。
- 此為純 Node reference model，正式系統仍需伺服器保存與驗證報價、一次性消耗及交易建單。
- 沒有連線或修改正式 Supabase、官網、物流商、付款或訂單服務。

### 下一階段（Phase 48）
建立訂單建立前的 server-side checkout gate／冪等契約模型，驗證報價有效、未使用、購物車與收件資料一致，定義 request idempotency key；仍以 mock 與合成測試為主，不寫入正式訂單。

## 51. 2026-11-08 Phase 48 Checkout Gate／冪等性模型

| 交付 | 狀態 | 備註 |
|---|---|---|
| Server-held quote registry reference | 已建立 | 僅以 quote ID 查找，不信任 client quote body |
| 報價有效期限／購物車／配送方式驗證 | 已建立 | 逾期或內容變更拒絕 |
| 收件資料 fingerprint | 已建立 | 報價綁定姓名、電話、地址／門市資料 |
| Session-scoped idempotency key | 已建立 | 相同 key／相同 payload 回傳既有決策 |
| 同 key 不同 payload | 已建立 | 回傳 conflict |
| Quote replay／reservation | 已建立模型 | 同一 quote 不可被不同 key／session 重複使用 |
| 訂單／付款實際執行 | 未完成 | 僅授權決策，不建單、不扣款 |
| DB 原子交易／唯一索引／鎖 | 未完成 | 必須正式後端實作，不可依賴記憶體 Map |
| 自動化測試 | 已建立 | 等待本次 GitHub Actions 結果 |

新增檔案：
- `app/mock-api/checkout-gate.js`
- `app/mock-api/checkout-gate.test.js`
- `app/PHASE_48_CHECKOUT_GATE_AND_IDEMPOTENCY.md`

更新檔案：
- `app/mock-api/quote-model.js`：報價增加收件資料 fingerprint。

### Phase 48 結論
- 建立訂單建立前的授權 gate reference model。
- 僅接受伺服器保存的 quote ID，並驗證報價期限、購物車、配送方式與收件資料。
- 同一 session 的相同 idempotency key／相同 payload 會回傳既有決策；同 key 不同 payload 拒絕。
- 同一報價不能透過不同 key 或 session 重複預約。
- 此模型不建立正式訂單、不執行付款；記憶體 Map 不具真正併發安全或跨程序持久性。
- 正式系統必須在資料庫單一交易內完成 quote 鎖定、冪等紀錄、訂單建立與 quote 消耗，並以唯一索引防止競態。
- 沒有修改正式 Supabase、官網、物流、付款或訂單資料。

### 下一階段（Phase 49）
建立付款狀態與付款通知驗證 reference model：區分建立付款意圖、待付款、付款成功／失敗／逾時、重複 webhook 與簽章驗證；只做合成資料模型與測試，不呼叫金流、不更新正式訂單。

## 52. 2026-11-08 Phase 49 付款意圖與 Webhook 驗證模型

| 交付 | 狀態 | 備註 |
|---|---|---|
| 付款意圖／訂單金額綁定 | 已建立參考模型 | TWD minor units、訂單 ID、金額與期限 |
| 付款冪等 key | 已建立參考模型 | 相同請求重用意圖，不同 payload 衝突 |
| 付款狀態 | 已建立參考模型 | pending／succeeded／failed／expired |
| HMAC 簽章與 timestamp 驗證 | 已建立通用範例 | 必須依實際金流商規格調整 |
| Webhook event 去重 | 已建立參考模型 | 相同事件重播不重複處理 |
| 金額／幣別／provider／intent 核對 | 已建立參考模型 | 不一致拒絕 |
| 正式金流、退款與資料庫交易 | 未完成 | 未選定／串接供應商；沒有扣款 |
| 自動化測試 | 已通過 | GitHub Actions：197／197 通過，0 失敗；Run 42405507575 |

新增檔案：
- `app/mock-api/payment-model.js`
- `app/mock-api/payment-model.test.js`
- `app/PHASE_49_PAYMENT_INTENT_AND_WEBHOOK_MODEL.md`

### Phase 49 結論
- 建立付款意圖與付款狀態的純 Node reference model。
- 以 session-scoped idempotency key 防止重複建立付款意圖。
- 驗證 HMAC 簽章、時間窗、事件 ID、intent、金額、幣別及 provider。
- 重複 webhook 事件不重複處理；終態不得回退或被晚到事件覆蓋。
- 付款成功／失敗／逾時只在模型內反映，沒有呼叫金流、扣款或更新正式訂單。
- 正式金流簽章格式必須依實際供應商官方規格實作，不能直接照搬通用示範。
- 正式系統需在 DB transaction 中鎖定 intent、唯一事件 ID、核對訂單快照並寫稽核紀錄。
- 沒有修改正式 Supabase、官網、Edge Functions、Secrets 或訂單資料。

### 下一階段（Phase 50）
建立退款與付款對帳 reference model：退款申請、核准、處理中、成功／失敗、部分退款上限、重複退款請求冪等性，以及每日交易對帳差異；只使用合成資料，不呼叫金流或修改正式資料。


### Phase 49 測試證據
- GitHub Actions：197 項測試通過，0 項失敗。
- Run：42405507575
- https://github.com/lianggaolaodie-create/lianggaolaodie/actions/runs/42405507575
- 修正測試 fixture 的 webhook timestamp，使逾時情境先通過簽章時間窗，再驗證付款意圖逾時。

## 53. 2026-11-08 Phase 50 退款與付款對帳參考模型

| 交付 | 狀態 | 備註 |
|---|---|---|
| 已付款快照登記 | 已建立參考模型 | 僅合成付款資料 |
| 退款申請／核准／拒絕／處理／成功／失敗 | 已建立參考模型 | 明確限制狀態轉換 |
| 部分退款與累計上限 | 已建立參考模型 | 保留未完成退款額度，防止超退 |
| 退款冪等 key | 已建立參考模型 | 相同請求重用，異 payload 衝突 |
| 付款／退款對帳 | 已建立參考模型 | 比較本地與供應商明細並列差異 |
| 真實金流退款／銀行對帳匯入 | 未完成 | 無供應商串接、無真實資料 |
| 自動化測試 | 已建立 | 等待 GitHub Actions 結果 |

新增檔案：
- `app/mock-api/refund-model.js`
- `app/mock-api/refund-model.test.js`
- `app/PHASE_50_REFUND_AND_RECONCILIATION_MODEL.md`

### Phase 50 結論
- 退款可分次申請，但累計保留金額不得超過已登記的已付款金額。
- requested／approved／processing／succeeded 狀態占用退款額度；rejected／failed 釋放額度。
- 退款請求具冪等 key；同 key 不同內容拒絕。
- 對帳模型會標示本地與外部付款／退款資料缺漏、金額幣別不一致、外部多出紀錄。
- 此模型不會呼叫金流、退款、匯入真實銀行資料或更新正式訂單。
- 正式後端仍需 DB transaction／row lock、供應商 idempotency、可信 webhook、對帳檔來源驗證及稽核軌跡。
- 正式 Supabase、官網、Edge Functions、Secrets 未修改。

### 下一階段（Phase 51）
建立訂單取消與付款／退款／庫存回補協調模型：取消條件、付款前取消、付款後退款、部分出貨限制、取消冪等、退款與訂單狀態不可互相覆蓋，以及庫存回補只發生一次；仍只用合成資料，不執行正式訂單操作。

## 54. 2026-11-08 Phase 51 訂單取消、退款與庫存回補協調模型

| 交付 | 狀態 | 備註 |
|---|---|---|
| 未付款訂單取消 | 已建立參考模型 | 取消後釋放預留庫存一次 |
| 已付款訂單取消 | 已建立參考模型 | 先等待退款確認，不提前標記退款成功 |
| 退款 reference 綁定 | 已建立參考模型 | 不接受未綁定或錯誤 reference |
| 退款成功後庫存回補 | 已建立參考模型 | 重複確認不得重複回補 |
| 部分／全部出貨限制 | 已建立參考模型 | 整單取消阻擋 |
| 處理中訂單 | 已建立參考模型 | 轉人工覆核 |
| 自動化測試 | 已建立 | 等待 GitHub Actions 結果 |

新增檔案：
- `app/mock-api/cancellation-model.js`
- `app/mock-api/cancellation-model.test.js`
- `app/PHASE_51_ORDER_CANCELLATION_COORDINATION.md`

### Phase 51 結論
- 未付款可取消並一次回補預留庫存。
- 已付款取消必須先退款成功，再完成取消與回補庫存。
- 已部分出貨／已出貨不可使用整單取消；處理中訂單轉人工覆核。
- 本階段只做記憶體參考模型及合成測試，不連正式訂單、金流、退款、庫存或 Supabase。
- 正式環境未修改。

## 55. 2026-11-08 Phase 52 訂單／付款／履約／通知協調模型

| 交付 | 狀態 | 備註 |
|---|---|---|
| 訂單、付款、履約分離狀態 | 已建立參考模型 | 三套狀態獨立 |
| 付款前不可出貨 | 已建立參考模型 | 模型內有轉換檢查 |
| 事件 ID 冪等與版本衝突保護 | 已建立參考模型 | 防重送及舊版本覆蓋 |
| 通知 outbox | 已建立參考模型 | 排隊、重試、成功、永久失敗 |
| LINE／Email／SMS／Push 真實發送 | 未完成 | 未串接供應商 |
| 自動化測試 | 已建立 | 等待 GitHub Actions 結果 |

新增檔案：
- `app/mock-api/order-flow-model.js`
- `app/mock-api/order-flow-model.test.js`
- `app/PHASE_52_ORDER_PAYMENT_FULFILLMENT_NOTIFICATION_MODEL.md`

### Phase 52 結論
- 訂單、付款、履約狀態分開，避免狀態互相推測或覆蓋。
- 未付款不可出貨；已取消不可再標記付款成功。
- 事件以 event ID 去重、以版本欄位概念防止舊狀態覆蓋。
- 通知採 outbox 概念，僅建立佇列模型，不實際發送。
- 本階段仍是合成資料與記憶體參考模型；正式資料庫、RPC、RLS、供應商與狀態映射尚待核對。
- 正式 Supabase、官網、Edge Functions、Secrets 未修改。

### Phase 52 自動化測試驗收補記
- GitHub Actions：成功，234 tests passed，0 failed。
- Run： https://github.com/lianggaolaodie-create/lianggaolaodie/actions/runs/42406365357
- 測試涵蓋 Phase 50 對帳案例修正，以及 Phase 52 訂單／付款／履約／通知模型。
- 此為 mock-api 自動化測試，不代表正式 Supabase、金流、物流或通知整合測試。


## 56. 2026-11-08 Phase 53 商品／口味／餐車擺攤發布模型

| 交付 | 狀態 | 備註 |
|---|---|---|
| 商品管理 reference model | 已建立 | owner/admin 權限、版本衝突、價格與上架狀態 |
| 涼糕／蘿蔔糕分開管理 | 已建立 | 商品 type 與口味 productType 分離 |
| 口味管理 | 已建立 | 啟用狀態、所屬商品類型與版本 |
| 價格／上架／停售／開單 | 已建立參考模型 | 商品 state 與 onlineEnabled 分離；正式開單 API 未接 |
| 餐車／擺攤管理 | 已建立參考模型 | food_truck／stall 獨立；日期、地區、地點、時間、口味 |
| 餐車場次價格／擺攤不顯示價格 | 已建立 | 公開 snapshot 對 stall 價格欄位採白名單排除 |
| 官網／App 共用發布資料 | 已建立參考模型 | 同一 snapshot revision 與相同物件 |
| 管理操作稽核 | 已建立參考模型 | audit trail 不輸出到公開資料 |
| 自動化測試 | 已通過 | GitHub Actions：9／9 通過，0 失敗 |
| 正式 Supabase／官網串接 | 未完成 | 正式環境維持唯讀 |

新增檔案：
- `app/mock-api/product-admin-model.js`
- `app/mock-api/product-admin-model.test.js`
- `app/PHASE_53_PRODUCT_FLAVOR_AND_PUBLISHING_MODEL.md`

### Phase 53 限制
- 本階段是純 Node in-memory reference model 與合成測試，不是正式後台 UI 或可安裝 App。
- 尚未對照並映射現有 Supabase schema、RPC、RLS 與官網實際讀寫路徑。
- 沒有執行正式 migration、DML、RLS、Edge Function、Secrets 或官網部署。
- 商品圖片上傳、真實後台 API、正式發布同步及即時推播仍未完成。
- 正式版需以資料庫交易、後端角色授權、版本衝突檢查及稽核紀錄實作。

### 下一階段（Phase 54）
只讀盤點現有商品／口味／每日開單／餐車排程資料表、RPC 與官網讀寫呼叫，建立 schema/API adapter 對照與公開 payload 白名單；不執行正式 migration。


### Phase 53 自動化測試驗收補記
- 獨立 GitHub Actions：9 tests passed，0 failed。
- Run：https://github.com/lianggaolaodie-create/lianggaolaodie/actions/runs/42406974617
- 此結果僅代表 Phase 53 合成資料 reference model 測試通過，不代表正式 Supabase／官網整合完成。


## 57. 2026-11-08 Phase 54 正式 Schema／API Adapter 唯讀盤點

| 交付 | 狀態 | 備註 |
|---|---|---|
| 涼糕 flavors 主檔欄位 | 已盤點 | 36 筆；口味主檔，不是通用商品 SKU |
| 每日開單 settings／regions／flavors | 已盤點 | 每日價格與庫存快照；前端多步非交易式寫入 |
| 餐車／擺攤 schedule schema | 已盤點 | schedule_type 區分；12 餐車、5 擺攤 |
| schedule flavor 價格欄位 | 已盤點 | 64 餐車關聯 price_per_box 有值；14 擺攤關聯為 NULL；price／unit_price 未使用 |
| 蘿蔔糕商品 JSON | 已盤點 | site_admin_content.radish_products，非 relational products table |
| 周邊商品與 PDA 商品分離 | 已盤點 | merch_products、merchandise_products、food_truck_products 各自用途不同 |
| 官網／管理端讀寫路徑 | 已盤點 | products、daily order、schedules、radish JSON、merch |
| 公開 payload 白名單 | 已草擬 | 涼糕、每日開單、餐車、擺攤、蘿蔔糕、周邊商品 |
| RLS／GRANT／RPC／Storage | 已唯讀盤點 | 發現寬鬆 PERMISSIVE policy 與 SECURITY DEFINER grants 風險 |
| 正式資料庫變更 | 未執行 | 僅 SELECT／metadata read；無 DDL／DML／migration |

新增文件：
- `app/PHASE_54_READONLY_SCHEMA_API_ADAPTER_MAP.md`

### Phase 54 重要安全發現（未修補）
- `merch_products` 與 `merch_categories` 存在 authenticated ALL 的 USING true／WITH CHECK true PERMISSIVE policies；會與較嚴格 admin policy 以 OR 合併，造成非管理員寫入風險。
- Supabase Security Advisor 回報 24 個 anon 可執行 SECURITY DEFINER 函式、38 個 authenticated 可執行 SECURITY DEFINER 函式、11 個 mutable search_path 函式；需逐支審查，不可批次撤權。
- admin-products 前端角色准入與 flavors／daily tables 的 RLS 權限條件不一致。
- 每日開單多步刪除／重建沒有單一 transaction；排程前端直接 CRUD 與既有 RPC 語意不一致。
- 以上均只記錄風險，正式環境沒有被修改。

### 下一階段（Phase 55）
先產生安全 policy 修補草案與 rollback，定義單一管理權限矩陣，並建立五類既有資料模型的唯讀 adapter prototypes 與 fixture tests；不部署、不執行正式 SQL，除非另行明確核准。

---

## Phase 55｜安全修補草案、權限矩陣與唯讀 Adapter（2026-11-08）

| 交付 | 狀態 | 驗收／限制 |
|---|---|---|
| 五類 production read-only adapter prototype | 已建立 | 純函式；不連 Supabase；明確 allowlist |
| stall 價格欄位負向測試 | 已建立 | 測試 JSON 不含 price／pricePerBox／unitPrice |
| flavors／daily menu／schedule／radish／merch fixture tests | 已建立 | Node test；不讀正式資料 |
| merchandise RLS 修補 SQL 草案 | 已建立 | placeholder predicate；不可直接執行 |
| rollback／事故處理原則 | 已建立 | 不回復寬鬆 USING true policy |
| admin role matrix | 已建立 | 目標規格；尚未套用正式 DB |
| daily order transaction RPC 設計 | 已建立 | 未部署、未執行 |
| radish JSON optimistic version API 設計 | 已建立 | 未部署、未執行 |
| 正式 Supabase／官網變更 | 未執行 | 維持正式環境唯讀 |

詳細文件：`app/PHASE_55_SECURITY_ROLE_ADAPTERS.md`

### Phase 55 下一步
在本分支擴充每日開單／蘿蔔糕版本控制 mock service，加入 rollback、競爭更新、角色拒絕與 payload contract 測試；仍不連正式環境。
---

## Phase 56｜每日開單與蘿蔔糕商品交易 Mock 服務（2026-11-08）

| 交付 | 狀態 | 備註 |
|---|---|---|
| 每日開單原子替換 Mock | 已建立 | 設定／地區／口味／每日價格快照一次提交 |
| 每日開單樂觀版本控制 | 已建立 | 舊版本寫入拒絕，避免覆蓋新資料 |
| 交易中止回復測試 | 已建立 | 中止時資料、audit、idempotency 不變 |
| 每日開單冪等 key | 已建立 | 相同 payload 重播；不同 payload 衝突 |
| 蘿蔔糕 JSON optimistic version | 已建立 | 僅更新 radish_products section |
| 角色拒絕與資料驗證 | 已建立 | order_admin／一般會員不可寫商品設定 |
| 正式 Supabase RPC／RLS 部署 | 未執行 | Mock-only；正式環境維持唯讀 |

新增檔案：
- `app/mock-api/admin-transaction-mock-service.js`
- `app/mock-api/admin-transaction-mock-service.test.js`
- `app/PHASE_56_ADMIN_TRANSACTION_MOCK.md`

### Phase 56 下一步
擴充跨模組權限／資料快照整合測試，並執行 GitHub Actions；若 runner 未回報成功，不得將測試標為通過。

## Phase 57｜顧客結帳跨模組整合驗證（合成資料／非正式環境）

狀態：已建立整合契約測試；等待 CI 實際執行結果。

新增：
- `app/mock-api/customer-checkout-integration.test.js`
- CI 納入 Phase 57 測試：`.github/workflows/pure-node-safety-tests.yml`

驗證情境：
1. 可信商品價格與配送費進入報價，再由結帳授權閘門核對總額。
2. 同一結帳請求重送時具備冪等回放，不重複保留報價。
3. 相同冪等鍵搭配不同購物車內容會拒絕。
4. 報價逾期後拒絕結帳授權。
5. 客戶端自行附加價格／總額不會成為報價依據。
6. 擺攤公開資料不輸出價格欄位。

重要限制：
- 全部使用合成資料及記憶體模型，未連接 Supabase、正式會員、金流或物流。
- 結帳授權仍明確回傳 `orderCreationEnabled=false`、`paymentExecutionEnabled=false`；本階段沒有建立正式訂單或扣款。
- 此測試只驗證跨模組契約，不代表 App 已可安裝或上架。


## Phase 58｜訂單生命週期跨模組驗證（合成資料／非正式環境）

狀態：已建立整合測試，已納入 CI，等待 runner 結果。

新增：
- `app/mock-api/order-lifecycle-integration.test.js`
- CI 新增 Phase 58 測試步驟。

驗證：
1. 結帳授權不會被誤認為正式訂單建立或已執行付款。
2. 訂單生命週期使用獨立合成訂單編號建立，初始訂單／付款／履約狀態分開。
3. 付款確認後才允許備貨及出貨流程。
4. 訂單通知先進 outbox；重送不重複排隊，發送狀態另行記錄。
5. 舊版本狀態更新遭拒，避免覆蓋較新的訂單狀態。

限制：
- 合成訂單編號不是正式訂單編號規則。
- 沒有建立正式訂單、扣款、物流託運單或實際推播。
- 正式會員登入、顧客訂單查詢 API、後台 UI 及資料庫交易仍未完成。
\n\n## Phase 59｜會員資料與顧客訂單查詢參考模型\n\n| 交付 | 狀態 | 備註 |\n|---|---|---|\n| 外部驗證身份同步會員資料 | 已建立參考模型 | 不收密碼、不簽發 session |\n| 會員個人資料白名單 | 已建立 | 不接受任意欄位寫入 |\n| 會員本人訂單查詢 | 已建立參考模型 | 驗證 subject 與訂單 owner 綁定 |\n| 訪客訂單 claim | 已建立參考模型 | 隨機 token、期限、撤銷；正式版僅保存 hash |\n| 訂單查詢回應去除個資 | 已建立 | 不回傳完整電話、地址、內部備註 |\n| 自動化測試 | 已建立 | 納入 GitHub Actions，等待 runner 結果 |\n| 正式 Supabase Auth／API／RLS | 未完成 | Mock-only，正式環境未修改 |\n\n新增檔案：\n- `app/mock-api/member-order-model.js`\n- `app/mock-api/member-order-model.test.js`\n- `app/PHASE_59_MEMBER_AND_ORDER_LOOKUP.md`\n\n限制：會員登入必須由正式 Auth provider 驗證；正式訂單查詢必須由 server-side RLS／RPC 驗證擁有權。此模型不建立真實會員、不查詢或更動正式訂單。\n\n\n## Phase 60｜老闆後台訂單管理參考模型\n\n| 交付 | 狀態 | 備註 |\n|---|---|---|\n| 線上／現場訂單列表與篩選 | 已建立參考模型 | 涼糕／蘿蔔糕分類 |\n| 付款證明審核 | 已建立參考模型 | proof_submitted 才可確認／駁回 |\n| 備貨／備妥／出貨／送達 | 已建立參考模型 | 未確認付款不可出貨 |\n| 取消規則 | 已建立參考模型 | 已付款需先退款；已出貨不可整單取消 |\n| 角色權限／版本衝突／冪等／稽核 | 已建立 | 記憶體模型 |\n| 擺攤訂單價格欄位 | 已排除列表輸出 | 不把價格放入列表摘要 |\n| 正式後台 UI／API／DB | 未完成 | Mock-only，正式環境未修改 |\n\n新增檔案：\n- `app/mock-api/owner-order-admin-model.js`\n- `app/mock-api/owner-order-admin-model.test.js`\n- `app/PHASE_60_OWNER_ORDER_ADMIN.md`\n\n\n## Phase 61｜商品、口味、每日開單與排程管理畫面原型\n\n| 交付 | 狀態 | 備註 |\n|---|---|---|\n| 商品／口味管理畫面 | 已建立互動原型 | 搜尋、分類、新增示意、停售／啟用 |\n| 每日開單畫面 | 已建立互動原型 | 日期、地區、口味、每日價格與數量 |\n| 餐車／擺攤排程畫面 | 已建立互動原型 | 餐車價格顯示；擺攤不公開價格 |\n| 手機／桌面響應式 | 已建立 | HTML/CSS 原型 |\n| 正式登入／API／Supabase 儲存 | 未完成 | 操作僅在頁面記憶體示意 |\n\n新增檔案：\n- `app/owner-catalog-preview.html`\n- `app/PHASE_61_OWNER_CATALOG_PREVIEW.md`\n\n\n## Phase 62｜訂單後台權限與取消冪等性補強\n\n| 交付 | 狀態 | 備註 |\n|---|---|---|\n| 履約權限最小化 | 已完成 Mock | 個資管理員不可改履約狀態 |\n| 訂單取消冪等性 | 已完成 Mock | 相同請求重播不重複稽核 |\n| 同 key 不同內容防護 | 已完成 Mock | 回傳 IDEMPOTENCY_CONFLICT |\n| 合成測試 | 已新增 | 等待 GitHub Actions 驗證 |\n| 正式環境權限部署 | 未執行 | 需明確核准及 staging 驗證 |\n\n新增文件：`app/PHASE_62_ORDER_ADMIN_PERMISSION_IDEMPOTENCY.md`\n\n\n## Phase 63｜訂單後台操作介面原型\n\n| 交付 | 狀態 | 備註 |\n|---|---|---|\n| 線上／現場訂單列表 | 已建立互動原型 | 合成資料、篩選來源與商品 |\n| 付款審核操作 | 已建立互動原型 | 僅待審核狀態可操作 |\n| 備貨／出貨流程 | 已建立互動原型 | 出貨前付款閘門 |\n| 退款／取消流程 | 已建立互動原型 | 已付款先退款；已出貨不可取消 |\n| 正式 API／金流／物流整合 | 未完成 | 原型不會寫入正式資料 |\n\n新增檔案：`app/owner-order-preview.html`、`app/PHASE_63_OWNER_ORDER_PREVIEW.md`\n

## Phase 64｜老爹 App 顧客端互動原型

| 交付 | 狀態 | 備註 |
|---|---|---|
| 首頁與公告 | 已建立互動原型 | 示意內容 |
| 商品瀏覽 | 已建立互動原型 | 合成商品／價格，不代表實際供應 |
| 購物車 | 已建立互動原型 | 加入、數量調整、小計；不建立訂單 |
| 訂單查詢流程 | 已建立介面 | 不連真實訂單 |
| 餐車／擺攤資訊 | 已建立介面 | 保留餐車可顯價、擺攤不顯價規則 |
| 會員中心 | 已建立介面 | 尚未連接 Auth |
| 正式 API／資料庫／付款 | 未完成 | 本階段不連正式環境 |

新增檔案：
- `app/customer-app-preview.html`
- `app/PHASE_64_CUSTOMER_APP_PREVIEW.md`

### Phase 64 限制
- 本階段是手機優先的 HTML/JavaScript 互動原型，不是可安裝 iOS／Android App。
- 商品、價格與訂單皆為示意；購物車僅存於頁面記憶體。
- 沒有正式會員登入、訂單建立、付款、物流或推播。
- 正式 Supabase、官網與既有訂單資料未修改。

### 下一階段（Phase 65）
建立顧客端與老闆端共用 API contract／欄位映射驗收清單，定義公開商品與排程、個人訂單、管理操作的安全邊界；先做文件與合成測試，不連正式個資、不執行正式寫入。


## Phase 65｜顧客 App／老闆後台共用 API Contract

| 交付 | 狀態 | 備註 |
|---|---|---|
| 公開商品／每日菜單／餐車擺攤 DTO | 已定義規格 | 映射既有資料來源 |
| 蘿蔔糕／周邊商品 DTO | 已定義規格 | 保留不同資料模型 |
| 訂單 quote／建單／查詢契約 | 已定義草案 | 尚未部署正式 API |
| 會員／訪客訂單權限 | 已定義規格 | Auth／claim 尚未接通 |
| 後台角色／版本／冪等規則 | 已定義規格 | 尚未接正式資料庫 |
| 錯誤格式與驗收矩陣 | 已定義 | 下一階段轉成自動化測試 |
| 正式 Supabase／官網變更 | 未執行 | 正式環境維持唯讀 |

新增文件：`app/PHASE_65_SHARED_API_CONTRACT.md`

### Phase 65 限制
- API path／method 是待實作建議契約，不代表目前已有可呼叫服務。
- 未讀取會員個資或正式訂單明細；未執行正式 DB 寫入、RLS、GRANT、RPC、部署或金流操作。
- 已知 merchandise RLS 寬鬆 policy 風險仍未修補，正式串接前必須先處理並測試。

### 下一階段（Phase 66）
建立合成 API contract tests，納入 GitHub Actions，驗證 DTO 白名單、擺攤不輸出價格、結帳不信任客戶端金額、訂單權限及管理角色拒絕案例。


## Phase 66｜共用 API Contract 自動化測試

| 交付 | 狀態 | 備註 |
|---|---|---|
| 公開 DTO allowlist 測試 | 已新增 | 合成 fixtures |
| 每日價格快照／庫存隱藏 | 已新增 | 不輸出精確庫存 |
| 餐車／擺攤價格規則 | 已新增 | 擺攤零價格 key |
| 結帳不信任客戶端金額 | 已新增 | 僅授權模型、不建單 |
| 會員／訪客訂單存取 | 已新增 | 本人驗證、claim 期限與撤銷 |
| 後台角色／出貨付款閘門 | 已新增 | 個資角色拒絕履約；未付款不得出貨 |
| GitHub Actions | 已通過 | Phase 66 全套測試成功（9 項新測試） |
| 正式 Supabase／API | 未連接 | 合成測試，無正式資料寫入 |

新增檔案：
- `app/mock-api/shared-api-contract.test.js`
- `app/PHASE_66_SHARED_API_CONTRACT_TESTS.md`

### Phase 66 限制
- 自動化測試只驗證本地 reference model，不代表正式 API 已建立或正式 DB 已修補。
- 沒有接觸真實會員、訂單、付款、物流或正式 Supabase。

### 下一階段（Phase 67）
建立 HTTP mock contract layer，驗證 endpoint、status code、標準錯誤格式與角色權限，使用合成資料，不連正式環境。


## Phase 67｜HTTP 工作流程契約模擬服務

| 交付 | 狀態 | 備註 |
|---|---|---|
| HTTP server | 已新增 | 合成資料、記憶體模型 |
| Quote API | 已新增 | 使用可信測試商品與費率 |
| Checkout authorization | 已新增 | 不建立訂單、不付款 |
| 會員／訪客查詢 API | 已新增 | owner check／guest claim |
| 後台履約 API | 已新增 | 角色、版本、冪等檢查 |
| 標準錯誤與 request ID | 已新增 | v1 envelope |
| HTTP 整合測試 | 已通過 | Phase 67 HTTP 9 項測試全數成功 |
| 正式 Supabase／Auth／金流 | 未連接 | 無正式資料寫入 |

新增檔案：
- `app/mock-api/workflow-http-server.js`
- `app/mock-api/workflow-http-server.test.js`
- `app/PHASE_67_WORKFLOW_HTTP_CONTRACT.md`

### Phase 67 限制
- 測試用身份 resolver 不是真正登入；此 mock server 不可直接公開部署。
- 無正式訂單建立、金流扣款、物流、資料庫寫入或 production API。

### 下一階段（Phase 68）
整理 staging readiness、正式 API hosting／Auth 架構、環境隔離、RLS 修補驗收與回滾清單；不直接修改正式環境。


### Phase 66／67 CI 驗收補記（2026-11-08）
- Phase 66 commit `dcb1b5666c788f993421c0742dc16882a15656c2`：Pure Node safety tests 與 App public read API mock tests 均成功。
- Phase 67 commit `3b3efb9b2ab8a9de88ca2cdcdc330b924248e00a`：Pure Node safety tests 成功；workflow HTTP contract tests 9/9 通過。
- 此 CI 僅驗證合成資料與本機 mock server，不代表 production API、Auth、Supabase 或金流已部署。


## Phase 68｜Staging Readiness、Auth／API 架構與正式上線閘門（2026-11-08）

| 交付 | 狀態 | 備註 |
|---|---|---|
| Local／CI／Staging／Production 隔離拓樸 | 已建立草案 | staging 須為獨立 project，不含正式個資 |
| 環境變數與 Secrets 清單 | 已建立 | 只列名稱與管理規則，沒有建立或修改 secrets |
| 顧客 Auth／訪客訂單策略 | 已建立草案 | Supabase Auth；Email OTP／magic link 待決定；guest claim 維持獨立驗證 |
| 管理員 Auth／MFA／角色策略 | 已建立草案 | 最小權限、MFA、重要操作重新驗證 |
| API hosting 建議 | 已建立草案 | 優先評估 Supabase Edge Functions；需 staging 驗證 |
| RLS／Function 修補順序 | 已建立 | P0／P1／P2 風險清單；沒有執行 SQL 或部署 |
| Staging 合成資料與測試矩陣 | 已建立 | Auth、RLS、checkout、付款、通知、Storage、官網相容 |
| 回復方案與 Go／No-Go 閘門 | 已建立 | 含停止條件、備份與事故處理 |
| 實際 staging project／整合測試 | 未開始 | 先確認費用並取得核准 |
| 正式 Supabase／官網／金流變更 | 未執行 | 正式環境維持唯讀 |

新增文件：`app/PHASE_68_STAGING_READINESS_AND_RELEASE_GATES.md`

### Phase 68 限制與結論
- 本階段完成架構及上線準備文件，不代表 staging 已建立、Auth 已啟用、Edge Functions 已部署或 RLS 已修補。
- 未建立任何額外服務、未產生新費用、未變更 Supabase secrets。
- Phase 67 mock HTTP server 仍僅供合成測試，不可公開部署。
- 下一階段應先整理 staging 建置所需的最小資源與費用確認清單；取得明確核准後，才建立隔離環境並進行真實整合驗證。


## Phase 69｜最低成本 Staging 建置方案與費用確認（2026-11-08）

| 交付 | 狀態 | 備註 |
|---|---|---|
| $0 mock-only 方案 | 已整理 | 目前建議先採用，不新增服務費 |
| Supabase Free staging | 已整理 | 需確認 Free project 額度；閒置可能暫停、無自動備份 |
| Supabase Pro staging | 已整理 | 官方標價 $25/月起；額外 project compute 可能另計 |
| 最小 staging 資源清單 | 已整理 | DB、Auth、Storage、Edge Functions、測試通知與 sandbox |
| 費用與核准閘門 | 已建立 | 未核准不得建 project、升級、綁卡或啟用付費服務 |
| 帳戶目前方案／Free 額度查核 | 未完成 | 需唯讀檢視帳戶 billing／project 狀態 |
| 實際 staging project | 未建立 | 目前維持 $0 方案 A |

新增文件：`app/PHASE_69_STAGING_MINIMUM_COST_PLAN.md`

### Phase 69 結論
- 以 Supabase 官方 2026-11-08 公開價格頁與 Billing FAQ 建立成本比較；費用以實際帳單為準。
- 目前不需要為了繼續開發而先付費；GitHub Actions、合成 fixtures 與 mock 測試可繼續推進。
- 真實 Auth／RLS／Edge Function 整合需獨立 staging；建立前先確認帳戶額度及所有可能費用，並取得明確核准。
- 本階段未建立新 project、未升級方案、未更動 Secrets、未產生新增費用。


## Phase 70｜合成 Staging Seed 與免費安全測試基礎（2026-11-08）

| 交付 | 狀態 | 備註 |
|---|---|---|
| 合成會員／管理角色 fixtures | 已建立 | 兩位顧客與分離管理角色；僅 `.test` email |
| 商品／口味／餐車／擺攤 fixtures | 已建立 | 餐車公開價格；擺攤內部價格不得輸出 |
| 訂單／訪客 claim／冪等 fixtures | 已建立 | 包含過期與撤銷案例；不含有效真實 token |
| Seed validator | 已建立 | 驗證唯一 ID、測試環境、資料關聯及價格輸出規則 |
| Phase 70 Node tests | 已新增 | 6 項測試，已加入 Pure Node safety workflow |
| GitHub Actions 驗收 | 已通過 | Phase 70 seed tests 成功；整套 Pure Node safety workflow 成功 |
| 真實 RLS／JWT／Function 整合 | 未完成 | 需要獨立 staging project；本階段不連線 |

新增檔案：
- `app/mock-api/staging-seed.js`
- `app/mock-api/staging-seed.test.js`
- `app/PHASE_70_STAGING_SEED_AND_SAFETY_TESTS.md`

CI 更新：`.github/workflows/pure-node-safety-tests.yml`

### Phase 70 限制
- Seed 是純 JS 合成資料，不會連線 Supabase，也沒有資料庫寫入程式。
- 測試只能驗證本地 fixture 與公開 payload helper；不能替代真實 RLS、JWT、Storage 或 Edge Function 權限測試。
- 正式環境、Secrets、官網及會員／訂單資料均未修改。


### Phase 70 CI 驗收補記
- GitHub Actions：Pure Node safety tests 成功。
- Run：https://github.com/lianggaolaodie-create/lianggaolaodie/actions/runs/42410140190
- Phase 70 synthetic staging seed test step：success；6 個測試案例通過。
- 本結果只代表純 JS 合成 fixtures／helper 測試通過，不代表真實 staging、Supabase Auth、RLS 或 Edge Functions 已整合。


## Phase 71｜角色權限自動測試（2026-11-08）

| 交付 | 狀態 | 備註 |
|---|---|---|
| 角色權限 reference model | 已建立 | fail-closed 純 JS 合成模型 |
| 顧客本人資料／訂單隔離 | 已測試 | owner mismatch 與跨會員讀取拒絕 |
| 商品管理員 | 已測試 | 商品／每日開單可用；付款／履約拒絕 |
| 訂單管理員 | 已測試 | 訂單／履約可用；付款／個資拒絕 |
| 付款管理員 | 已測試 | 付款審核可用；履約拒絕 |
| 個資管理員 | 已測試 | 個資檢視可用；商品／付款／履約拒絕 |
| Super admin／訪客 claim | 已測試 | 角色管理限制、有效 claim 閘門 |
| 自動化測試 | 已通過 | 9 個 Node 測試；GitHub Actions 成功 |
| 真實 Supabase Auth／RLS | 未完成 | mock 模型不能代替 staging JWT／RLS 驗收 |

新增檔案：
- `app/mock-api/role-authorization-model.js`
- `app/mock-api/role-authorization-model.test.js`
- `app/PHASE_71_ROLE_AUTHORIZATION_TESTS.md`

CI 更新：`.github/workflows/pure-node-safety-tests.yml`

### Phase 71 限制
- 角色名稱與權限為待正式核對的目標矩陣，不會直接套用到 production。
- 正式 API 與 RLS 必須雙層授權；本階段未執行任何正式 SQL／GRANT／Function 修改。


### Phase 71 CI 驗收補記
- GitHub Actions：Pure Node safety tests 成功。
- Run：https://github.com/lianggaolaodie-create/lianggaolaodie/actions/runs/42410324304
- Phase 71 role authorization test step：success。
- 此結果只驗證純 JS 角色授權模型；不代表正式 Supabase Auth、RLS 或 API 已部署。


## Phase 72｜RLS 權限測試案例與合成 policy 模型（2026-11-08）

| 交付 | 狀態 | 備註 |
|---|---|---|
| RLS policy reference model | 已建立 | 純 JS，未知角色／資料表 fail-closed |
| 會員本人訂單隔離 | 已建立測試 | 跨會員讀取拒絕 |
| 商品／分類寫入限制 | 已建立測試 | 一般會員不可寫入 |
| 管理角色資料表範圍 | 已建立測試 | 商品、訂單、付款、個資分離 |
| 匿名私人資料隔離 | 已建立測試 | 匿名不可讀匯款證明 |
| 公開讀取與寫入權分離 | 已建立測試 | SELECT 不代表 DML |
| 自動化測試 | 已通過 | 10 個 Node 測試；GitHub Actions 成功 |
| 真實 Supabase RLS 驗收 | 未完成 | 必須在獨立 staging 以真實 JWT／policy 驗證 |

新增檔案：
- `app/mock-api/rls-policy-test-model.js`
- `app/mock-api/rls-policy-test-model.test.js`
- `app/PHASE_72_RLS_POLICY_TEST_CASES.md`

CI 更新：`.github/workflows/pure-node-safety-tests.yml`

### Phase 72 限制
- 本階段建立預期政策行為與合成測試，不會執行 SQL 或連線 production。
- 已知 production merchandise permissive policy 風險仍未修補；不能因 mock 測試通過而宣稱正式 RLS 安全。


### Phase 72 CI 驗收補記
- GitHub Actions：Pure Node safety tests 成功。
- Run：https://github.com/lianggaolaodie-create/lianggaolaodie/actions/runs/42410416734
- Phase 72 RLS policy model test step：success。
- 此結果只驗證合成 policy evaluator；真實 Supabase RLS 尚未測試或修補。


## Phase 73｜RLS 修補藍圖與靜態驗收（2026-11-08）

| 交付 | 狀態 | 備註 |
|---|---|---|
| merch_products／merch_categories P0 修補目標 | 已建立 | 明確禁止寬鬆 authenticated ALL |
| orders／transfer_proofs P1 權限目標 | 已建立 | 私有資料要求 owner scope |
| 修補前 policy／grant snapshot 流程 | 已建立 | staging 先驗證 |
| rollback 與停止發布條件 | 已建立 | 每個 migration 必須配對回復方案 |
| 靜態規格驗證 | 已通過 | Node tests；GitHub Actions 成功 |
| staging 真實 SQL／JWT 驗收 | 未完成 | 未建立 staging、未執行 SQL |
| production 修補 | 未執行 | 正式環境保持不變，等待獨立 staging 與明確核准 |

新增檔案：
- `app/security/rls-remediation-plan.js`
- `app/security/rls-remediation-plan.test.js`
- `app/PHASE_73_RLS_REMEDIATION_PLAN.md`

CI 更新：`.github/workflows/pure-node-safety-tests.yml`

### Phase 73 限制
- 目前只建立宣告式修補藍圖與靜態測試，不是 SQL migration，也不會連線資料庫。
- 不可將 Phase 72／73 的 mock 通過視為 production RLS 已安全。
- 未做任何 production DDL、DML、GRANT、policy、function、secret 或 billing 變更。


### Phase 73 CI 驗收補記
- GitHub Actions：Pure Node safety tests 成功。
- Run：https://github.com/lianggaolaodie-create/lianggaolaodie/actions/runs/42410555031
- Phase 73 RLS remediation plan test step：success。
- 只代表修補規格靜態檢查通過，非真實資料庫安全驗證。


## Phase 74｜正式資料庫修補前逐表盤點清單（2026-11-08）

| 交付 | 狀態 | 備註 |
|---|---|---|
| P0 商品／分類 policy 風險清單 | 已建立 | 標示 authenticated permissive ALL 風險 |
| 每日開單／餐車排程資料表盤點 | 已建立 | 欄位與 policy 待 staging 核對 |
| 訂單／明細 ownership 檢查 | 已建立 | owner key、訪客 claim、狀態寫入者 |
| 匯款證明與 Storage 檢查 | 已建立 | object path ownership 與審核紀錄 |
| policy／GRANT／RLS metadata snapshot 流程 | 已建立 | 唯讀 staging metadata |
| 靜態盤點驗證 | 已加入 | Node tests；GitHub Actions 待驗收 |
| 真實 staging 逐表盤點 | 未完成 | 本階段未連線 Supabase |
| production 修補 | 未執行 | 正式環境維持不變 |

新增檔案：
- `app/security/database-prechange-inventory.js`
- `app/security/database-prechange-inventory.test.js`
- `app/PHASE_74_DATABASE_PRECHANGE_INVENTORY.md`

CI 更新：`.github/workflows/pure-node-safety-tests.yml`

### Phase 74 限制
- 本階段使用先前已知 schema 摘要建立清單；未重新查詢 production metadata，也未讀取任何會員／訂單資料。
- 所有未確認欄位與 policy 均明確列為待查，不可視為已驗證現況。
- 未執行 SQL、GRANT、policy、function、Storage、Secrets 或 billing 變更。


## Phase 75｜Staging 唯讀 Metadata Inventory（2026-11-08）

| 交付 | 狀態 | 備註 |
|---|---|---|
| staging metadata-only SQL | 已建立 | READ ONLY transaction；最後 ROLLBACK |
| RLS policy／table grants 查詢 | 已建立 | 僅讀 metadata |
| function security metadata | 已建立 | SECURITY DEFINER／EXECUTE 權限盤點 |
| foreign key／Storage policy metadata | 已建立 | 不讀取 Storage object 或業務資料列 |
| SQL 靜態 guard | 已建立 | 阻擋明顯 DDL／DML／GRANT／REVOKE |
| 自動化測試 | 已通過 | GitHub Actions 成功 |
| 真實 staging SQL 執行 | 未執行 | 尚未確認 staging project ref |
| production 查詢／修改 | 未執行 | production 維持不動 |

新增檔案：
- `app/security/phase-75-staging-metadata-inventory.sql`
- `app/security/readonly-sql-guard.js`
- `app/security/readonly-sql-guard.test.js`
- `app/PHASE_75_STAGING_READONLY_METADATA_INVENTORY.md`

CI 更新：`.github/workflows/pure-node-safety-tests.yml`

### Phase 75 限制
- SQL 尚未在任何資料庫執行；CI 只驗證靜態安全結構。
- SQL guard 非完整 PostgreSQL parser，執行前仍須人工確認環境與內容。
- 未讀取會員、訂單或付款資料；未做 production SQL、GRANT、policy、function、Storage、Secrets 或 billing 變更。


### Phase 75 CI 驗收補記
- GitHub Actions：Pure Node safety tests 成功。
- Run：https://github.com/lianggaolaodie-create/lianggaolaodie/actions/runs/42411120017
- Phase 75 read-only SQL guard test step：success。
- SQL 本身仍未在資料庫執行；CI 僅驗證靜態規則。


## Phase 76｜資料庫 Metadata 快照自動比對（2026-11-08）

| 交付 | 狀態 | 備註 |
|---|---|---|
| RLS 未啟用／policy 缺漏偵測 | 已建立 | 缺 metadata 不視為安全 |
| authenticated permissive ALL 偵測 | 已建立 | 優先識別商品／分類風險 |
| 私人資料無條件 policy 偵測 | 已建立 | 訂單、明細、匯款證明 |
| anon／PUBLIC 寫入 grant 偵測 | 已建立 | critical finding |
| authenticated 寫入 grant 核對提示 | 已建立 | warning，需對照 RLS |
| 合成快照測試 | 已通過 | GitHub Actions 成功 |
| 真實 staging snapshot 比對 | 未執行 | 尚未取得 staging metadata |
| production 變更 | 未執行 | 正式環境維持唯讀 |

新增檔案：
- `app/security/metadata-snapshot-comparator.js`
- `app/security/metadata-snapshot-comparator.test.js`
- `app/PHASE_76_METADATA_SNAPSHOT_COMPARISON.md`

CI 更新：`.github/workflows/pure-node-safety-tests.yml`

### Phase 76 限制
- 比對器只檢查輸入的 metadata snapshot，不連線資料庫、不解析任意 SQL predicate 的完整語意。
- 真實角色 predicate、function grants、Storage policies 仍須 staging 人工審查與 JWT 測試。
- 未讀取 production 資料，未執行 SQL／GRANT／policy／function／Secrets／billing 變更。


### Phase 76 CI 驗收補記
- GitHub Actions：Pure Node safety tests 成功。
- Run：https://github.com/lianggaolaodie-create/lianggaolaodie/actions/runs/42411230640
- Phase 76 metadata snapshot comparator test step：success。
- 只驗證合成 metadata；尚無真實 staging snapshot。


## Phase 77｜資料庫安全風險報告產生器（2026-11-08）

| 交付 | 狀態 | 備註 |
|---|---|---|
| 風險編號／嚴重度／資料表 | 已建立 | critical／warning 分級 |
| 問題原因與修補建議 | 已建立 | 對應各類 metadata finding |
| 修補後驗收標準 | 已建立 | 每項風險提供驗收條件 |
| NO-GO／REVIEW／PASS 閘門 | 已建立 | critical 阻擋 release |
| 合成風險報告測試 | 已通過 | GitHub Actions 成功 |
| 真實 staging 報告 | 未產生 | 尚未取得真實 staging snapshot |
| production 修補 | 未執行 | 正式環境維持唯讀 |

新增檔案：
- `app/security/security-risk-report.js`
- `app/security/security-risk-report.test.js`
- `app/PHASE_77_SECURITY_RISK_REPORT.md`

CI 更新：`.github/workflows/pure-node-safety-tests.yml`

### Phase 77 限制
- 報告只根據輸入 metadata snapshot，不是即時資料庫掃描。
- 未連線 Supabase、未讀取會員／訂單資料、未執行 SQL／GRANT／policy／function／Secrets／billing 變更。


### Phase 77 CI 驗收補記
- GitHub Actions：Pure Node safety tests 成功。
- Run：https://github.com/lianggaolaodie-create/lianggaolaodie/actions/runs/42411324196
- Phase 77 security risk report test step：success。
- 本結果只驗證合成 snapshot 報告產生器。


## Phase 78｜安全修補工作清單與驗收責任分工（2026-11-08）

| 交付 | 狀態 | 備註 |
|---|---|---|
| P0 商品／分類政策修補工作 | 已列管 | 等待獨立 staging |
| P1 訂單／明細 ownership 驗收 | 已列管 | 顧客 A／B 負向測試 |
| P1 匯款證明／Storage 驗收 | 已列管 | 匿名與跨使用者存取拒絕 |
| P1 SECURITY DEFINER 審查 | 已列管 | 逐函式審查，不批次撤權 |
| P2 其他 RLS 缺漏／角色分離 | 已列管 | 待 staging metadata |
| 負責職能、依賴、驗收及 rollback | 已建立 | 尚未指定實際員工 |
| 合成 backlog 測試 | 已通過 | GitHub Actions 成功 |
| 真實 staging 修補 | 未執行 | 尚未建立／確認 staging |
| production 修補 | 未執行 | 需另行明確核准 |

新增檔案：
- `app/security/security-remediation-backlog.js`
- `app/security/security-remediation-backlog.test.js`
- `app/PHASE_78_SECURITY_REMEDIATION_BACKLOG.md`

CI 更新：`.github/workflows/pure-node-safety-tests.yml`

### Phase 78 限制
- 所有修補工作預設 blocked；責任欄是職能角色，不代表已建立實際帳號。
- 本階段不建立 staging、不執行 SQL／policy／GRANT／function，不更動 production 或 secrets。


### Phase 78 CI 驗收補記
- GitHub Actions：Pure Node safety tests 成功。
- Run：https://github.com/lianggaolaodie-create/lianggaolaodie/actions/runs/42411418023
- Phase 78 security remediation backlog test step：success。
- 僅驗證合成工作清單；尚未執行任何真實修補。


## Phase 79｜Staging 修補前核准閘門（2026-11-08）

| 交付 | 狀態 | 備註 |
|---|---|---|
| 必備環境與隔離證據 | 已建立 | staging／production 身分確認 |
| 備份及還原演練條件 | 已建立 | 未實際執行 |
| Migration／rollback 審查條件 | 已建立 | 未執行 SQL |
| 合成角色測試與回歸條件 | 已建立 | 僅列核准門檻 |
| 費用、負責人、明確核准 | 已列入 | 尚未取得核准 |
| Fail-closed gate 程式與測試 | 已建立 | 需 CI 驗收 |
| 建立 staging／production 變更 | 未執行 | 無任何資料庫寫入 |

新增檔案：
- `app/security/staging-approval-gate.js`
- `app/security/staging-approval-gate.test.js`
- `app/PHASE_79_STAGING_APPROVAL_GATE.md`

CI 更新：`.github/workflows/pure-node-safety-tests.yml`
