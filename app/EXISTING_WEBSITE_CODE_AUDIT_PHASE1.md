# 老爹．涼糕｜既有官網程式與資料讀寫盤點（第一輪）

> 盤點日期：2026-11-08
> 範圍：GitHub 預設分支可讀取的官網頁面與管理入口程式碼；另有既有 Supabase schema／Advisor 盤點紀錄。
> 限制：這是靜態程式碼盤點，不是線上瀏覽器測試，也沒有查詢或修改正式資料列。本文件不代表所有頁面、Edge Functions、付款服務或 RLS 已完成審核。

## 1. 第一輪結論

目前官網不是單一資料表或單一訂單流程。程式已直接使用 Supabase JS v2 與公開 publishable key，部分頁面透過 PostgREST 讀取資料；管理後台另有 Supabase Auth 登入與管理員資料檢查。

**可以逐步共用的候選資料：**
- 已發布商品／口味資料。
- 餐車與擺攤排程及各場次口味價格。
- 已確認設計的共用會員身份（需新建 Auth/profile 整合，不能把訂單聯絡資料當會員）。

**必須保留分流的既有流程：**
- 一般訂單與超商冷藏寄放訂單。
- 蘿蔔糕商品／線上訂購流程。
- 不同配送、付款、取貨規則與各自的訂單狀態。

## 2. 已實際讀取的官網檔案

| 檔案 | 第一輪看到的責任 | 串接判斷 |
|---|---|---|
| `index.html` | 首頁；以 Supabase REST 讀取 `site_admin_content` 的 marquee/home 內容；另查 `food_truck_schedules`、`food_truck_schedule_flavors`、`flavors` 呈現首頁行程卡 | 保留既有首頁與動態內容來源；行程查詢可逐步改為共用公開查詢服務 |
| `products.html` | 涼糕口味公開頁（需再深入拆解其壓縮單行程式碼及實際資料讀取） | 先確認讀取表、價格欄位與上架條件，再接共用商品讀取服務 |
| `schedule.html` | 讀取 `food_truck_schedules`，條件為 `enabled=true` 且日期不早於今日；讀取 `food_truck_schedule_flavors` 的 `price_per_box/price/unit_price`，再讀取 `flavors` 的名稱與價格；有縣市篩選 UI | 可作為官網與 App 共用行程資料來源的首選候選；地址、座標、異動通知、發布狀態欄位仍待 schema 確認 |
| `admin-dashboard.html` | 管理入口；Supabase Auth email/password 登入；讀取 `admin_profiles` 的 `role,enabled`，僅允許 `super_admin` 顯示入口；列出餐車、擺攤、商品、蘿蔔糕、訂單、庫存等既有管理頁連結 | 保留現有入口；此 UI 檢查不能取代每個資料表的 RLS／伺服器授權 |
| `radish-order.html` | 從 `site_admin_content` 讀取 `radish_order_settings` 與 `radish_products`；若設定未啟用則停用表單；有配送方式與運費顯示/計算介面；提交時建立蘿蔔糕訂單（需第二輪完整追蹤提交函式及寫入表） | 蘿蔔糕流程保持獨立；正式共用購物車前先核對訂單表、運費來源、付款規則及回呼 |
| `rules.html` | 讀取 `site_admin_content` 的購買規則內容 | 保留動態公告內容管理 |

## 3. 已確認的資料讀取關係

### 首頁行程卡（index.html）
- `food_truck_schedules`：讀取場次 ID、日期、地區、開始／結束時間、標題、類型、啟用狀態。
- `food_truck_schedule_flavors`：依場次查口味關聯。
- `flavors`：依口味 ID 查名稱／圖片等資料。
- 首頁另外透過 REST API 讀取 `site_admin_content` 的 marquee/home 區塊。

### 出攤完整列表（schedule.html）
- `food_truck_schedules`：`enabled=true`、日期大於等於今日、依日期排序。
- `food_truck_schedule_flavors`：讀取場次口味關聯與三種候選價格欄位。
- `flavors`：讀取口味名稱、價格、啟用狀態。
- 畫面已具備縣市篩選；目前顯示的場次地址／座標能力尚未由本輪程式碼證實。

