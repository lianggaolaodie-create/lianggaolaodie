# Phase 34｜API × 現有 Schema／RPC／權限逐項對照與實作分解

日期：2026-11-08  
分支：`app/phase-1-planning`  
狀態：依可讀取的官網程式碼與先前盤點文件進行唯讀對照。此文件不是正式資料庫 schema dump、RLS 完整稽核或 API 實作。

## 1. 本階段審查範圍與證據限制

本次檢視 GitHub 預設分支程式碼版本 `ad620ef9fbc081160c12402b6355a1f5b70e7ce0`，包括：

- `convenience-order.html`
- `radish-order.html`
- `schedule.html`
- `stall-schedule.html`
- `admin-radish-products.html`
- `admin-orders-stable.html`

並參照 Phase 32 重用矩陣、Phase 33 API 契約草案及既有 Phase 10、22–29 盤點結果。

**限制：** GitHub 預設分支程式碼不等於目前 planning branch 或正式主機實際部署版本；本階段沒有連線查詢 Supabase schema、function body、RLS policies、grants、Storage policies、Auth provider 設定或正式資料。程式碼可見的 select／RPC 呼叫只證明前端有這些呼叫，不能證明伺服器端授權安全。

## 2. Endpoint 實作可行性總表

| API 契約 | 已知來源 | 可否直接實作 | 必要前置／阻擋 |
|---|---|---|---|
| `GET /catalog` | `flavors`、蘿蔔糕 `site_admin_content.radish_products` | 部分可做唯讀 adapter | 需核對正式欄位、價格來源、公開 RLS、圖片政策；蘿蔔糕 JSON 需版本及併發保護 |
| `GET /content` | `site_admin_content` | 部分可做 | section 公開白名單、資料格式、發布狀態及版本未完整核實 |
| `GET /schedules` | `food_truck_schedules`、`food_truck_schedule_flavors`、`flavors` | 部分可做 | schedule_type 值、欄位價錢優先順序、公開政策及地址／座標待確認 |
| `POST /quotes` | 商品／口味／每日開單設定等 | 暫不可安全上線 | 未證明可信費率、庫存、優惠、報價快照、過期／單次使用及伺服器重算 |
| `POST /orders/cooling-pickup` | `create_cooling_pickup_order` | 有既有 RPC 可作 adapter 研究 | 必須查 RPC 完整定義，證明價格／費用／品項由 DB 重算，檢查 transaction、重複建單及 ACL |
| `POST /orders/radish` | `create_radish_delivery_order` | 有既有 RPC 可作 adapter 研究 | 必須查所有 overload、商品價格來源、運費重算、訂單狀態、併發及 ACL |
| `POST /orders/lianggao-delivery` | `orders`、`order_items`、`order_private` | 暫不可安全新增 | 目前這次檢視未證明正式建單 RPC／交易入口；不可猜測直接 insert |
| `GET /orders`、`GET /orders/{id}` | 多張訂單及私密資料表 | 暫不可公開實作 | 需核對會員 subject 關聯、RLS、訪客憑證雜湊／期限／撤銷及私密資料最小化 |
| Auth／會員 API | Supabase Auth（設定待確認） | 暫不可定案 | provider、驗證方式、profile 關聯、session、刪除／匯出政策待核對 |
| 管理 API | `admin_profiles`、現有 admin pages | 只可先做畫面／契約 | 需核對角色值、RLS、RPC grants、各 capability、稽核表與正式管理者入口 |
| 優惠／刮刮樂 | 尚無完整可確認 schema 證據 | 不可聲稱既有 | 先搜尋完整 tables、RPC、unique constraints、活動規則與抽獎紀錄 |

## 3. 已核實程式碼細節與安全差距

### 3.1 涼糕超商冷藏寄放

`convenience-order.html` 呼叫 `create_cooling_pickup_order`，傳入姓名、電話、日期、地區、超商、門市、門市地址、商品小計、寄放費、總額、匯款後五碼、備註及品項。

可見前端先計算：
- `productTotal`：從前端購物項目加總。
- `fee`：取自畫面 radio 的 dataset。
- `total`：前兩者相加。

**判定：** 這些值均為不可信輸入。不能因 RPC 回傳訂單編號就認定金額安全。下一步必須讀取 RPC 完整 SQL／PLpgSQL 定義，確認是否在 transaction 內：
1. 重新查詢當日開單、地區、口味及可信售價；
2. 驗證最低訂購量、日期、地區、超商及門市欄位；
3. 由資料庫計算商品小計、寄放費與總額；
4. 只使用 DB 查得的商品名稱／價格建立訂單明細快照；
5. 防止相同請求重複建單；
6. 限制 EXECUTE 對象並驗證 caller 權限。

匯款後五碼只代表使用者提供的對帳線索，不代表已付款。冷藏寄放仍應明確標示「冷藏寄放」，不能改稱冷藏宅配。

### 3.2 蘿蔔糕冷凍訂購

