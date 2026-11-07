# Phase 55｜安全修補草案、權限矩陣與五類唯讀 Adapter

- 日期：2026-11-08（Asia/Taipei）
- 分支：`app/phase-1-planning`
- 狀態：設計／Mock adapter prototype；未部署、未連線正式 Supabase。
- 安全界線：本文件 SQL 僅供審查，不能直接執行。正式 policy 名稱、admin_profiles 欄位、既有 helper 與所有相依流程仍須再次唯讀確認。

## 1. P0 merchandise RLS 修補計畫

Phase 54 已確認 `merch_products` 與 `merch_categories` 各有 authenticated／ALL／USING true／WITH CHECK true 的寬鬆 PERMISSIVE policy。PERMISSIVE policies 以 OR 合併，故必須移除寬鬆 policy，而不是再疊加一條更嚴格 policy。

### 1.1 執行前必查
1. 重新匯出兩表完整 pg_policies、table grants、API exposure 與 admin_profiles schema。
2. 找出所有其他 permissive policies，確認 public read、authenticated read 與管理寫入是否需分開。
3. 找出現有權限 helper 的精確函式名稱、參數、回傳型別、SECURITY DEFINER／search_path 與呼叫者。
4. 以正式管理員、一般登入會員、匿名使用者各一組 staging 身分做正反向測試。
5. 備份現有 policy DDL、grants、schema 與資料；確認可回復方案。

### 1.2 不可直接執行的 SQL 模板
下列模板刻意保留 `<VERIFIED_ADMIN_PREDICATE>` 佔位符，因 Phase 54 尚未確認 admin_profiles 欄位及 canonical helper。必須先替換並 code review，否則 SQL 會失敗；不可自行猜欄位名稱。

```sql
-- REVIEW TEMPLATE ONLY — DO NOT EXECUTE AS-IS.
BEGIN;

DROP POLICY IF EXISTS "merch products admin access" ON public.merch_products;
DROP POLICY IF EXISTS "merch categories admin access" ON public.merch_categories;

-- Replace the placeholder with the verified, shared admin predicate.
-- Keep SELECT policies separate from INSERT/UPDATE/DELETE policies.
CREATE POLICY "merch products admin write"
ON public.merch_products
AS PERMISSIVE
FOR ALL
TO authenticated
USING (<VERIFIED_ADMIN_PREDICATE>)
WITH CHECK (<VERIFIED_ADMIN_PREDICATE>);

CREATE POLICY "merch categories admin write"
ON public.merch_categories
AS PERMISSIVE
FOR ALL
TO authenticated
USING (<VERIFIED_ADMIN_PREDICATE>)
WITH CHECK (<VERIFIED_ADMIN_PREDICATE>);

-- Mandatory staging assertions before commit:
-- anon: no write; authenticated non-admin: no write;
-- verified admin: permitted write; public read behavior unchanged.
-- ROLLBACK is the default until all assertions pass.
ROLLBACK;
```

正式版本應以最小命令範圍拆分 SELECT／INSERT／UPDATE／DELETE policy，並只授權已驗證的管理 helper。若需要保留公開讀取，另設明確 SELECT policy；不可用 FOR ALL 包含讀取而造成權限擴張。

### 1.3 Rollback 草案原則
- 回復前先確認新 policy 與舊 policy 的差異、目前資料與實際 grants。
- 回復只還原先前匯出的 policy 定義與 grants，不可把 `USING true` 寬鬆 policy 當作安全 rollback。
- 若修補導致合法管理者無法操作，優先暫停該管理寫入入口／feature flag，保留資料讀取；由已驗證的管理 predicate 修正後再部署。
- 任何正式回復／修補都需另行取得明確核准；本階段沒有執行 SQL。

## 2. 統一管理權限矩陣（目標規格，非現況授權）

| 模組 | owner | super_admin | can_manage_products | order_admin | personal_data_admin | 一般會員／匿名 |
|---|---:|---:|---:|---:|---:|---:|
| flavors 口味主檔 | 管理 | 管理 | 管理 | 讀取 | 無 | 僅公開啟用資料 |
| daily order 設定／地區／口味 | 管理 | 管理 | 管理 | 讀取 | 無 | 僅公開可訂資料 |
| food truck／stall schedules | 管理 | 管理 | 管理 | 讀取 | 無 | 僅公開行程 |
| merchandise 商品／分類 | 管理 | 管理 | 依明確授權 | 讀取 | 無 | 僅公開上架資料 |
| PDA SKU／barcode／sales | 保留 owner 管理 | 保留 super_admin 管理 | 不自動授權 | 不自動授權 | 無 | 不開放；PDA 本階段暫緩 |
| 訂單與付款 | 管理 | 依職務授權 | 無 | 訂單／付款流程 | 不因本角色自動取得付款權 | 本人訂單／付款狀態 |
| 顧客個資 | 管理 | 依職務授權 | 無 | 最小必要欄位 | 依核准流程 | 本人資料 |

