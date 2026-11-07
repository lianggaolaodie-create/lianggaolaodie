# Phase 9 — 現有資料字典與前台／後台 API 對照（初版）

日期：2026-11-08  
分支：app/phase-1-planning  
範圍：根據目前 GitHub 官網頁面與既有唯讀盤點整理。這是整合設計文件，不執行正式資料庫修改。

## 1. 整合原則

- 保留既有官網頁面與既有訂單資料來源，逐步建立共用服務層。
- 顧客 App、官網、老闆後台可使用不同 UI，但商品、價格、訂單、行程等資料必須來自同一可信來源。
- 前端不得自行決定價格、運費、庫存、付款成功或管理員權限。
- 涼糕送到府、涼糕超商冷藏寄放、蘿蔔糕冷凍物流保留各自訂單流程。
- 本文件未列出的欄位型別、外鍵、索引及約束一律標記待查，不臆測。

## 2. 現有資料表與用途對照

| 資料表 | 已知用途／使用端 | 已知讀寫方式 | 待確認 |
|---|---|---|---|
| flavors | 涼糕口味主檔；商品頁、排程、下單與後台 | 官網讀取名稱、價格、enabled、圖片等欄位 | 完整欄位、商品分類語意、圖片欄位優先序 |
| food_truck_schedules | 餐車／擺攤行程 | 官網首頁與 schedule 頁讀取日期、類型、標題、地區、時間、enabled | 地址、座標、臨時異動、發布狀態欄位 |
| food_truck_schedule_flavors | 行程與口味關聯及當日價格 | 官網依 schedule_id 讀取 flavor_id、price_per_box／price／unit_price | 價格欄位唯一權威來源及衝突處理 |
| daily_order_settings | 涼糕每日開單設定 | 送到府與超商寄放頁讀取開單日期／狀態 | 關閉原因、截止時間、併發控制 |
| daily_order_regions | 每日可訂購地區 | 下單頁與後台讀取 | 地區代碼、配送範圍與地址驗證 |
| daily_order_flavors | 當日開放口味、價格及庫存 | 涼糕送到府 RPC 從資料庫驗證價格／庫存 | 完整欄位、扣庫存鎖定與回補規則 |
| orders | 涼糕送到府主訂單 | create_customer_order 建立；會員本人讀取 policy 已存在 | 狀態欄位、歷史資料關聯及取消／退款流程 |
| order_items | 涼糕送到府商品明細 | 建單 RPC 寫入；目前 SELECT policy 以管理員為主 | 會員本人明細安全查詢方式 |
| order_customers | 訂單聯絡資料 | 官網管理頁讀取／管理 | 不是會員主檔；完整個資權限需再核對 |
| order_private | 涼糕訂單敏感資料，如配送地址 | 管理員及本人依所屬訂單 UID policy 讀取 | 欄位完整清單、地址欄位語意 |
| cooling_pickup_orders | 涼糕超商冷藏寄放主訂單 | create_cooling_pickup_order 建立；管理頁讀取 | 直接 INSERT policy 與 RPC 相容收斂 |
| cooling_pickup_order_items | 冷藏寄放商品明細 | 寄放 RPC 寫入；管理頁讀取 | 明細快照必須改由 DB 已驗證商品資料建立 |
| pickup_settings | 超商寄放費率與啟用設定 | 目前可讀設定包含 FamilyMart／7-ELEVEN 費率與 enabled | 費率是否符合最新合約；不可當成已確認現行報價 |
| payment_settings | 付款設定 | 公開讀取僅 enabled=true；管理角色可寫 | 目前 enabled=false，銀行欄位有 null；付款資料尚不可視為已設定 |
| site_admin_content | 官網管理內容及蘿蔔糕設定 | 官網與後台讀取／管理 | section schema、公開欄位與更新稽核 |
| radish_orders | 蘿蔔糕訂單主檔 | 蘿蔔糕 RPC 建立；管理頁讀取／更新 | 狀態轉移、舊 RPC overload 退場 |
| radish_order_items | 蘿蔔糕商品明細 | 管理頁讀取 | 顧客本人訂單明細查詢方式 |
| admin_profiles | 老闆／管理員角色與啟用狀態 | 管理登入後查 role、enabled 等 | 完整角色名單、每項權限與後端 enforcement |
| merch_products／merch_orders 等 | 周邊商品既有系統 | 既有管理頁與付款同步函式 | 是否納入本階段顧客 App 商品範圍，需使用者確認後再排優先序 |
| merch_backend_sync | 周邊訂單外部同步紀錄 | 目前 RLS disabled；曾檢查到 0 rows | 外部依賴、有效 grants、API exposure；不可直接開 RLS |
| food_truck_barcodes／food_truck_sales 等 | PDA／餐車現場工作資料 | 既有系統資料表 | 員工與 PDA 本階段暫緩，不修改 |

