# Phase 54｜正式 Supabase 商品／口味／每日開單／餐車擺攤 Schema 與 API Adapter 唯讀盤點

- 盤點日期：2026-11-08（Asia/Taipei）
- 專案：老爹涼糕官網（Supabase project ref: yemzdwxtyosuaczsqwea）
- Git branch：`app/phase-1-planning`
- 範圍：唯讀 schema metadata、RLS policies、table grants、function metadata／定義、advisor、前端呼叫路徑
- 狀態：盤點完成；未執行正式資料庫／網站寫入

## 1. 安全與操作邊界

本階段只執行資料庫 SELECT、Supabase metadata read、GitHub 檔案 read，以及新增本分支文件。沒有執行：
- DDL、DML、migration、GRANT／REVOKE、RLS policy 修改。
- Storage 上傳／刪除、Edge Function deploy、Secrets 變更。
- 官網部署、正式訂單建立、商品／價格／庫存資料修改。
- 顧客個資、完整訂單明細或秘密值查詢。

Schema row count 是盤點當下統計，不作為業務資料凍結快照。所有 adapter 建議都必須先經 mock／staging 驗收及正式變更核准。

## 2. 實際資料模型總覽

### 2.1 涼糕商品與口味主檔

權威候選：`public.flavors`（目前 36 rows，全數 `product_name='涼糕'`）。

| 欄位 | 用途 | Adapter 欄位 |
|---|---|---|
| id bigint PK | 穩定口味 ID | flavorId |
| product_name text | 商品／產品線名稱，預設涼糕 | productTypeLabel |
| name text unique | 口味名稱 | flavorName |
| description text | 口味介紹 | description |
| price integer | 主檔參考價格 | basePriceTwd |
| image_url text | 圖片 URL | imageUrl |
| enabled boolean | 啟用狀態 | enabled |
| flavor_type text | single／filled／mixed | flavorType |

目前資料分布：filled 18、single 17、mixed 1。這個表是「口味主檔」，不是完整通用商品 SKU 表。不可把每個 flavor row 當成商品種類；`product_name` 是現有產品線分類欄位。

前端：
- `admin-products.html` 直接對 `flavors` select／insert／update／delete。
- `products.html` 讀取啟用中的 flavors，現行查詢使用 `select('*')`。
- `convenience-order.html` 從每日開單明細讀取品項，再以 flavor_id 取得 image_url／flavor_type。
- 圖片上傳使用 Storage bucket `product-images`。

### 2.2 每日線上開單

| Table | 權威欄位 | 用途 |
|---|---|---|
| `daily_order_settings` | order_date PK/unique target、ordering_enabled、notes | 每日是否開放訂購 |
| `daily_order_regions` | id、order_date、region_name、enabled | 當日服務地區 |
| `daily_order_flavors` | id、order_date、flavor_id、product_name、flavor_name、price、enabled、quantity | 當日可訂口味、價格及庫存數量 |

`daily_order_flavors.flavor_id` FK 指向 `flavors.id`；`order_date` FK 指向 `daily_order_settings.order_date`。每日價格是獨立的價格快照，不應在讀取訂單時直接以 flavors.price 覆蓋。

前端：
- `admin-products.html` 讀取每日設定、地區及口味；儲存時 upsert setting，再分別 delete 舊 regions/flavors、insert 新資料。
- 庫存畫面直接 update `daily_order_flavors.quantity`。
- `convenience-order.html` 讀取未來且 ordering_enabled=true 的日期、pickup_settings、該日 regions／flavors；顧客端顯示每日價格與庫存規則。
- RLS public read policies 限制日期不得早於台北今日，並要求 enabled／ordering_enabled=true；管理寫入 policy 限制 super_admin 或 can_manage_products。

風險：現行每日設定寫入是多次 REST 呼叫，沒有單一 DB transaction。中途失敗可能留下只有 setting、缺 regions 或缺 flavors 的部分更新。正式 adapter 應以單一受控 RPC／transaction 寫入完整日設定；本階段不新增該 RPC。

### 2.3 餐車與擺攤排程

| Table | 欄位 | 用途 |
|---|---|---|
| `food_truck_schedules` | id、schedule_date、schedule_type、title、region、start_time、end_time、note、enabled | 行程主檔 |
| `food_truck_schedule_flavors` | schedule_id、flavor_id、price_per_box、price、unit_price | 行程口味關聯及歷史價格欄位 |
| `flavors` | id、name、price、enabled | 口味名稱及基本資料 |

