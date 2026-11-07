# Phase 33｜老爹．涼糕 App API 契約（提案版）

日期：2026-11-08  
狀態：可供工程估工與實作審查的 API 契約草案；**不是已部署 API、已核對完整 schema 或正式安全驗收**。

## 1. 契約原則與共通規則

### 1.1 API 邊界

建議由 App／官網呼叫同一組版本化服務，例如 `/api/v1`。以下路徑是邏輯 endpoint 契約，不代表目前已有同名 HTTP route。若以 Supabase Edge Function 實作，應維持相同 request／response 語意。

- 公開讀取：商品、口味、公開內容、公開行程。
- 顧客操作：報價、建立訂單、會員資料、本人訂單查詢。
- 管理操作：獨立管理 API；每個寫入都由伺服器重新授權、驗證欄位、檢查狀態轉換並留下稽核紀錄。
- App 與官網可共用服務，但不可把舊頁面的前端直寫資料表模式搬進 App。
- 所有金額以整數 TWD 元表示；不接受浮點金額。伺服器重算價格、運費、寄放費、折扣與總額。
- 所有時間以 ISO 8601 含時區格式傳輸；資料庫儲存時區與顯示時區需明確設定（台灣顯示 Asia/Taipei）。
- JSON 欄位採 snake_case；回應包含 `request_id` 供客服與稽核追查。
- 建單與任何可能重複執行的管理命令，必須支援 `Idempotency-Key`；同一 key、同一操作者／請求內容回傳同一結果，不同內容重用 key 回傳衝突。
- 分頁採 cursor，不採可被資料插入干擾的 offset 作為主要方式。
- 公開 API 不回傳管理欄位、內部備註、顧客私密資料、token、付款證明路徑或管理員資料。

### 1.2 共通回應格式

成功回應：

```json
{
  "data": {},
  "meta": {
    "request_id": "req_demo_01",
    "api_version": "v1"
  }
}
```

錯誤回應：

```json
{
  "error": {
    "code": "QUOTE_EXPIRED",
    "message": "報價已過期，請重新取得報價。",
    "field_errors": [],
    "retryable": false
  },
  "meta": {
    "request_id": "req_demo_02",
    "api_version": "v1"
  }
}
```

不得把 SQL 錯誤、stack trace、Supabase service key、內部 table／bucket 名稱或個資放入錯誤訊息。

### 1.3 共通欄位型別

- `id`: UUID 字串；公開商品可另有穩定 slug。
- `currency`: 固定 `TWD`。
- `amount`: 非負整數，單位元。
- `quantity`: 正整數，並受商品與訂購規則限制。
- `status`: 僅傳該資源明確定義的狀態，不混用其他資源狀態。
- `created_at`、`updated_at`: ISO 8601 timestamp。
- `version`: 整數或 opaque ETag，用於管理資料樂觀鎖定。

## 2. 公開商品、口味與內容 API

### 2.1 取得商品目錄

`GET /api/v1/catalog?category=lianggao&cursor=...`

回應示例：

```json
{
  "data": {
    "items": [
      {
        "product_id": "00000000-0000-4000-8000-000000000101",
        "slug": "taro-pudding",
        "name": "布丁芋頭涼糕",
        "category": "lianggao",
        "description": "商品介紹",
        "image_url": "https://example.invalid/public-image",
        "variants": [
          {
            "variant_id": "00000000-0000-4000-8000-000000000102",
            "name": "盒",
            "price": 150,
            "currency": "TWD",
            "available": true
          }
        ],
        "sale_state": "available"
      }
    ],
    "next_cursor": null
  },
  "meta": { "request_id": "req_demo_03", "api_version": "v1" }
}
```

規則：
- 只回傳已發布、公開且允許顧客瀏覽的商品／口味。
- 價格及 available 必須來自可信資料來源；庫存數量是否公開由產品決策決定，預設只回傳可售布林值，不暴露實際庫存。
- `sale_state` 建議值：`available`、`sold_out`、`paused`、`unpublished`；未發布商品不應出現在公開清單。
- `flavors` 可作口味主資料來源，但商品、口味與售價的實際關聯仍須以完整 schema 核對後定案。
- 不允許客戶端提交價格作為建單依據。

### 2.2 取得公開內容