## 3. 現有網站頁面與資料呼叫對照

| 網站頁面 | 已觀察到的資料呼叫 | App 整合方向 |
|---|---|---|
| index.html | food_truck_schedules、food_truck_schedule_flavors、flavors；site_admin_content 首頁內容 | App 首頁與官網首頁讀取同一已發布首頁內容及行程 API |
| products.html | flavors | App 商品／口味頁與官網共用商品讀取契約 |
| schedule.html | food_truck_schedules、food_truck_schedule_flavors、flavors | App 與官網共用排程、當日菜單與公開價格 |
| online-order.html | 三個訂購入口：涼糕送到府、涼糕超商冷藏寄放、蘿蔔糕訂購 | App 結帳需保留不同物流及訂單流程 |
| home-delivery-order.html | daily_order_settings、daily_order_regions、daily_order_flavors；create_customer_order | 顧客 App 呼叫受控建單 API，不直接複製前端商業邏輯 |
| convenience-order-v2.html | daily_order_settings、地區／口味設定；create_cooling_pickup_order | 寄放費由可信設定讀取；修正品項快照及地區驗證後再共用 |
| radish-order.html | site_admin_content.radish_order_settings、radish_products；create_radish_delivery_order | 蘿蔔糕開單、商品與運費均須後端驗證 |
| admin-dashboard.html | 管理入口與功能分組 | 老闆後台整合導覽；員工／PDA功能暫緩 |
| admin-orders-fixed-v3.html | admin_profiles、orders、cooling_pickup_orders、order_customers、daily_order_*、flavors | 老闆後台訂單與每日設定介面；權限改由後端強制 |
| admin-radish-orders.html | admin_profiles、radish_orders、site_admin_content | 蘿蔔糕獨立管理流程整合到老闆後台，但保留資料語意 |

## 4. API／服務契約（目標設計，非現有已部署 API）

### 公開讀取
- getPublishedProducts：只回傳已發布且可公開的商品、口味、價格與圖片。
- getPublishedSchedules：依日期／地區回傳已公開行程、地點、時間與菜單。
- getPublicSiteContent：只回傳公開公告、Banner 與活動內容。
- getCheckoutOptions：依商品類型、訂購日期與地區回傳當下可用配送方式；不可回傳未啟用或不支援選項。

### 顧客身份
- signUp／signIn／signOut／resetPassword：使用 Supabase Auth。
- getMyProfile／updateMyProfile：以 auth.uid() 綁定會員 profile。
- getMyOrders：只回傳目前登入者本人訂單。
- getMyOrderDetail：只回傳本人訂單與本人商品明細；敏感地址依需求最小化。
- lookupGuestOrder：需高熵、短效、限次驗證憑證；不得只憑訂單號或電話公開完整個資。
- claimLegacyOrder：先驗證本人，再將符合條件的舊訪客訂單關聯會員；不可用姓名／電話自動認領。

