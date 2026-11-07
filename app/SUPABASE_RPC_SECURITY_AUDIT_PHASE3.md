# 老爹．涼糕 App－資料庫 RPC 與安全權限第三輪盤點

版本：1.0  
專案：老爹涼糕官網 Supabase（唯讀檢查）  
盤點日期：2026-11-08  
範圍：三種訂單建立 RPC、相關 RLS policies、Supabase Security Advisor。  
**本輪只執行 SELECT／唯讀 Advisor；沒有修改資料庫、RLS、RPC、付款設定或官網。**

## 1. 三種訂單建立函式的實際定義

### A. 涼糕送到府：`public.create_customer_order(date,text,text,text,text,text,text,jsonb)`

已確認：
- `SECURITY DEFINER`，`search_path=public`。
- ACL 明確允許 `anon`、`authenticated` 執行；這符合訪客可下單的前端需求，但函式本身必須完整驗證輸入。
- 驗證配送日期已開放、地區已開放、地址／姓名／電話非空、取貨類型有效。
- 從 `daily_order_flavors` 與 `flavors` 讀取正式價格、開放狀態與庫存，並在資料庫計算商品小計。
- 後端驗證總盒數至少 2 盒，檢查庫存並扣減。
- `home_delivery` 的 `pickup_fee=0)，付款狀態寫為 `cod`。
- 將送到府地址寫入 `order_private.delivery_address`，同時寫入 `pickup_store` 欄位；前端傳入的 `p_pickup_store` 對送到府而言實際承載地址。
- 訂單與品項分別寫入 `orders`、`order_private`、`order_items`。

需注意：
- 本函式目前未見檢查配送地址是否位於該地區的具體範圍，也未見配送時段限制；若營運需要，應由既有後台設定決定。
- `SECURITY DEFINER` 但 search_path 固定為 `public`，仍應檢查此函式所有依賴物件及 schema 物件可被誰建立／修改；不可只因 search_path 固定就視為完整安全。
- 前端可建立訪客訂單，會員下單則使用 `auth.uid()` 寫入 `customer_user_id`。不得用姓名／電話自動認領舊訂單。

### B. 涼糕超商冷藏寄放：`public.create_cooling_pickup_order(...)`

已確認：
- `SECURITY DEFINER`，`search_path=public`，`anon` 與 `authenticated` 可執行。
- 驗證訂購日期已開放、姓名電話、地區／門市、匯款後五碼格式、品項數量、最低 2 盒、口味開放與庫存。
- 從資料庫讀取當日口味價格，並核對傳入的商品小計。
- 會寫入 `order_customers`、`cooling_pickup_orders`、`cooling_pickup_order_items`，並扣減每日口味庫存。

**重要風險（需要優先修正設計）：**
1. `p_storage_fee` 由瀏覽器傳入，函式只檢查 `p_total_amount = p_merchandise_total + p_storage_fee`，沒有從 `pickup_settings` 重新讀取當下正式寄放費，也沒有比對全家／7-ELEVEN 開放狀態。呼叫者可自行傳入錯誤寄放費，造成訂單金額不一致。
2. 函式計算總額時使用資料庫價格，但插入 `cooling_pickup_order_items` 時卻直接使用 JSON 傳入的 `flavor_name` 與 `unit_price`，沒有將每個品項的快照欄位改用已查證的資料庫名稱及價格。可能出現總額與品項明細不一致。
3. 函式目前未見驗證 `p_region_name` 是所選日期已啟用的 `daily_order_regions` 地區。
4. 函式目前未見對 `p_convenience_store` 做明確白名單檢查；表格 constraint 仍有第二層限制，但函式本身應清楚驗證。
5. 庫存扣減以每個品項逐筆更新；同一份 JSON 若重複放入相同 flavor_id，應測試併發及重複品項行為。

### C. 蘿蔔糕宅配：`public.create_radish_delivery_order(...)`

目前有 **兩個 overload**：
- 五參數版本：`create_radish_delivery_order(text,text,text,text,jsonb)\)
- 六參數版本：`create_radish_delivery_order(text,text,text,text,jsonb,text)`

兩個版本均為 `SECURITY DEFINER`，均允許 `anon`、`authenticated` 執行，均使用 `search_path=public, extensions`。

六參數版本（目前顧客頁使用）：
- 依 `shipping_method` 在函式內固定設定全家冷凍店到店 99、7-ELEVEN 冷凍店到店 129、冷凍宅配到府 250。
- 從 `site_admin_content.radish_products` 重新讀取商品與價格，計算小計及運費，並寫入 `radish_orders`、`radish_order_items`。
- 顧客頁面顯示的固定費用與此 RPC 目前程式定義一致，但這不代表它們就是最新物流合約價格。

五參數舊版本：
- 仍保留一個獨立的舊 RPC overload，固定運費 250。
- 同樣可由 `anon` 與 `authenticated` 執行。
- 若舊客戶端仍呼叫五參數版本，會繼續走舊邏輯；不可只改 App 六參數版本就假設舊入口已停用。