`schedule_type` CHECK 僅允許 `food_truck`／`stall`。目前 17 筆行程：food_truck 12、stall 5；78 筆口味關聯。
- food_truck：64 筆關聯，64 筆都有 price_per_box。
- stall：14 筆關聯，14 筆 price_per_box 均為 NULL。
- 舊欄位 `price`、`unit_price` 目前 78 筆全為 NULL。
- 現有官網 schedule 頁以 `price_per_box` 顯示餐車價；stall 頁不輸出價格。
- 主表目前沒有地址、座標欄位，不能假設已支援精確地圖定位。

前端：
- `admin-food-truck.html`／`admin-stall.html` 直接操作同一組 schedules 與 junction table，透過 schedule_type 分類。
- 官網 `schedule.html` 讀取啟用且未過期行程、schedule flavor links、enabled flavors。
- 官網 `stall-schedule.html` 只呈現擺攤口味名稱，不讀取價格。
- 前端儲存使用直接 insert／update／delete junction rows；停用行程使用 enabled=false。
- DB 另有 `admin_update_food_truck_schedule`、`admin_delete_food_truck_schedule` SECURITY DEFINER RPC，但其簽名／語意與前端直接寫入路徑並非完全一致。刪除 RPC 是實體刪除，前端目前採 soft-disable；不可在 adapter 中互換。

**價格權威建議（尚未執行）：** 先以 `price_per_box` 作為 schedule flavor 唯一有效欄位；`price`、`unit_price` 視為 legacy 欄位，讀取時不得在沒有遷移決策前用它們覆蓋現有資料。stall 公開 payload 必須省略所有價格欄位，而非只送 null。

### 2.4 蘿蔔糕商品

目前官網／管理頁使用 `public.site_admin_content` 的 JSON section：
- `section_id='radish_products'`，JSON path `data.products[]`。
- 商品物件由前端讀取 `id,name,price,spec,description,enabled,online_enabled,image_url,sort` 等欄位。
- `section_id='radish_order_settings'` 的 JSON 設定控制是否開放訂購。
- 官網 `radish-cake.html` 讀取公開內容；`radish-order.html` 讀取訂購開關與產品，並呼叫 `create_radish_delivery_order` RPC。
- `admin-radish-products.html` 以 upsert 整個 JSON section 寫入商品清單；圖片上傳使用 `site-images` bucket。

此模型沒有獨立 relational product table、產品 FK 或 JSON schema version。整包 JSON upsert 有併發覆蓋風險。不能把它與 `flavors`、`merch_products` 混成同一資料表，亦不可直接將舊 JSON 資料轉移或刪除。

### 2.5 周邊商品與 PDA 餐車庫存（必須分開）

| Model | Tables | 現況 | 用途 |
|---|---|---|---|
| 官網周邊商品 | merch_categories、merch_products、merch_orders、merch_order_items | merch_products 目前 0 rows | 尺寸、商品編號、庫存、官網周邊訂購 |
| 舊周邊商品表 | merchandise_products | 目前 0 rows | 舊版簡化產品結構，需確認是否仍被其他頁面使用 |
| PDA 餐車 SKU | food_truck_products、food_truck_barcodes、food_truck_sales | food_truck_products 目前 1 row | 條碼掃描、餐車現場庫存與銷售 |

不可將 PDA 商品／條碼庫存當成官網涼糕口味或每日開單主檔。

## 3. 官網與管理端讀寫路徑對照

| 頁面／流程 | 讀取來源 | 寫入來源 | Adapter 判斷 |
|---|---|---|---|
| 涼糕商品介紹 products.html | flavors | 無 | 可用 flavor catalog read adapter；前端應改明確欄位，不再 select * |
| 商品／口味後台 admin-products.html | flavors | flavors insert/update/delete；product-images upload | 現有直接 CRUD；需保留 flavor_id 與歷史訂單 FK |
| 每日開單後台 admin-products.html | daily_order_settings／regions／flavors | setting upsert、regions/flavors delete+insert | 需要 transaction adapter |
| 顧客冷藏寄放 convenience-order.html | daily settings／regions／daily flavors／flavors／pickup_settings | create_cooling_pickup_order RPC | 訂單價格、費用與庫存必須由 DB 重算，不信任前端總額 |
| 餐車／擺攤後台 | flavors／food_truck_schedules／schedule_flavors | schedules／schedule_flavors 直接 CRUD | 需一致的 transaction API；保留 soft-disable 語意 |
| 餐車公開頁 schedule.html | schedules／schedule_flavors／flavors | 無 | 依 schedule_type 輸出價格白名單 |
| 擺攤公開頁 stall-schedule.html | schedules／schedule_flavors／flavors | 無 | 嚴格不輸出價格 |
| 蘿蔔糕官網與訂購 | site_admin_content JSON | admin JSON upsert；建單 RPC | JSON adapter，需 optimistic version／ETag 或 RPC compare-and-swap |
| 周邊商品 merch.html | merch_products／merch_categories | merch_orders／items | 獨立 merchandise adapter |
| PDA 餐車 | food_truck_products／barcodes／sales | 現場庫存與銷售寫入 | 獨立 PDA adapter |