`GET /api/v1/content?sections=home_banner,announcement,service_rules`

回應：
- `sections`: 僅公開 section 的 key、內容、發布版本及更新時間。
- 過濾草稿、管理備註、內部連結及未發布內容。
- `site_admin_content` 是目前觀察到的內容來源之一；JSON section 的欄位 schema、公開白名單、版本與併發策略仍待核對。
- App 不得直接寫入 `site_admin_content`。

## 3. 餐車／擺攤公開行程

### 3.1 取得行程

`GET /api/v1/schedules?type=food_truck&region=...`

`type` 可為 `food_truck` 或 `stall`。回應欄位：
- `schedule_id`、`type`、`service_date`、`start_time`、`end_time`。
- `region`、`venue_name`、`public_address`、`public_notice`。
- `flavors[]`: `flavor_id`、`name`、`sale_state`。
- 僅餐車回傳 `price`／`currency`；擺攤回應 schema **完全省略價格欄位**，不可只靠 App UI 隱藏。
- 地址／座標只有在 schema 與實際場地資料核實後才回傳；不推測座標。

### 3.2 行程管理

管理 API 可建立、更新、取消或發布行程。每次更新須：
- 驗證管理者權限、日期、時間區間、地區與欄位白名單。
- 使用 `If-Match`／`version` 防止兩位管理者互相覆蓋。
- 留存 before／after 摘要、操作者、時間與原因。
- 公開 App／官網只讀取已發布版本。
- 餐車與擺攤價格顯示規則在伺服器 DTO 層強制執行。

資料來源目前觀察為 `food_truck_schedules`、`food_truck_schedule_flavors`、`flavors`；正式欄位與地址欄位仍待完整 schema 核對。

## 4. 報價、購物車與結帳

### 4.1 取得正式報價

`POST /api/v1/quotes`

請求示例：

```json
{
  "order_type": "cooling_pickup",
  "items": [
    { "product_id": "00000000-0000-4000-8000-000000000101", "variant_id": "00000000-0000-4000-8000-000000000102", "quantity": 2 }
  ],
  "fulfillment": {
    "method": "convenience_cold_storage",
    "provider": "family_mart",
    "store_code": "TEST001",
    "store_name": "測試門市",
    "county": "台北市"
  },
  "coupon_code": null
}
```

回應示例：

```json
{
  "data": {
    "quote_id": "00000000-0000-4000-8000-000000000201",
    "expires_at": "2026-11-08T10:15:00+08:00",
    "currency": "TWD",
    "lines": [
      { "product_id": "00000000-0000-4000-8000-000000000101", "quantity": 2, "unit_price": 150, "line_total": 300 }
    ],
    "subtotal": 300,
    "shipping_fee": 0,
    "storage_fee": 30,
    "discount_total": 0,
    "grand_total": 330,
    "rule_version": "quote-rule-v1"
  },
  "meta": { "request_id": "req_demo_04", "api_version": "v1" }
}
```

上例金額僅為契約示意，不是目前實際費率或正式報價。

規則：
- 後端依商品 ID／規格 ID 重新讀取有效價格、售賣狀態、庫存、開單日期、地區、物流支援、最低數量、費率及優惠條件。
- 不採信客戶端傳來的單價、小計、運費、寄放費、折扣或總額。
- 報價須短效、綁定品項／數量／配送方式／門市或地址／會員或訪客 session／優惠資格。
- 建單時重新驗證報價尚未過期、未使用、資料版本仍有效；若價格、庫存或規則已變，回傳 `QUOTE_STALE` 並要求重新報價。
- 多種商品若配送限制不同，必須由後端明確拒絕或拆成獨立訂單；不可讓前端自行判斷可混寄。

### 4.2 訂單類型與履約方式

| order_type | fulfillment.method | 說明 |
|---|---|---|
| `lianggao_delivery` | `home_delivery` | 涼糕送到府 |
| `cooling_pickup` | `convenience_cold_storage` | 涼糕超商冷藏寄放；不可稱冷藏宅配 |
| `radish_cake` | `frozen_store_to_store` | 蘿蔔糕冷凍店到店 |
| `radish_cake` | `frozen_home_delivery` | 蘿蔔糕冷凍宅配 |