需注意：
- 兩個 overload 都沒有在函式內檢查 `radish_order_settings.enabled`，目前顧客頁會先檢查開單開關，但直接呼叫 RPC 可能繞過前端開關。
- 六參數版本目前允許商品數量被 clamp 至 0..99，總數只檢查大於 0；沒有涼糕送到府的最低 2 盒規則（蘿蔔糕不可擅自套用涼糕規則）。
- 運費雖由 RPC 端計算，仍為函式內硬編碼；要由經核實的物流費率設定管理，不能直接當作長期有效費率。

## 2. 相關 RLS policies 觀察

### 涼糕送到府相關
- `orders` 有管理員讀取／更新／刪除 policy，以及會員讀取自己訂單（`customer_user_id=auth.uid()`）。
- `order_private` 的讀取 policy 限制在個資管理員或該訂單所屬 UID；管理員寫入由個資管理角色控制。
- `order_items` 的讀取 policy 為 `is_admin()`，刪除由 `is_order_admin()` 控制。需另行核對會員查看自己訂單品項的 API 設計，避免會員只能看到主單卻看不到品項。
- 這輪 policy 清單未顯示一般使用者可直接 INSERT `orders` 的 policy；建立訂單主要依賴 RPC。

### 涼糕超商冷藏寄放相關
- `cooling_pickup_orders` 有 anon/authenticated INSERT policy，條件包含今日日期與匯款後五碼格式；另有管理員 ALL policy。
- `cooling_pickup_order_items` 有 anon/authenticated INSERT policy，只驗證數量大於 0、價格非負；另有管理員 ALL policy。
- `order_customers` 有 anon/authenticated INSERT policy，限制姓名／電話長度。
- 由於這些 public INSERT policies 存在，需檢查是否可繞過 RPC，直接插入不符合正常流程的訂單／品項。這是獨立於 RPC 的風險面。

### 蘿蔔糕宅配相關
- `radish_orders`、`radish_order_items` 在本輪 policy 結果中僅看到管理員讀取／更新或管理員讀取政策，未見 anon 直接 INSERT policy；建立依賴 SECURITY DEFINER RPC。
- 應再確認表格 grants 與所有 policies，確保沒有其他授權路徑。

## 3. Supabase Security Advisor 本輪結果

### 高優先安全問題
- **Critical：`public.merch_backend_sync` 的 RLS 未啟用。** Advisor 指出此表對 anon/authenticated 可能完全暴露。不能直接只啟用 RLS，因為沒有正確 policies 可能令既有同步失效；需先查明用途、存取主體與資料敏感度，再設計最小權限 policy。

### 警告
- Advisor 發現多個 SECURITY DEFINER RPC 可由 anon 或 authenticated 執行，包含三個訂單建立函式及其他管理函式。這是需逐一審查的暴露面，不代表每個函式都必然可被利用；要看函式 body 是否做了角色／資料範圍驗證。
- Advisor 發現 11 個函式 search_path 可變，包括 `taipei_today`、`generate_cooling_order_number` 等。
- Auth 的 leaked password protection 目前關閉。
- Advisor 另指出 4 個 LINE 相關表有 RLS 但沒有 policy（這可能是刻意阻止 API 存取，也可能影響既有整合，需依實際用途判斷）。

## 4. App 正式整合前的必修設計

1. 超商寄放費應由 RPC 依 `pickup_settings` 重新讀取並計算，不接受瀏覽器決定費用。
2. 超商品項名稱與單價快照應由資料庫讀取後寫入，不能採用瀏覽器傳入的價格／名稱。
3. RPC 應驗證選定日期／地區／超商是否在正式設定中啟用。
4. 蘿蔔糕 RPC 應檢查後台開單開關，並統一舊版／新版 overload 的相容與退場策略。
5. 蘿蔔糕運費應有單一可信設定來源；切勿只修改前端顯示。
6. 送到府需把「配送完成」與「貨到付款已收款」分開記錄；會員訂單明細需有安全讀取方式。
7. 檢查超商表格的 public INSERT policy 是否真的需要保留；若 RPC 已是唯一建立入口，需規劃在不破壞現有官網的前提下收斂直寫權限。
8. 檢查所有 SECURITY DEFINER 函式內部角色驗證、固定 search_path、EXECUTE grants；管理 RPC 不可只依賴前端隱藏按鈕。
9. 先查明 `merch_backend_sync` 的用途及同步程式，再設計 RLS；暫不執行任何 RLS 變更。
10. 上線前啟用 Auth leaked password protection，需由管理者在 Auth 設定中確認並測試登入影響。

## 5. 不可直接修改正式環境的項目

本報告不代表已修復任何問題。正式 DB 的 RPC、RLS、GRANT、search_path、Auth 設定均未修改。要執行修正前，先提供逐項變更 SQL、影響的官網功能、回復方式與測試計畫，並取得使用者對具體變更的明確同意。