## 4. 公開 API Payload 白名單草案

以下是新 App／官網共用服務層的輸出白名單，不代表現有前端已遵守；目前部分頁面使用 select('*')，需後續逐步收斂。

### 4.1 涼糕公開商品目錄
```json
{
  "id": 123,
  "productName": "涼糕",
  "name": "口味名稱",
  "description": "公開介紹",
  "price": 100,
  "imageUrl": "https://...",
  "flavorType": "single",
  "enabled": true
}
```
只輸出 enabled=true 的口味。不要輸出管理員 ID、內部權限、庫存管理備註、未發布內容或任何訂單資料。

### 4.2 每日開單公開資料
```json
{
  "orderDate": "YYYY-MM-DD",
  "orderingEnabled": true,
  "regions": ["公開服務地區"],
  "items": [{
    "dailyFlavorId": 1,
    "flavorId": 123,
    "productName": "涼糕",
    "flavorName": "口味名稱",
    "price": 100,
    "enabled": true,
    "available": true
  }]
}
```
只輸出台北今日起、ordering_enabled=true、enabled=true 的日期／地區／口味。quantity 是否對外公開需由業務決定；預設不回傳實際庫存數字，只回傳可訂狀態。價格取每日明細快照，不取 flavors.price。

### 4.3 餐車排程公開資料
餐車：
```json
{
  "id": 1,
  "scheduleDate": "YYYY-MM-DD",
  "scheduleType": "food_truck",
  "title": "涼糕餐車",
  "region": "服務地區",
  "startTime": "10:00",
  "endTime": "18:00",
  "flavors": [{"flavorId": 123, "name": "口味名稱", "pricePerBox": 100}]
}
```
擺攤：
```json
{
  "id": 2,
  "scheduleDate": "YYYY-MM-DD",
  "scheduleType": "stall",
  "title": "擺攤",
  "region": "服務地區",
  "startTime": "10:00",
  "endTime": "18:00",
  "flavors": [{"flavorId": 123, "name": "口味名稱"}]
}
```
stall payload 必須完全沒有 price／pricePerBox／unitPrice 欄位。兩者都不得公開 note（除非另經內容審核）、管理欄位、disabled rows 或私人地址。未有 address／lat／long schema 前不產生地圖座標。

### 4.4 蘿蔔糕商品公開資料
只允許從 radish_products.products 中輸出：
`id,name,price,spec,description,image_url`，且必須同時滿足 `enabled !== false`、`online_enabled === true`、價格有效。內部 sort、管理備註及未發布欄位不公開。

### 4.5 周邊商品公開資料
只允許從 merch_products 與啟用中的 merch_categories 輸出：
`id,category_id,name,description,price,image_url,size_options,product_code,is_new,is_hot`。庫存精確數字、低庫存門檻、movement history、訂單／客戶欄位不公開。

## 5. RLS／GRANT／RPC 安全盤點結果

### 5.1 重要發現：周邊商品兩張表有寬鬆 PERMISSIVE policy

目前 `merch_products` 存在 `merch products admin access`，角色 authenticated、命令 ALL、USING true、WITH CHECK true；`merch_categories` 存在同類 `merch categories admin access` policy。兩表另有 admin_profiles 角色限制 policy。

PostgreSQL PERMISSIVE policy 以 OR 合併；因此寬鬆的 true policy 會讓更嚴格的 admin policy 無法達到預期限制。RLS 雖已啟用，仍不能視為只有管理員能寫入。這是本次發現的高優先安全問題，須先規劃並核准移除／替換寬鬆 policy，再以非管理員與管理員角色做負向／正向測試。本階段未修改。