物流服務商、門市格式、費率及最低訂購量須以正式設定來源為準。既有蘿蔔糕頁面出現的固定運費 99／129／250 元只屬舊前端顯示，不是本契約核定費率。

## 5. 建立訂單 API

### 5.1 涼糕冷藏寄放

`POST /api/v1/orders/cooling-pickup`

必要資料：
- `quote_id`
- `customer.name`、`customer.phone`
- `pickup.provider`、`pickup.county`、`pickup.store_code`、`pickup.store_name`
- `payment.method`、如適用的付款識別資料（不得把付款後五碼視為已付款）
- `customer_note`（長度限制及純文字處理）

回應：
- `order_id`、`order_number`、`order_type=cooling_pickup`
- `order_status`、`payment_status)、`fulfillment_status`
- `amounts`（由報價快照產生）
- `next_action`（例如提交付款證明或等待人工核款）

舊系統對應：`create_cooling_pickup_order` 及冷藏寄放相關資料表。正式實作前必須確認 RPC 參數與交易行為，並驗證伺服器端重新計價；不得只把前端送來的費用與總額傳入舊 RPC。

### 5.2 蘿蔔糕冷凍訂單

`POST /api/v1/orders/radish`

必要資料：
- `quote_id`
- `customer.name`、`customer.phone`
- `fulfillment.method`
- 店到店所需門市欄位，或宅配所需完整收件地址
- `customer_note)

回應欄位同上，另回傳已確認的 `fulfillment.method` 與必要的取件／收件摘要。

舊系統對應：`create_radish_delivery_order`、`radish_orders`。需確認 RPC overload、欄位與 CHECK constraints；蘿蔔糕不可套用涼糕最低盒數規則。運費及商品價格必須由可信設定重新計算。

### 5.3 涼糕送到府

`POST /api/v1/orders/lianggao-delivery`

此 endpoint 為建議新增契約；既有 `orders`、`order_items`、`order_private` 可作為資料來源線索，但必須先確認現有正式建單 RPC／流程、私密資料寫入方式與 RLS。不得在尚未確認時宣稱可直接重用。

### 5.4 建單冪等

所有建單請求要求 `Idempotency-Key`：
- 相同 key + 相同正規化 payload：回傳同一訂單結果。
- 相同 key + 不同 payload：`IDEMPOTENCY_KEY_REUSED`。
- 交易內鎖定／唯一約束須防止併發重複建單。
- 客戶端 timeout 後可安全重試，不會產生第二張訂單。

## 6. 會員 Auth 與訪客訂單存取

### 6.1 會員

建議使用 Supabase Auth 或經核准的身份服務：
- `POST /api/v1/auth/sign-up`
- `POST /api/v1/auth/sign-in`
- `POST /api/v1/auth/sign-out`
- `POST /api/v1/auth/password-reset`
- `GET /api/v1/me`
- `PATCH /api/v1/me`

登入方式（Email、手機或兩者）、驗證政策及會員欄位需由產品決策與現況 Auth 設定核對後定案。Session token 僅經安全儲存傳遞；不可寫入日誌。會員 API 以 token subject 對應本人，不接受客戶端自行指定 member_id 取得他人資料。

### 6.2 訪客結帳與訂單查詢

訪客可不註冊下單。建單成功後，後端應提供高熵、短效、限用途的訂單存取憑證，建議只在安全傳輸中回傳一次；資料庫保存雜湊而非明文。憑證應可撤銷、設到期時間並限制嘗試次數。

- `POST /api/v1/guest/order-access`：以訂單編號及受控的第二因素驗證申請存取。
- `GET /api/v1/orders/{order_id}`：會員只可讀本人訂單；訪客須有效 access token。
- `GET /api/v1/orders?cursor=...`：只提供登入會員本人訂單。
- 訂單編號、姓名、電話單獨都不是授權憑證。
- 回應預設遮罩電話及地址；只有完成本人驗證且確有需要才回傳完整必要欄位。
- 不允許匿名直接查詢 `order_private`、`order_customers` 或其他私密資料表。

## 7. 訂單、付款、履約狀態分離

API 的跨商品領域狀態與資料表原生狀態必須分層。不得將以下領域狀態直接寫入現有資料表，除非已核對 CHECK constraints 並建立明確 adapter。

### 7.1 API 領域狀態（建議）

