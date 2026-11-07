# 老爹．涼糕 App－訂購頁與後台第二輪程式碼盤點

版本：1.0  
盤點範圍：官網目前預設分支的 `online-order.html`、`home-delivery-order.html`、`convenience-order-v2.html`、`admin-orders-stable.html`、`radish-order.html`、`admin-radish-orders.html`。  
本文件為唯讀程式碼盤點，沒有修改正式官網或 Supabase。

## 1. 訂購入口已與使用者截圖相符

`online-order.html` 顯示三個獨立入口：

- 送到府：連到 `home-delivery-order.html`，標示最低 2 盒、貨到付款。
- 超商冷藏寄放：連到 `convenience-order-v2.html`，標示最低 2 盒、需先付款。
- 蘿蔔糕宅配訂購：連到 `radish-order.html`，說明訂單獨立管理。

這與使用者確認的官網畫面一致。**涼糕「送到府」不是蘿蔔糕宅配，也不是一般宅配物流。**

## 2. 涼糕送到府實際流程

檔案：`home-delivery-order.html`

### 前端讀取
- 從 `daily_order_settings` 讀取未來已開放的訂購日期（`ordering_enabled=true`）。
- 顧客選日期後，從 `daily_order_regions` 讀取當日已開放地區。
- 從 `daily_order_flavors` 讀取當日已開放口味、價格與數量設定。
- 從 `flavors` 讀取口味圖片與類型。
- 前端有最低 2 盒檢查，允許多種口味合計達 2 盒。

### 顧客資料與送單
- 必填收件人姓名、手機、送達地址。
- 手機格式檢查為台灣 09 開頭 10 位數。
- 地址欄位要求包含縣市名稱。
- 送單時呼叫 `create_customer_order` RPC，傳入配送日期、配送地區、`pickup_type='home_delivery'`、地址（目前放在參數 `p_pickup_store`）、顧客姓名／電話、備註與口味數量。
- 成功後畫面及 LINE 分享文字標示貨到付款。

### 需要進一步確認
- RPC 的實際函式內容尚未從本輪頁面程式碼證實；必須檢查資料庫函式定義、寫入 `orders`／`order_items`／`order_private` 的欄位映射、總額計算、最低盒數後端驗證及執行權限。
- 地址雖透過名為 `p_pickup_store` 的參數傳入，但後台讀取的是 `order_private.delivery_address`。需以 RPC 定義確認是否正確映射，不可只憑參數名稱推定。
- 前端限制不能取代後端驗證；正式上線前應確認 RPC 在伺服器端也驗證日期、地區、口味是否開放、價格及最低 2 盒。
- 此頁未在前端顯示獨立配送費欄位；目前畫面以 RPC 回傳的 `total_amount` 作為貨到付款金額。不可擅自新增運費或推定永遠免運，需向店家確認目前營運規則及後端計價方式。

## 3. 涼糕超商冷藏寄放實際流程

檔案：`convenience-order-v2.html`

- 讀取 `daily_order_settings`、`daily_order_regions`、`daily_order_flavors` 及 `flavors`。
- 從 `pickup_settings` 讀取全家／7-ELEVEN 是否開放及各自寄放費。
- 最低 2 盒，前端會檢查總盒數。
- 顧客選擇超商、門市，輸入匯款後五碼及聯絡資料。
- 依商品小計及設定的寄放費計算總額。
- 送單呼叫 `create_cooling_pickup_order` RPC，寫入超商寄放訂單及品項。
- 此流程與送到府的 `create_customer_order` 不同，資料表也不同。

待確認：RPC 伺服器端是否重新核算商品價格／寄放費、驗證門市資料及匯款資訊；寄放費設定是否與目前官網畫面一致。舊有取件時限等規則須由店家確認後才能列為現行政策。

## 4. 涼糕訂單後台實際流程

檔案：`admin-orders-stable.html`