### 2.1 權限原則
- `owner` 是產品需求角色名稱；正式 DB 是否存在此 role 尚未確認，不可直接映射成新 DB enum。
- `super_admin` 與各 `can_manage_*` 旗標必須由單一 server-side helper 計算；前端顯示按鈕不是授權依據。
- `order_admin` 不代表可修改商品主檔、價格、權限或顧客個資。
- `personal_data_admin` 不代表可修改付款、商品或出攤設定。
- PDA 權限不沿用 merchandise／flavor 權限；PDA 本階段暫緩，僅定義未來隔離邊界。
- 所有管理寫入需 audit actor、action、entity、timestamp、request id；敏感值不可寫入 log。

## 3. 五類 read-only adapter prototype

程式：`app/mock-api/production-read-adapters.js`  
測試：`app/mock-api/production-read-adapters.test.js`

| Adapter | 來源模型 | 公開欄位重點 |
|---|---|---|
| mapFlavorCatalog | flavors | 啟用口味白名單 |
| mapDailyMenu | daily_order_settings／regions／flavors | 每日價格快照；不回傳 notes／內部欄位 |
| mapSchedule | food_truck_schedules／schedule_flavors／flavors | 餐車僅 price_per_box；擺攤完全沒有價格欄位 |
| mapRadishProducts | site_admin_content JSON | 僅 online_enabled 商品公開欄位 |
| mapMerchandise | merch_products／categories | 僅啟用分類與商品公開欄位 |

Adapter 是純函式，沒有 Supabase client、HTTP、Storage 或資料寫入。正式資料 projection 應明確指定欄位，不使用 `select('*')`。

## 4. 每日開單 transaction RPC 設計（未部署）

建議單一 RPC 接受：
- `p_order_date`
- `p_ordering_enabled`
- `p_notes`（管理欄位，不回傳公開 API）
- `p_regions`（只接受 region_name／enabled）
- `p_items`（只接受 flavor_id／product_name／flavor_name／price／enabled／quantity）
- `p_expected_version` 或既有設定更新時間

交易內步驟：
1. 驗證 auth.uid() 與 canonical product-admin predicate。
2. 對 order_date 對應 setting row 執行 transaction-safe lock（例如 SELECT ... FOR UPDATE）；新日期使用唯一鍵衝突處理。
3. 驗證日期、價格、數量、重複 flavor_id、enabled 與外鍵。
4. 驗證每個 flavor_id 存在且屬允許產品線；每日價格保留為快照，不讀主檔覆寫。
5. 原子化 upsert setting、replace regions、replace daily flavors。
6. 寫入 audit event 與 version；任一步驟失敗整筆 rollback。
7. 回傳最小摘要（order_date、version、region_count、item_count），不回傳管理 notes。
8. 加入 idempotency key，避免網路重送造成重複或覆寫。

不得讓前端以多次 REST delete／insert 取代 transaction。

## 5. 蘿蔔糕 JSON optimistic version API 設計（未部署）

目前 `site_admin_content` 商品清單是整包 JSON upsert，存在並行覆蓋風險。建議 API：
- 讀取回傳 `section_id`、`data`、`version`（或 ETag）。
- 更新必須帶 `expected_version`。
- 交易內鎖定 section row；version 不符回傳 conflict，不寫入。
- 驗證 products schema、唯一 id、price、enabled、online_enabled、image URL。
- 只更新 `radish_products` section，不覆寫 `radish_order_settings` 或其他 section。
- 成功 version + 1，寫 audit event；失敗完全 rollback。
- 客戶端遇 conflict 必須重新讀取並由管理員合併，不得靜默採 last-write-wins。

## 6. 相容與負向驗收清單

- 舊官網公開頁使用的名稱、價格、圖片與 enabled 狀態維持相同語意。
- daily menu 價格取 daily_order_flavors.price，不以 flavors.price 覆蓋。
- stall JSON stringify 後不得含 price、pricePerBox、unitPrice。
- schedule legacy price／unit_price 不進公開 payload。
- radish products 必須 online_enabled=true 且 enabled 不為 false。
- merchandise 必須所屬 category enabled=true。
- 一般會員不得通過任何管理寫入測試。
- 任何一個 daily order transaction 子步驟失敗，所有資料均不變。
- radish JSON expected_version 不符時不寫入。
- 所有 public adapter 僅輸出欄位 allowlist。

## 7. 正式環境核准門檻

Phase 55 不部署、不執行正式 SQL、不更改官網、不寫入正式資料。未來要上正式環境，必須先提供：精確 SQL diff、完整 policy/grant before/after、角色測試結果、備份與 rollback、功能影響、官網相容測試及明確核准。