- `order_status`: `pending`、`accepted`、`processing`、`completed`、`cancelled`、`exception`。
- `payment_status`: `unpaid`、`proof_submitted`、`reviewing`、`paid`、`rejected`、`refund_pending`、`partially_refunded`、`refunded`、`cod_due`、`cod_collected`。
- `fulfillment_status`: `not_ready`、`preparing`、`ready_for_handoff`、`stored`、`shipped`、`in_transit`、`delivered`、`picked_up`、`exception`。

這是顧客端統一呈現語意，不代表每張訂單表都應存下全部值。實際允許狀態及轉換由各訂單類型 adapter 決定。

### 7.2 已知 merch_orders 資料庫狀態（獨立範圍）

依前階段唯讀盤點：
- `payment_status`: `unpaid`、`proof_submitted`、`confirmed`、`rejected`。
- `shipment_status`: `unprepared`、`preparing`、`shipped`、`delivered`。
- `refunded` 不可直接寫入 payment_status；退款需獨立退款紀錄／金額／原因／操作者／時間，並由 adapter 映射顧客端狀態。
- 舊後台的 `pending`／`paid`／`processing`／`completed` 不可未經 adapter 直接寫入上述欄位。

### 7.3 其他訂單資料表

- 涼糕 `orders`：曾觀察到主 status 混合訂單、付款與物流語意，必須以實際 CHECK、欄位與歷史資料核對建立 mapping。
- `cooling_pickup_orders`：主 status 涵蓋多個履約階段的風險已知；需逐值核對，不可假定等同 API 狀態。
- `radish_orders`：目前觀察到單一 status，付款與物流欄位不足的可能性仍待完整 schema 核實。
- 周邊商品 `merch_orders` 不與涼糕／蘿蔔糕訂單直接合併資料模型。

每個 adapter 至少包含：table／column、DB value、API value、允許來源狀態、目標狀態、執行角色、必要欄位、是否需交易、通知事件及未知值處理。未知 DB value 一律回傳安全的 `exception`／人工處理提示並記錄，不可猜測轉換。

## 8. 付款證明、核款與物流追蹤

建議契約：
- `POST /api/v1/orders/{id}/payment-proof/upload-intent`：本人驗證後取得短效、限路徑上傳能力。
- `POST /api/v1/orders/{id}/payment-proof/finalize`：驗證物件存在、MIME、大小、訂單綁定及單次使用後標記 `proof_submitted`。
- `POST /api/v1/admin/orders/{id}/payment-decision`：有核款權限的管理員核准／退件；要求理由及冪等 key。
- `POST /api/v1/admin/orders/{id}/fulfillment-transition`：依訂單類型狀態機更新履約。
- `GET /api/v1/orders/{id}/tracking`：只回傳顧客可見物流事件。

付款證明不得放公開 bucket；不得以付款後五碼或上傳成功視為已入帳。只有可信金流 webhook 或授權管理員核實後才可標記已付款。付款證明 signed URL 必須短效，並在授權後才發出。退款需獨立資金紀錄與核准權限。

## 9. 優惠券、促銷與刮刮樂（待 schema 核對）

目前尚無足夠證據確認完整優惠券／刮刮樂正式資料表、RPC、唯一限制與防重複機制。以下為**新增 API 契約提案**，不可視為現有功能。

- `GET /api/v1/campaigns`：只回傳已發布、有效的活動摘要及規則。
- `POST /api/v1/coupons/validate`：以登入會員或訪客 session、購物車／報價內容驗證適用條件；回傳折扣預估與失敗原因。
- `POST /api/v1/campaigns/{campaign_id}/scratch`：由伺服器決定結果，交易內鎖定活動資格／剩餘次數，原子建立唯一抽取紀錄。
- `GET /api/v1/me/rewards`：只回傳本人獎項／優惠券及使用狀態。
- `POST /api/v1/coupons/redeem`：在建單交易或可保證原子性的流程中核銷，避免重複使用。

必須先盤點 schema，確定 campaign／coupon／reward／redemption 欄位、唯一約束、有效期限、每人次數、活動總量、退款後回補規則與管理權限。抽獎不得由 App 前端產生隨機結果；不得以隱藏按鈕作資格控管。需要公平性、抽獎法規與活動條款審查的項目另列阻擋，不在本文件判定合法性。

