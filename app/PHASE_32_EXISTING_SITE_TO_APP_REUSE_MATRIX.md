# Phase 32｜既有官網／Supabase 功能重用對照表

日期：2026-11-08  
狀態：依可讀取的既有官網分支檔案進行唯讀比對；不是 API 已建置或正式安全驗收。

## 判讀原則

「可重用」是指可重用的業務概念、資料來源或欄位語意，不代表 App 應直接複製舊網頁 JavaScript 或沿用其前端寫入權限。顧客 App 不應直接獲得管理員資料表寫入能力；重要規則必須由 RPC／Edge Function／資料庫政策重新驗證。

## 功能對照表

| 現有頁面／資料來源 | 已觀察到的用途 | App 可重用部分 | 必須包裝／重寫部分 | 風險／驗收要求 |
|---|---|---|---|---|
| `products.html`、`flavors` | 涼糕商品／口味展示 | 商品、口味、圖片、價格等欄位概念 | 建立 App 商品讀取契約、分類及發布快取 | 核對欄位、價格有效性、enabled 與庫存來源 |
| `convenience-order.html` | 當日涼糕超商冷藏寄放訂購 | `daily_order_settings`、`daily_order_regions`、`daily_order_flavors`、`flavors` 資料概念；RPC `create_cooling_pickup_order` | App 結帳畫面與後端訂單服務 | 前端檢查最低 2 盒、費用與金額只是 UX；RPC 必須伺服器端重新驗證日期、地區、價格、費用、品項與總額 |
| `orders`、`order_items`、`order_private` | 涼糕送到府訂單及私密收件資料 | 分離訂單摘要、明細與私密聯絡資料 | 統一訂單讀取 API／訪客短效驗證 | 不可讓匿名 App 任意 select `order_private`；驗證 RLS／RPC ACL |
| `cooling_pickup_orders`、`cooling_pickup_order_items`、`order_customers` | 涼糕冷藏寄放訂單及聯絡資料 | 訂單／明細／聯絡資料分離 | App 訂單詳情 DTO 與本人／訪客授權 | `order_customers` 是訂單聯絡資料，不等於會員帳號 |
| `radish-cake.html`、`radish-order.html` | 蘿蔔糕商品展示及冷凍物流訂購 | `site_admin_content` 的 `radish_products`、`radish_order_settings` 設定概念；RPC `create_radish_delivery_order` | App 蘿蔔糕商品與結帳流程 | 頁面顯示固定運費 99／129／250；不得把硬編碼費率當正式費率來源。RPC 必須重新驗證價格、物流方式、運費、數量與總額 |
| `radish_orders` | 蘿蔔糕訂單及客戶資料 | 訂單類型、配送方式、收件資訊概念 | 獨立 Radish 訂單 API／資料 adapter | 不可直接與涼糕 orders 或 merch_orders 合併狀態；核對付款／物流狀態 |
| `schedule.html`、`stall-schedule.html` | 顯示餐車／擺攤排程 | `food_truck_schedules`、`food_truck_schedule_flavors`、`flavors` | App 行程列表、地區篩選、地圖及快取 | 擺攤前台不顯示價格；餐車可顯示價格。地址／座標尚需 schema 核對 |
| `admin-food-truck.html`、`admin-stall.html` | 餐車／擺攤管理入口 | 排程與當日菜單的業務概念 | 共用管理 API 與 App 公開發布讀取服務 | 管理頁的直接寫入須檢查角色、RLS、稽核與欄位白名單 |
| `admin-radish-products.html` | 管理 `site_admin_content` 的 `radish_products` JSON 商品清單 | 商品名稱、價格、規格、圖片、上架與線上訂購開關 | 建議逐步遷移至正規化商品資料 API（先做相容 adapter） | JSON array 更新有併發覆寫風險；圖片上傳使用公開 site-images bucket，需確認檔案政策 |
| `admin-orders-fixed-v3.html` | 管理涼糕冷藏寄放與送到府訂單、客戶資料、每日開單資料 | 訂單分流、日設定、品項與顧客資料概念 | 重寫安全後台 API；不可將整份前端管理程式搬入 App | 頁面直接 update／delete 訂單表與個資；狀態清單含 legacy 值，存在狀態語意不一致風險 |
| `admin-radish-orders.html`、`admin-radish-customers.html` | 蘿蔔糕訂單及客戶管理 | 訂單清單、配送方式與客戶資料概念 | 後端授權與安全管理 API | 需檢查每個 update/delete 欄位、操作者權限、稽核、狀態轉換與個資最小化 |
| `admin-dashboard.html` | 後台功能入口 | 功能模組分類及導航資訊 | 新老闆後台資訊架構可參考 | 此頁是功能連結集合，不代表所有連結功能已完整、安全或正式部署 |
| `admin_profiles` | 管理員角色與啟用狀態 | 老闆後台身份授權概念 | 後端統一權限判斷 | 前端檢查 role 不能取代 RLS／RPC ACL；不可將員工登入納入本階段 |
| `site_admin_content` | 首頁、活動、規則、聯絡、蘿蔔糕設定等 JSON 內容 | 官網內容發布資料可供 App 顯示 | 建立只讀 App 公開內容 API 與版本快取 | 不應讓 App 客戶端寫入內容；需確認每個 section 的公開性與資料驗證 |
| `merch_orders`／周邊商品後台 | 周邊商品訂單管理 | 可參考商品與訂單流程 | 獨立 merch adapter | 不與涼糕／蘿蔔糕付款及物流狀態直接混用；沿用 Phase 25–29 已發現的狀態缺口 |