- 後台分別讀取 `cooling_pickup_orders` 與 `orders` 中 `pickup_type='home_delivery'` 的訂單。
- 超商寄放品項從 `cooling_pickup_order_items` 讀取。
- 送到府品項從 `order_items` 讀取。
- 超商聯絡人資料由 `order_customers` 取得。
- 送到府姓名、電話、地址由 `order_private` 取得。
- 後台畫面把超商寄放與送到府分開呈現，並各自有狀態選項。
- 目前送到府狀態選項為「待配送、配送中、已送達」；超商狀態選項為「待確認匯款、已付款、已寄放」。

### 重要風險
- 目前送到府後台狀態選單未包含「貨到付款已收款」或其他收款核銷欄位。這表示配送完成與實際收款可能沒有被明確分開記錄；App／後台設計應增加經授權的收款核銷概念，但要先確認現有資料模型與作業流程，不能直接改正式表。
- 後台讀取最多 300 筆訂單，需確認正式管理是否有分頁／日期篩選，避免大量訂單時漏看。
- 後台程式包含刪除訂單的操作；App 新後台應預設使用取消／作廢流程與權限控管，不應讓一般員工任意永久刪除訂單。
- 需確認後台的 RLS／RPC 權限是否真正限制管理員角色；僅在前端檢查登入角色不等於資料庫已安全授權。

## 5. 蘿蔔糕宅配流程（獨立保留）

檔案：`radish-order.html`、`admin-radish-orders.html`

- 顧客頁讀取 `radish_order_settings` 與 `radish_products`，依開單設定及商品 `online_enabled` 顯示商品。
- 顧客需填收件人、電話、縣市，並選擇冷凍物流方式。
- 程式目前顯示全家冷凍店到店 NT$99、7-ELEVEN 冷凍店到店 NT$129、冷凍宅配到府 NT$250。
- 前端以 `create_radish_delivery_order` RPC 建立蘿蔔糕訂單。
- 後台獨立讀取 `radish_orders`、`radish_order_items`，並提供蘿蔔糕專用訂單與客戶管理。

### 重要風險
- 上述三個運費數字目前可在前端程式碼中看到，尚未證實是否由後台設定動態提供或與物流合約最新費率一致。App 不可直接沿用為正式報價；須核對 RPC 是否在伺服器端重新計價及目前有效的運費設定來源。
- 蘿蔔糕宅配與涼糕送到府必須維持不同入口、不同商品、不同付款與訂單狀態流程。

## 6. App 設計應採用的整合方式

| 顧客選擇 | 現有流程 | App 必須保留的規則 |
|---|---|---|
| 涼糕送到府 | `create_customer_order` → `orders` 等相關資料 | 日期、地區、口味、地址；最低 2 盒；貨到付款；老爹自有送達服務 |
| 涼糕超商冷藏寄放 | `create_cooling_pickup_order` → `cooling_pickup_orders` | 超商與門市、寄放費；最低 2 盒；先付款 |
| 蘿蔔糕宅配 | `create_radish_delivery_order` → `radish_orders` | 冷凍物流與宅配收件資料；獨立商品及訂單管理 |

App 可以提供一致的購物體驗及老闆統一查詢入口，但底層建立訂單、付款、費用、物流／配送狀態仍須按各自流程處理。不能為了統一介面而直接合併現有資料表。

## 7. 下一輪必查項目

1. 讀取並審查 `create_customer_order`、`create_cooling_pickup_order`、`create_radish_delivery_order` 三個 RPC 的完整定義。
2. 核對三個 RPC 的 EXECUTE 權限、函式內部授權、search_path、價格／費用伺服器端重算及防止重複送單。
3. 核對送到府的地址是否確實寫入 `order_private.delivery_address`，以及收款核銷是否有現有欄位。
4. 核對超商寄放費設定與蘿蔔糕運費來源，確認前端費用是否與後端一致。
5. 在不修改正式環境的前提下，先提出 App 共用訂單讀取 API 與權限設計。

## 8. 安全界線

本輪只讀取 GitHub 預設分支程式碼。沒有修改官網、正式 Supabase 資料、資料表、RLS、RPC 或付款設定。下一輪如需正式資料庫查詢，先以唯讀方式檢查；任何正式環境變更都須先取得使用者對具體變更及影響的明確同意。