## 10. 老闆管理 API 與權限

管理 API 建議獨立 namespace：`/api/v1/admin`。員工帳號、員工登入、PDA／掃碼、揀貨包裝與現場結帳依使用者既定範圍暫緩，不在本階段啟用。

| 模組 | 建議 API | 最低權限／安全要求 |
|---|---|---|
| 商品／口味 | `GET/POST/PATCH /admin/products`、`/admin/flavors` | 商品管理權；價格欄位白名單；版本鎖；發布稽核 |
| 開單／地區／當日口味 | `GET/PATCH /admin/daily-settings` | 營運管理權；日期與地區校驗；變更記錄 |
| 行程 | `POST/PATCH /admin/schedules` | 行程管理權；發布與取消需原因；公開 DTO 隱價 |
| 訂單 | `GET /admin/orders`、`GET /admin/orders/{id}` | 訂單查詢權；最小個資；查詢稽核 |
| 付款 | `POST /admin/orders/{id}/payment-decision` | 核款專屬權；不能由一般商品管理權代替 |
| 履約／物流 | `POST /admin/orders/{id}/fulfillment-transition` | 物流管理權；狀態機與運單欄位驗證 |
| 會員 | `GET/PATCH /admin/members` | 會員個資權；敏感欄位遮罩與理由記錄 |
| 內容 | `GET/PATCH /admin/content` | 內容管理權；section 白名單、草稿／發布分離 |
| 活動 | `GET/POST/PATCH /admin/campaigns` | 行銷管理權；活動版本、數量與日期限制 |
| 報表 | `GET /admin/reports` | 報表權；聚合資料優先，匯出另授權 |

角色名稱及實際權限尚待核對 `admin_profiles`、Auth claims、RLS、RPC ACL 與管理者需求；不得假設前端 role 判斷足夠。最小建議能力集合：`catalog.read/write`、`schedule.read/write/publish`、`order.read`、`payment.review`、`fulfillment.update`、`member.read/write`、`content.publish`、`campaign.manage`、`report.read/export`。實際角色組合需管理者確認。

所有管理寫入：
1. 伺服器驗證 session、角色與 capability。
2. 檢查欄位白名單、輸入格式、業務規則及狀態轉換。
3. 使用交易／原子 RPC，避免部分更新。
4. 記錄 actor、resource、action、before／after 摘要、reason、request_id、時間。
5. 不把完整個資、付款證明或 token 寫入一般 log。
6. 高風險付款、退款、刪除／取消及活動抽獎設定要求二次確認或額外核准。
7. 一般營運不直接 DELETE 訂單；採取消／作廢狀態並保留稽核。

## 11. 錯誤碼字典

| HTTP | code | 意義 | 客戶端處理 |
|---:|---|---|---|
| 400 | `VALIDATION_ERROR` | 欄位格式或缺漏 | 標示欄位，不重試 |
| 401 | `AUTH_REQUIRED` | 未登入／session 無效 | 重新登入或走訪客流程 |
| 403 | `FORBIDDEN` | 無本人存取或管理權限 | 停止，不重試 |
| 404 | `NOT_FOUND` | 資源不存在或不可見 | 顯示查無資料，不洩露存在性 |
| 409 | `STATE_CONFLICT` | 狀態不允許轉換 | 重新讀取狀態 |
| 409 | `IDEMPOTENCY_KEY_REUSED` | 同 key 不同內容 | 建立新 key 前先查原請求 |
| 409 | `QUOTE_STALE` | 報價／價格／庫存版本已變 | 重新報價 |
| 410 | `QUOTE_EXPIRED` | 報價已過期 | 重新報價 |
| 422 | `OUT_OF_STOCK` | 商品不可售／庫存不足 | 更新購物車 |
| 422 | `FULFILLMENT_UNAVAILABLE` | 地區／門市／配送不支援 | 更換可用方式 |
| 422 | `MINIMUM_NOT_MET` | 未達該品類最低訂購規則 | 說明該品類規則 |
| 422 | `COUPON_NOT_APPLICABLE` | 優惠不符合條件 | 顯示可公開原因 |
| 429 | `RATE_LIMITED` | 請求過於頻繁 | 依 Retry-After 等待 |
| 500 | `INTERNAL_ERROR` | 未預期伺服器錯誤 | 顯示 request_id，不顯示內部細節 |
| 503 | `SERVICE_UNAVAILABLE` | 服務暫時不可用 | 指數退避重試；建單先用原 Idempotency-Key |