### 管理入口（admin-dashboard.html）
- 透過 Supabase Auth `signInWithPassword` 登入。
- 查 `admin_profiles`，依 `user_id` 取 `role,enabled`。
- 前端僅允許 `role='super_admin'` 且 `enabled=true` 進入管理首頁。
- **安全要求：** 必須再檢查各子管理頁的 Auth 檢查、資料表 RLS、RPC 權限及資料範圍；不能因管理首頁有檢查就認定後端安全。

## 4. 既有訂單的分流邊界

既有程式與資料盤點顯示至少存在以下不同流程：

| 流程 | 已知資料表 | 整合方式 |
|---|---|---|
| 一般訂單／宅配 | `orders`, `order_items`, `order_private` | 保留訂單主檔、明細與私密聯絡資料；統一工作清單只做呈現層整合 |
| 超商冷藏寄放 | `cooling_pickup_orders`, `cooling_pickup_order_items`, `order_customers` | 保留寄放訂單與取件資訊；不可併成宅配 |
| 純米蘿蔔糕訂購 | 程式使用 `site_admin_content` 的設定與商品資料；實際訂單表需再追蹤 | 維持獨立商品、配送及訂單規則，完成追蹤後再決定共用 API 的邊界 |
| 現場餐車銷售 | `food_truck_sales` 等既有 PDA/餐車表 | 等 PDA 型號、掃碼方式及現場作業確認後再整合 |

不要把 `order_customers` 當成會員帳號，也不要只靠姓名／電話把舊訂單自動連到新會員。

## 5. 第一輪發現的工程與安全注意事項

1. 官網前端可見的 Supabase publishable key 是公開客戶端金鑰的使用方式；它本身不是 service-role key。安全性仍完全依賴 RLS、grants、函式權限與資料最小暴露。
2. 管理首頁的 `admin_profiles` 前端角色檢查只能控制畫面顯示；真正資料讀寫仍須在 RLS／後端重新授權。
3. 首頁與出攤頁目前有直接查詢排程與口味的邏輯。未來共用前應先定義唯一公開欄位與發布條件，避免首頁、官網行程頁、App 各自使用不同篩選。
4. `schedule.html` 的價格會依序從場次關聯的 `price_per_box`、`price`、`unit_price`、最後口味預設價取值。正式規格需確認這個 fallback 是否為刻意設計，並固定成明確的價格優先順序。
5. `radish-order.html` 顯示有獨立開單開關與配送欄位。需再檢查提交函式、運費計算及實際寫入表，不能直接改成涼糕訂單流程。
6. `admin-dashboard.html` 是既有管理入口，應先維持原樣；新老闆後台原型不能取代現有管理系統，直到功能逐項驗收。
7. 此輪未測試金流 webhook、退款、Storage policies、所有子後台及資料表 RLS，不能宣稱已通過安全審核。

## 6. 建議的下一輪檢查清單

優先逐一讀取下列頁面與流程，建立「頁面 → 讀取表 → 寫入表 → RPC／Edge Function → 權限」對照：

- `online-order.html`：涼糕線上訂購、訂單建立、配送選項與運費。
- `admin-products.html`：口味新增／修改／上下架及價格來源。
- `admin-food-truck.html`、`admin-stall.html`：排程、場次菜單與價格更新。
- `admin-orders-fixed-v3.html` 及相關訂單後台：訂單狀態、付款核對、出貨操作。
- `radish-order.html`：完整追蹤提交函式、訂單資料表及運費來源。
- 相關 Supabase functions、RLS policies、Storage policies 與付款 webhook。

完成以上追蹤後，才可以定義正式共用 API 介面與最小權限策略。

## 7. 本輪未執行的操作

- 沒有新增／修改／刪除正式資料列。
- 沒有執行 DDL、migration、RLS、grants 或 Auth 設定修改。
- 沒有改動正式官網頁面或切換流量。
- 沒有在瀏覽器中進行實際購物／付款測試。