`radish-order.html` 讀取：
- `site_admin_content` 的 `radish_order_settings`；
- `site_admin_content` 的 `radish_products`；
- 商品 JSON 內 `enabled`、`online_enabled`、`price` 等欄位。

頁面顯示固定運費：
- 全家冷凍店到店 NT$99；
- 7-ELEVEN 冷凍店到店 NT$129；
- 冷凍宅配 NT$250。

建單呼叫 `create_radish_delivery_order`，傳入客戶姓名、電話、配送地址、物流方式、備註及商品 ID／數量。畫面所算商品價格與運費不是可信計價來源；這些費率不得直接當作 App 正式費率。

**待查：**
- RPC 是否直接從 JSON 商品資料取得可信售價，或只信任 client payload；
- 是否有 server-side shipping rate 設定；
- 是否有數量上限、停售、開單開關及地址／門市驗證；
- 商品 JSON 更新是否會因兩位管理者同時儲存而覆蓋彼此變更；
- RPC 是否 transaction-safe、冪等及限制 EXECUTE 權限；
- `radish_orders` status 的 CHECK／付款與履約語意。

### 3.3 餐車／擺攤排程

兩個公開頁都讀取 `food_truck_schedules` 的：
`id,schedule_date,schedule_type,title,region,start_time,end_time,enabled`，
並以 `enabled=true`、日期不早於今日篩選。

餐車頁讀取 `food_truck_schedule_flavors` 的 `schedule_id,flavor_id,price_per_box,price,unit_price` 等可能價格欄位；擺攤頁讀取連結表價格欄位及 `flavors` 名稱。

**判定：**
- 排程列表讀取可先做唯讀 adapter。
- 必須核實 `schedule_type` 真正 enum／文字值與餐車／擺攤對應，不可依頁面名稱猜值。
- 價格來源有多個候選欄位，須確定正式優先順序及 NULL 行為。
- 擺攤 API 必須在伺服器端完全不回傳價格欄位；不是只在前端隱藏。
- 本次頁面 select 未見地址／座標欄位，需查 schema；未確認前不顯示地圖導航。
- 核對匿名讀取 RLS 是否只允許已啟用、未來、公開排程。

### 3.4 蘿蔔糕商品管理

`admin-radish-products.html` 前端讀取 `admin_profiles` 的 `role,enabled`，並要求 `role === 'super_admin'`；保存時對 `site_admin_content` 的 `radish_products` section 做 upsert，整份 `products` array 一次寫入。

**風險：**
- 前端 role check 不等於後端授權；必須查 RLS／GRANT／RPC ACL。
- JSON array 整筆覆寫有 lost update 風險。
- `enabled` 與 `online_enabled` 是不同開關，App／官網需分開映射。
- 商品圖片使用既有公開圖片 URL；須確認 Storage bucket、檔案類型、大小、上傳者及刪除政策。
- App 不應直接 upsert 這個 JSON section；建議管理 API 使用版本鎖及欄位白名單，先相容舊官網再逐步正規化。

### 3.5 舊訂單後台

`admin-orders-stable.html` 直接查詢 `cooling_pickup_orders`、`orders`、明細、`order_customers`、`order_private`；並可直接更新 status、刪除訂單及明細、修改或刪除客戶資料。

**判定：** 不可將這種前端直接寫表模式移植到新 App 管理 API。正式管理 API 應採：
- 伺服器端 capability 授權；
- 每種訂單獨立狀態機與欄位白名單；
- 原子交易／RPC；
- 取消／作廢保留紀錄，不以直接刪除作一般操作；
- 個資遮罩、查詢理由及操作稽核；
- 高風險付款／退款操作分權與二次確認。

## 4. 各 API 需要的 schema／security 核對清單

### A. 公開讀取（優先級 P1）

1. `flavors`：欄位、價格、enabled、排序、公開政策。
2. 商品主資料：確認是否有正規化 products table；若沒有，盤點現有商品資料來源及各商品類別差異。
3. `site_admin_content`：section_id 唯一性、JSON shape、公開 section 白名單、版本／updated_at。
4. `food_truck_schedules`：schedule_type 值、enabled、日期、地區、地址、座標及 RLS。
5. `food_truck_schedule_flavors`：外鍵、價格欄位實際使用情形、刪除行為。
6. Storage：公開圖片 bucket、MIME／size 限制、路徑及上傳權限。

### B. 報價與建單（優先級 P0）

1. 取得 `create_cooling_pickup_order` 完整定義、overload、owner、SECURITY DEFINER、search_path、EXECUTE grants。
2. 取得 `create_radish_delivery_order` 所有 overload 的完整定義及相同安全 metadata。
3. 檢查所有商品價格／費率是否 server-side 查詢；檢查 RPC 是否接收並信任前端 total。
4. 檢查訂單主表、明細、私密資料表的 NOT NULL、FK、CHECK、unique、trigger。
5. 檢查 transaction atomicity、重複請求、併發超賣及報價快照。
6. 查明涼糕送到府真正建單入口，不可直接猜測 insert 欄位。
7. 核對付款後五碼與付款證明的資料邊界；證明上傳不代表入帳。
8. 查清物流費率與寄放費的可信設定來源；不可沿用未核實前端常數。