錯誤碼可依實際 gateway／Edge Function 設計調整，但不可將授權失敗、價格驗證失敗或未知狀態當成成功。

## 12. 既有資料來源對照與待核對事項

| API domain | 已知現況線索 | 待核對／阻擋 |
|---|---|---|
| 商品／口味 | `flavors`、`products.html` | 完整 products schema、價格來源、庫存、發布欄位 |
| 公開內容 | `site_admin_content` | section schema、公開白名單、版本／併發控制 |
| 冷藏寄放 | `create_cooling_pickup_order`、`cooling_pickup_orders`、items、`order_customers` | RPC 完整定義、server-side totals、RLS／ACL、狀態 CHECK |
| 涼糕送到府 | `orders`、`order_items`、`order_private` | 真正建單入口、私密欄位授權、付款／履約 mapping |
| 蘿蔔糕 | `create_radish_delivery_order`、`radish_orders`、`site_admin_content.radish_products` | RPC overload、商品 JSON 驗證、運費設定來源、狀態欄位 |
| 行程 | `food_truck_schedules`、`food_truck_schedule_flavors` | 地址／座標、公開旗標、價格欄位與排程關聯 |
| 會員 | Supabase Auth（待確認） | provider、驗證、profile 關聯、刪除／匯出流程 |
| 管理員 | `admin_profiles` | 完整角色值、RLS、RPC grants、實際管理者清單 |
| 行銷 | 尚未確認 | campaigns／coupons／scratch／redemptions schema 與 RPC |
| 通知 | Active Edge Functions 部分盤點 | 全部 caller、token lifecycle、冪等、LINE payload DB-derived |

## 13. 建議實作順序與驗收門檻

1. 先完成唯讀 schema／RPC／RLS／Storage／Auth 欄位字典，尤其核對建單 RPC 是否在資料庫內重算金額。
2. 先做公開 catalog、content、schedules read API；以合成資料測試公開欄位白名單，特別驗證 stall 不回傳價格。
3. 實作 quote service，測試改價、停售、庫存不足、地區不支援、運費變更及 quote expiry。
4. 實作各訂單類型 adapter 與冪等建單；不合併不同資料表原生狀態。
5. 實作會員 Auth 與訪客短效訂單存取；測試跨會員／跨訪客隔離。
6. 實作付款證明、核款、履約及通知；測試重放、重試與稽核。
7. 最後接老闆管理 API、活動／刮刮樂；先確認角色與行銷 schema。
8. 完成隔離 Supabase 整合測試、iOS／Android 真機測試後，才評估正式部署。

最低驗收：
- 擺攤 API response 不含任何價格欄位。
- 修改客戶端 price／fee／discount／grand_total 不會改變伺服器報價。
- 過期或已使用 quote 無法建單。
- 重送同一建單請求不會產生重複訂單。
- 訪客／會員無法讀取他人訂單或私密資料。
- 付款證明提交不會自動標記已付款。
- 未授權管理者無法更改付款、物流、商品或行程。
- 未知資料庫狀態不會被猜測映射。
- 優惠券／刮刮樂無法重複領取、核銷或超出活動額度。
- 所有管理寫入都有操作者、原因、時間及 before／after 稽核。

## 14. 本階段未做事項與正式環境安全聲明

- 未建立上述 HTTP endpoints／Edge Functions。
- 未修改正式 Supabase schema、資料、RPC、RLS、GRANT、Storage、Secrets。
- 未部署或替換任何 Edge Function。
- 未修改官網、App build、LINE 或第三方服務。
- 未讀取或使用正式顧客個資。
- 未執行 DB／RLS／Storage／Edge Function／真機整合測試。
- 優惠券與刮刮樂 API 是提案，須待 schema 與活動規則確認。
- 本文件的金額 JSON 僅示例，不代表實際售價、運費或寄放費。

**Phase 33 交付判定：API 契約草案已建立；正式 API 實作、schema 完整對照與整合驗收仍未完成。**
