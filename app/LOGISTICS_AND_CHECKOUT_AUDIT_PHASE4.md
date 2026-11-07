# 物流與結帳流程盤點｜Phase 4

盤點日期：2026-11-08（台灣時間）  
範圍：既有蘿蔔糕訂購頁、線上訂購入口、後台入口、Supabase 運費／付款設定與訂單 RPC。  
方式：唯讀檢查 GitHub 分支程式碼及 Supabase schema／function／policy／資料；本階段沒有修改正式資料庫，也沒有變更官網。

## 1. 本輪檢查檔案

- `radish-order.html`
- `online-order.html`
- `admin-dashboard.html`
- Supabase 函式：`create_radish_delivery_order(text,text,text,text,jsonb,text)`
- Supabase 函式舊版 overload：`create_radish_delivery_order(text,text,text,text,jsonb)`
- 資料表：`payment_settings`、`pickup_settings`、`site_admin_content`、`radish_orders`、`radish_order_items`

## 2. 蘿蔔糕頁面目前行為

`online-order.html` 將涼糕送到府、超商冷藏寄放、蘿蔔糕訂購分成三個入口，這個分流應保留。

`radish-order.html` 有三種配送選項：
- 全家冷凍店到店：前端顯示 NT$99
- 7-ELEVEN 冷凍店到店：前端顯示 NT$129
- 冷凍宅配到府：前端顯示 NT$250

前端使用 `site_admin_content.radish_order_settings` 控制是否開單，並讀取 `radish_products` 商品。當設定未開放時會停止下單。當前資料庫讀到：
- `radish_order_settings.enabled = false`
- `radish_products.products = []`
- `radish` 專區介紹資料仍為 enabled，但沒有公開售價。

這代表目前蘿蔔糕線上訂購應視為暫停／尚未備妥商品，不可把空商品清單當成正式商品刪除，也不可擅自替使用者打開開單。

## 3. 已確認的關鍵缺口

### 3.1 運費目前硬編碼且前後端重複

前端 `radish-order.html` 將 99／129／250 寫死在配送選項、運費計算與說明文字中。新版 RPC 也在資料庫函式內寫死相同數值；舊版五參數 RPC 固定運費 250。

風險：
- 調整運費必須同步改前端與 RPC，容易出現畫面金額與實際訂單金額不同。
- 後台目前沒有在本輪程式碼中找到蘿蔔糕運費管理入口。
- 舊版 overload 仍可被呼叫，會讓舊客戶端繼續用固定 250 建單。
- 尚未確認 99／129／250 是否為最新物流合約費率，不能當成已核實的現行費率。

建議：
- 先確認蘿蔔糕物流的實際簽約費率與生效日。
- 建立明確的物流設定來源，記錄配送方式、費率、啟用狀態、生效期間及更新者。
- RPC 必須從可信設定來源讀費率並計算總額，不能信任前端傳入的運費。
- 訂單建立時保存配送方式、費率與配送資料快照，日後調價不得回寫舊訂單。
- 舊版 RPC 應先盤點呼叫端與相容性，再規劃停用；不可直接刪除。

### 3.2 RPC 沒有在資料庫內檢查開單開關

前端會檢查 `radish_order_settings.enabled`，但兩個 `create_radish_delivery_order` overload 的函式定義均未檢查這個開關。

風險：呼叫端可以略過頁面，直接呼叫 RPC；資料庫仍可能建立訂單。前端關閉不是資料庫層的完整保護。

建議：在 RPC 內重新讀取開單設定並拒絕關閉狀態的建單；新舊 overload 必須一致處理。這項修改需先做測試及相容性規劃，尚未執行。

### 3.3 新版 RPC 的輸入與資料核對

新版 RPC 會從 `radish_products` 重新讀取商品價格與名稱，這比直接信任瀏覽器送來的價格安全；但目前沒有檢查重複商品 ID、數量欄位型別／整數邊界的完整白名單，也未檢查配送縣市是否在服務範圍內。