## 已能確認的核心 RPC 與前端責任

### 涼糕冷藏寄放
既有 `convenience-order.html` 呼叫 `create_cooling_pickup_order`，傳入姓名、電話、日期、地區、超商、門市、商品小計、寄放費、總額、付款後五碼、備註及品項。頁面本身檢查最低 2 盒、門市名稱含縣市及付款後五碼格式。以上前端檢查可改善使用體驗，但不可作為安全邊界；RPC 需要重新查詢可信價格與費用並計算總額。

### 蘿蔔糕冷凍物流
既有 `radish-order.html` 呼叫 `create_radish_delivery_order`，傳入客戶姓名、電話、配送資訊、物流方式、備註及商品 ID／數量。頁面以固定 99、129、250 元計算畫面運費；App 不可直接沿用這些硬編碼作最終結帳金額，需由後端讀取可信運費設定並回傳正式報價。

### 餐車／擺攤
既有公開頁讀取 `food_truck_schedules`、`food_truck_schedule_flavors`、`flavors`。餐車顯示口味與價格，擺攤顯示口味但隱藏價格。這項展示規則可重用為 App 公開 API 的欄位／呈現條件。

## App API 邊界建議

1. `GET /app/catalog`：只回傳已發布商品、口味、圖片、價格與可售資訊。
2. `GET /app/schedules`：只回傳已啟用且公開的餐車／擺攤行程；擺攤資料不回傳價格欄位。
3. `POST /app/quotes`：伺服器計算商品價格、物流、運費、折扣與總額；回傳短效報價識別。
4. `POST /app/orders/cooling-pickup`：驗證短效報價並呼叫安全建單流程。
5. `POST /app/orders/radish`：驗證短效報價並呼叫安全蘿蔔糕建單流程。
6. `GET /app/orders`：會員只讀本人訂單；訪客須短效訂單存取憑證。
7. `GET /app/orders/{id}`：回傳最小必要訂單摘要，不直接暴露私密資料表。
8. `GET /app/content`：只讀公開的官網內容 section。
9. 老闆後台使用獨立管理 API；重要寫入必須伺服器端授權、欄位白名單、狀態機、稽核及冪等。

以上為 API 契約建議，不代表這些 endpoint 已存在。

## 不可直接重用的舊程式模式

- 前端自行計算並提交最終價格／運費。
- 前端直接更新付款、物流或訂單狀態。
- 以姓名、電話或訂單號直接授權讀取完整訂單個資。
- 管理後台直接刪除訂單及明細作一般操作。
- 只靠前端 `admin_profiles` role 判斷權限。
- 將 `site_admin_content` JSON 當成無併發問題的商品主資料。
- 將涼糕、蘿蔔糕、周邊商品三種訂單的狀態欄位直接合併。

## 下一步工程排序

1. 完成正式 schema／RPC／RLS／Storage 的唯讀完整盤點與資料字典。
2. 定義上述 API request／response schema 與錯誤碼。
3. 為現有兩個建單 RPC 建立隔離測試，確認 server-side recalculation。
4. 先做只讀商品、內容、行程 API，再做報價／建單 API。
5. 會員 Auth 與訪客訂單存取另設安全流程。
6. 老闆管理 API 最後接入；舊後台在新舊並行驗收前不拆除。

## 安全界線

本階段只新增對照文件；沒有修改正式 DB、RLS、RPC、Storage、Edge Functions、Secrets、LINE 或官網。