### C. Auth／本人訂單存取（優先級 P0）

1. Auth provider、email／phone verification、密碼政策及 session refresh。
2. Auth user 與會員 profile 的 FK／唯一性／刪除策略。
3. 會員查詢訂單的 RLS 及跨帳號隔離。
4. 訪客訂單存取 token 的產生、雜湊保存、有效期、用途限制、撤銷及速率限制。
5. `order_private`、`order_customers` 等表不得匿名任意讀取。
6. API response 不暴露不必要地址、電話、付款資訊與內部備註。

### D. 老闆管理 API（優先級 P0）

1. `admin_profiles` 全部 role 值、enabled、額外 capability 欄位。
2. 各管理表 RLS、GRANT、RPC EXECUTE 權限及 SECURITY DEFINER。
3. 實際管理者入口、部署中的 admin page 版本及管理員帳號狀態。
4. 稽核表是否存在；若無，先設計草案，不直接新增正式表。
5. 付款核對、退款、物流、會員個資、商品價格、活動設定分權。
6. 管理操作的版本鎖、冪等、before／after、操作者與原因欄位。

### E. 優惠券／刮刮樂（優先級 P2）

先唯讀搜尋所有 campaign、coupon、reward、scratch、redemption 相關表、RPC、unique constraints、trigger 及前端頁面。若沒有證據，維持「新功能待設計」，不可憑空認定現有資料表或功能存在。抽獎結果必須由可信服務端原子產生並記錄。

## 5. 可立即開始的工程分解（不需改正式環境）

| 工作包 | 可開始內容 | 完成定義 |
|---|---|---|
| P1-01 公開 DTO | 建立 mock catalog/content/schedule adapter 與欄位白名單 | 合成資料測試餐車可含價格、擺攤無價格 |
| P1-02 JSON 商品 adapter | 定義 radish_products JSON 到 App Product DTO mapping | enabled／online_enabled 分離，無 client write |
| P0-01 RPC 審查 | 收集完整 RPC 定義與 ACL metadata | 每個輸入欄位標示可信來源及 server-side validation |
| P0-02 報價模型 | 建立純函式價格計算介面與 fixtures | 改動 client total 不影響計算結果；過期 quote 失效 |
| P0-03 訂單 adapter | 為每張表建立 DB status → domain status mapping 草案 | 不同 table 狀態不互相套用；未知值安全 fallback |
| P0-04 Auth／訪客 | 建立 session／guest token contract tests | 跨會員、跨訪客存取一律拒絕 |
| P0-05 管理權限 | 建立 capability matrix 與 audit event DTO | 未授權操作拒絕；每筆寫入有 request_id 與 actor |
| P2-01 活動 schema | 唯讀搜尋 schema／RPC／頁面 | 有證據才建立正式 mapping，無證據則標記新建提案 |

## 6. 優先級與順序

- **P0（上線阻擋）**：RPC server-side price／fee recalculation、RPC ACL、會員／訪客資料隔離、管理 API 後端授權、訂單狀態 adapter、冪等建單。
- **P1（可先做唯讀）**：商品／口味／內容／行程公開 DTO、擺攤隱價、圖片資料安全、JSON 商品 adapter。
- **P2（需先釐清需求與 schema）**：優惠券、刮刮樂、完整會員行銷、報表擴充。
- App build／商店簽章／真機驗收另列工程工作；文件完成不代表 App 可安裝。

## 7. 本階段結論

1. 公開商品、內容及行程可以先做唯讀 adapter 原型，但正式 endpoint 仍需核對 RLS 與 schema。
2. 冷藏寄放及蘿蔔糕各自已有前端 RPC 呼叫；尚未取得 RPC 完整定義前，不能宣稱後端已安全重算金額。
3. 蘿蔔糕運費 99／129／250 元是舊前端顯示值，不是核定後端費率。
4. 擺攤隱價必須由 API 不回傳價格欄位實現。
5. 現有管理頁直接讀寫訂單／個資的方式不可作為新管理 API 設計。
6. Auth、RLS、RPC grants、Storage policies、優惠活動 schema 均有待查項目；未查明前不推測、不新增正式功能。
7. 本階段沒有修改正式 Supabase、官網、LINE、Secrets 或第三方服務，沒有讀取正式顧客個資，也沒有部署任何程式。

**Phase 34 交付判定：API 與現有前端呼叫的第一輪唯讀對照已完成；完整 schema／權限證據與任何正式 API 實作仍未完成。**

## 8. 下一階段（Phase 35）

先建立公開讀取 API 的可執行 mock reference implementation（純 Node／無外部連線），包含 catalog、content、food-truck schedule、stall schedule DTO、隱價保護、欄位白名單、分頁及錯誤處理；用合成資料建立自動測試。這可先交付不連正式資料庫的可驗收程式骨架，再等待正式 schema／RLS 核對。不得連線正式 Supabase，不部署、不修改官網。