### 建單
- createHomeDeliveryOrder：後端重新驗證日期、地區、商品、價格、數量、庫存、地址配送資格與付款方式。
- createCoolingStorageOrder：後端重新驗證開單、地區、門市、寄放費、商品價格及庫存；明細快照由 DB 資料產生。
- createRadishFrozenOrder：後端重新驗證蘿蔔糕開單、商品、冷凍物流方式、運費與商品數量。
- 所有建單請求需有冪等鍵或等效重複提交保護。
- 顧客端不得傳入並決定最終商品價格、運費、付款狀態或庫存結果。

### 老闆管理
- adminDashboardSummary：依管理員角色回傳被授權的營運摘要。
- adminManageProducts：依商品管理權限管理商品、口味、圖片及發布狀態。
- adminManageSchedules：管理餐車／擺攤行程及公開菜單。
- adminListOrders：依訂單管理權限讀取分流訂單。
- adminVerifyPayment：僅授權核款角色可核實付款，保留操作者與時間。
- adminUpdateFulfillment：依訂單類型及狀態轉移規則更新物流。
- adminManagePromotions：設定優惠券、會員價及活動規則。
- adminReports：只讀取該管理員有權查看的彙總資料。
- 以上是目標契約名稱，不代表目前資料庫已有同名 RPC 或 API。

## 5. 必須補完的資料字典欄位

以下項目在正式 schema 中需逐欄確認，不能從網頁顯示推定：
- 欄位名稱、資料型別、nullable、default、constraint。
- 主鍵、外鍵、unique、索引及 cascade 行為。
- RLS 是否啟用、每條 policy 的 command／role／USING／WITH CHECK。
- table grants、schema usage、Data API exposed schema。
- RPC 完整簽名、SECURITY DEFINER、search_path、EXECUTE grants、函式內授權。
- trigger、cron、webhook、Edge Function 依賴。
- 官網／管理頁／外部服務對每張表的讀寫路徑。
- 歷史資料品質、空值、重複資料及狀態值分布。

## 6. 待確認的業務設定（不得自行填值）

- 涼糕送到府實際配送區域、運費及配送時段。
- 涼糕超商冷藏寄放最新寄放費、門市限制及取件規則。
- 蘿蔔糕冷凍店到店／宅配最新企業合約與運費。
- 正式付款方式、銀行帳戶資料、是否接第三方金流。
- 會員註冊驗證方式（Email 或手機）及會員權益。
- 會員優惠規則、是否可與其他活動併用。
- App 上架開發者帳號、客服聯絡資料及隱私政策。
- App 是否納入周邊商品購物；目前列為待確認，不假設已包含。

## 7. 風險與上線阻擋項

1. LINE 訂單通知 payload RPC 曾確認可由 anon/authenticated 執行且回傳訂單個資；需先完成安全修正與隔離測試。
2. 付款通知旗標 RPC 曾確認缺少明確 caller authorization；需限制可信服務端使用。
3. 多支 service-role Edge Functions 需完成 caller authentication、冪等與 Secrets 輪替。
4. 涼糕超商寄放 RPC 信任前端寄放費，且明細快照使用前端品名／單價；需修正。
5. 蘿蔔糕舊／新 RPC overload 有硬編碼運費及開單開關檢查缺口；需修正並保留相容。
6. 匯款憑證 Storage bucket 尚需限制 MIME、大小、路徑與訂單綁定。
7. 會員本人訂單明細 API 尚未建立／驗證。
8. 以上在正式修正前，不得宣稱安全或整合驗收通過。

## 8. 本階段界線

- 這份文件只記錄已觀察到的頁面呼叫與既有盤點結果。
- 不執行正式 SQL、資料修改、Function 部署、Secrets 更新或網站發布。
- 不建立付費 Supabase 測試分支。
- 所有目標 API 名稱是設計契約，非現有服務保證。
- 後續取得隔離測試環境前，只能做靜態審查、mock／fixture 測試與文件驗證。