建議：
- 驗證每個 product_id 唯一、quantity 為正整數且在合理上限內。
- 商品資料必須為已上架且允許線上訂購。
- 送到府地址需拆分並驗證縣市、行政區及配送範圍；不可只靠自由文字。
- 門市配送方式需驗證門市資料完整、門市代碼或名稱可追溯。
- 由資料庫產生總額與訂單明細快照。

### 3.4 RPC 權限與 SECURITY DEFINER

兩個 overload 均為 `SECURITY DEFINER`，`search_path=public, extensions`，目前可由 `anon`、`authenticated` 執行（另含系統管理角色）。

訪客購物可能需要匿名呼叫，因此不能只因 Advisor 警示就直接撤銷 anon。應逐一確認函式只允許建立符合條件的新訂單、不會回傳敏感資料、不能任意更新既有訂單，並測試錯誤輸入及濫用情境。

Supabase 官方建議 SECURITY DEFINER 函式固定 search_path，並縮小 EXECUTE 權限；若採空 search_path，函式內需完整 schema qualify。參考：
- https://supabase.com/docs/guides/database/functions
- https://supabase.com/docs/guides/database/postgres/row-level-security

### 3.5 訂單讀取 policy 尚未支援顧客自行查詢

目前 `radish_orders` 與 `radish_order_items` 的 SELECT policy 只允許符合條件的管理員角色。這符合管理後台讀取的方向，但顧客 App 若要顯示自己的蘿蔔糕訂單，需要另外設計安全的本人查詢方式；不可直接開放整張訂單表給 anon，也不可只靠訂單編號或電話作為授權。

## 4. 付款設定與寄放設定

### payment_settings
- RLS 已啟用。
- 公開讀取 policy 僅允許讀取 `enabled=true` 的付款設定。
- 管理寫入 policy 限定 `personal_data_admin` 或 `super_admin`。
- authenticated 具有表層 SELECT／INSERT／UPDATE／DELETE grants，但實際列存取仍受 RLS policy 限制；正式上線前仍需測試各角色的有效權限。
- 本輪未確認付款 webhook／匯款核對自動化的完整流程。

### pickup_settings
- RLS 已啟用。
- 公開讀取 policy 為 true；管理寫入 policy 限定 `order_admin` 或 `super_admin`。
- 目前資料值曾讀到全家 30、7-ELEVEN 45，且兩者 enabled；這是資料庫目前設定，不代表已核實最新合約。
- 此表看起來是涼糕超商冷藏寄放設定，不應未經確認就拿來當蘿蔔糕「冷凍店到店」費率。

### site_admin_content
- RLS 已啟用。
- 匿名讀取只開放指定公開 section；管理寫入由管理員角色 policy 控制。
- 蘿蔔糕訂購開關及商品設定目前存在此表，但 RPC 未在函式內驗證開單開關。

## 5. App／官網共用物流設計要求

正式 App 應保留不同訂單類型的獨立流程：
1. 涼糕送到府（宅配）
2. 涼糕超商冷藏寄放（不是冷藏宅配）
3. 蘿蔔糕冷凍店到店／冷凍宅配（依實際開放方式）
4. 餐車／現場取貨（僅在實際開放時顯示）

每張訂單都需保存配送類型、運費快照、收件／門市快照、建立時使用的物流設定版本或費率，以及配送狀態。付款狀態必須由可信後端核對或付款回呼更新，不能由顧客端自行改成已付款。

## 6. 下一步

1. 盤點涼糕送到府與超商冷藏寄放的 RPC、前端結帳、費用設定及訂單讀取 policy。
2. 查付款設定管理頁、匯款核對流程及任何 webhook／Edge Function；確認付款狀態只能由可信來源更新。
3. 盤點物流設定是否已有可重用資料表；先出相容方案，再決定是否新增獨立物流設定表。
4. 為訪客、會員、管理員、不同配送方式建立測試案例。
5. 在完成風險與相容性審核前，不修改正式資料庫、不開啟蘿蔔糕訂購、不變更任何現行運費。

---
本文件是唯讀盤點結果，不代表已修復上述缺口或已完成正式 App 串接。