### 5.2 SECURITY DEFINER 與 EXECUTE

Security Advisor 本次回報：
- anon 可執行 SECURITY DEFINER 函式：24 項。
- authenticated 可執行 SECURITY DEFINER 函式：38 項。
- mutable search_path：11 項。
- RLS enabled but no policies：4 張 LINE 綁定／通知相關表。
- leaked password protection disabled：1 項。

本次核對到 `admin_update_food_truck_schedule`、`admin_delete_food_truck_schedule` 是 SECURITY DEFINER，routine privileges 含 PUBLIC EXECUTE；函式本體有 auth.uid() 與管理權限檢查，但不應僅以「函式會拒絕匿名」取代最小 EXECUTE grant。建議後續核對所有 overload、caller role、search_path、EXECUTE grants 及錯誤回傳。

重要：Advisor warning 是需要逐支審查的風險訊號，不代表 24／38 支函式全部都已證實可被利用；不能在未讀完整定義與 caller flow 前批次 REVOKE，避免破壞官網／LINE 現有流程。

### 5.3 管理端角色檢查不一致

`admin-products.html` 前端允許 super_admin、can_manage_products、order_admin、personal_data_admin 進入；但 flavors／daily settings 的 ALL policy 僅允許 super_admin 或 can_manage_products。前端顯示允許不代表 DB 寫入會成功，應統一權限矩陣及錯誤提示。

餐車／擺攤前端檢查多個歷史旗標；RLS helper 與 RPC 本體使用的旗標條件不完全相同。後續應定義單一權限函式並逐條驗證，而不是在多個前端重複判斷。

### 5.4 Storage

現有 public buckets：`product-images`、`site-images`、`merch-images`、`merchandise-images`；`transfer-proofs` 為 private。
- 涼糕口味圖片上傳：product-images。
- 蘿蔔糕 JSON 商品圖片：site-images。
- 周邊圖片：merch-images／merchandise-images，存在雙 bucket 歷史。
- transfer-proofs 有獨立私密讀取政策，不可加入公開 payload。

### 5.5 Supabase 近期變更相容注意

Supabase 2026-10-30 起對新建 public table 的 Data API exposure 改為明確授權；未來新增資料表需分別檢查 API exposure、GRANT 與 RLS，三者不能混為一談。Supabase CLI v3（2026-11-02 起）預設指向 local stack，對 hosted project 的操作需明確指定 `--remote`，CI 變更亦需明確確認；後續如採 CLI，需固定版本並更新工作流程。本階段沒有使用 CLI 或新增 DB table。

## 6. Phase 54 結論與決策

1. **沒有一張現有表可代表所有商品。** 涼糕是 flavors 主檔＋daily_order_flavors 每日快照；蘿蔔糕是 site_admin_content JSON；周邊商品是 merch_products；PDA 是 food_truck_products。
2. **不可照搬 Phase 53 mock model 直接對接正式 DB。** Phase 53 的通用 products Map 是參考模型，正式 adapter 必須映射上述四套既有模型。
3. 餐車／擺攤共用 schedules table，以 schedule_type 分流；stall 價格必須在公開 payload 層移除。
4. 每日開單與蘿蔔糕商品 JSON 都存在多步／整包寫入風險，正式服務層需 transaction／version guard。
5. **P0 安全事項：** merch_products／merch_categories 寬鬆 PERMISSIVE policies、SECURITY DEFINER EXECUTE 最小權限及權限旗標一致性，應優先安排獨立修補與回歸測試。
6. 正式環境目前未變更；沒有完成可上線的統一 App API。

## 7. 下一階段建議（Phase 55）

先以獨立分支／fixture 完成，不動正式環境：
1. 先為 merch_products／merch_categories 寬鬆 policy 修補產生 SQL 草案及 rollback。
2. 定義單一 admin role matrix，覆蓋 flavor、daily order、schedule、merchandise、PDA。
3. 建立 read-only adapter prototypes：flavor catalog、daily menu、schedule、radish JSON、merchandise；對 stall 價格欄位做 schema-level negative tests。
4. 建立 daily order transaction RPC 與 radish JSON optimistic version API 的設計草案，不部署。
5. 補齊每個公開頁的明確欄位 projection，避免 select *。
6. 以 mock fixtures 驗證舊官網相容、欄位白名單、角色負向測試及 partial failure rollback。
7. 所有正式 Supabase SQL／RLS／RPC／Storage／Edge Function 變更仍需另外取得明確核准。
