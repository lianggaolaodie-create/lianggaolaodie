# Phase 65｜顧客 App／老闆後台共用 API Contract 與欄位映射

- 日期：2026-11-08（Asia/Taipei）
- 狀態：API 規格草案與合成 fixture 驗收；尚未建立正式 API。
- 安全邊界：不讀取會員個資／正式訂單內容；不執行 Supabase DDL、DML、RLS、GRANT、RPC、Edge Function 或部署。

## 1. API 設計原則

1. 官網與 App 共用既有 Supabase 主資料，不建立第二套商品、每日菜單或排程主檔。
2. 所有價格、庫存可訂狀態、運費與訂單金額均由可信任後端計算；客戶端輸入只能提供商品 ID、數量、服務地區及配送選擇。
3. 公開讀取 API 僅輸出 allowlist DTO；不使用 `select('*')` 作為對外契約。
4. 訂單個資與管理操作必須經身份驗證、server-side 授權、最小欄位回傳及 audit log。
5. 擺攤 payload 完全不包含任何價格欄位；餐車依 `price_per_box` 提供價格。
6. API 路徑以下為建議契約，不代表目前已部署或存在。

## 2. 建議 API 清單

| Method | Path（建議） | 用途 | 存取 |
|---|---|---|---|
| GET | `/v1/public/flavors` | 啟用中的涼糕口味 | 公開 |
| GET | `/v1/public/daily-menus?from=YYYY-MM-DD&to=YYYY-MM-DD` | 每日開單、地區與品項 | 公開 |
| GET | `/v1/public/schedules?from=...&to=...` | 餐車／擺攤排程 | 公開 |
| GET | `/v1/public/radish-products` | 已啟用且允許線上訂購的蘿蔔糕 | 公開 |
| GET | `/v1/public/merchandise` | 啟用中的周邊商品 | 公開 |
| POST | `/v1/checkout/quotes` | 伺服器計價與配送可行性報價 | 訪客或會員 |
| POST | `/v1/orders` | 以有效 quote 建立訂單 | 訪客或會員 |
| GET | `/v1/me/orders` | 登入會員本人訂單 | 會員 |
| POST | `/v1/guest-order-claims` | 驗證訪客訂單查詢權 | 訪客憑證 |
| GET | `/v1/guest/orders/{claimId}` | 查詢已認領訪客訂單 | 訪客憑證 |
| GET | `/v1/admin/orders` | 後台訂單清單 | 管理員角色 |
| POST | `/v1/admin/orders/{id}/payment-review` | 付款證明審核 | super_admin／order_admin |
| PATCH | `/v1/admin/orders/{id}/fulfillment` | 履約狀態更新 | super_admin／order_admin |
| PUT | `/v1/admin/catalog/daily-menu/{date}` | 原子更新每日開單 | super_admin／can_manage_products |
| PUT | `/v1/admin/schedules/{id}` | 原子更新餐車／擺攤排程 | 經核准管理角色 |

正式路徑、HTTP method、部署型態及版本策略仍須在 staging 實作前定案。

## 3. 正式資料來源與欄位對照

### 3.1 涼糕口味
來源：`public.flavors`

| DB 欄位 | 公開 DTO | 規則 |
|---|---|---|
| id | id | 穩定識別 |
| product_name | productName | 不視為通用 SKU |
| name | name | 口味名稱 |
| description | description | 公開描述 |
| price | basePriceTwd | 僅參考價格；每日下單以每日快照為準 |
| image_url | imageUrl | 公開圖片 |
| flavor_type | flavorType | single／filled／mixed |
| enabled | 不直接輸出 | 僅 true 才出現在公開清單 |

### 3.2 每日開單
來源：`daily_order_settings`、`daily_order_regions`、`daily_order_flavors`。

- 日期必須以 Asia/Taipei 規則判斷，不接受客戶端自行決定今日日期。
- 只公開 ordering_enabled=true、當日或未來、啟用地區與啟用品項。
- 每日品項價格採 `daily_order_flavors.price` 快照，不可用 `flavors.price` 覆蓋。
- `quantity` 預設不公開實際數量，只輸出 `available:boolean`；是否顯示剩餘量需另經產品決策。
- 不公開管理備註、內部庫存調整紀錄及管理員欄位。

### 3.3 餐車／擺攤
來源：`food_truck_schedules`、`food_truck_schedule_flavors`、`flavors`。

共同欄位：id、scheduleDate、scheduleType、title、region、startTime、endTime、flavors。
- 餐車 flavors item：flavorId、name、pricePerBox（僅從 `price_per_box` 取值）。
- 擺攤 flavors item：只有 flavorId、name；必須完全省略 price、pricePerBox、unitPrice。
- 不公開 note、內部 flags、私人地址、管理者資訊。
- 現有 schema 沒有地址／經緯度，不可假造地圖定位。

### 3.4 蘿蔔糕
來源：`site_admin_content` 的 `radish_products` JSON section。
- 僅輸出 id、name、price、spec、description、imageUrl。
- 必須符合 enabled !== false、online_enabled === true、價格有效。
- 不與 flavors 或 merch_products 合併。
- 管理更新須有 version／compare-and-swap，避免整包 JSON 併發覆蓋。

### 3.5 周邊商品
來源：`merch_products`、`merch_categories`。
- 僅輸出啟用商品及啟用分類中的商品。
- 可公開 id、categoryId、name、description、price、imageUrl、sizeOptions、productCode、isNew、isHot。
- 不公開精確庫存、庫存異動、訂單及客戶資料。
- 已盤點到寬鬆 authenticated ALL RLS policy；此風險未修補。正式串接前必須先完成核准的 policy 修補與負向測試，不能因 API 前端隱藏按鈕而略過。

## 4. 訂單／會員 API 安全契約

### 4.1 Quote 輸入
客戶端可送：items[{productType, itemId, quantity}]、fulfillmentMethod、serviceRegion、recipient/contact fields（僅必要欄位）。
客戶端不可送作為權威：unitPrice、subtotal、shippingFee、discountAmount、grandTotal、paymentStatus、fulfillmentStatus。

伺服器需重新查價、驗證開單日期／庫存／地區／配送方式、計算總額、產生短效 quoteId 與 expiresAt。

### 4.2 建立訂單
- 必須引用未過期且未消耗的 quote。
- 要求 Idempotency-Key；同 key 同 payload 回放原結果，同 key 不同 payload 回 409。
- quote 鎖定、冪等紀錄、訂單、明細、庫存預留需在 DB transaction 中完成。
- 建單與付款分離；建立訂單不等於付款成功。
- 不在 App 端保存 service-role key 或金流 secret。

### 4.3 訂單讀取
- 會員：以驗證過的 Auth UID 綁定訂單 owner，查詢本人訂單。
- 訪客：使用高熵 claim token，資料庫僅保存 hash，具期限與撤銷能力。
- 回傳 DTO 遮罩電話、地址及其他個資；列表與明細分離。
- 不允許只憑姓名或電話查詢／認領訂單。

### 4.4 後台管理
- 每個管理 API 都由伺服器端重新驗證角色；不可只相信前端 role。
- 付款審核、退款、履約、取消及商品管理皆要求 Idempotency-Key（適用時）、expectedVersion 與 audit record。
- 付款成功必須來自可信 webhook／供應商對帳，不可由管理 UI 或 App 任意標記。
- 出貨前需驗證付款狀態；退款成功需由可信金流回應確認。
- 個資管理角色與履約操作權限分離。

## 5. 共用錯誤格式

建議統一格式：
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "請檢查輸入資料",
    "requestId": "server-generated-id",
    "details": []
  }
}
```

常見 HTTP status：
- 400：格式錯誤／欄位驗證失敗
- 401：未登入或憑證失效
- 403：已登入但角色／資料擁有權不足
- 404：資源不存在或不可見（避免洩漏其他人的訂單）
- 409：版本衝突、冪等鍵 payload 衝突、quote 已消耗
- 410：訪客 claim 或 quote 已過期
- 422：商品停售、庫存不足、服務地區不支援
- 429：頻率限制
- 500：通用伺服器錯誤；不得回傳 SQL、stack trace 或 secret

## 6. 驗收矩陣

| 測試 | 預期 |
|---|---|
| disabled flavor | 不出現在公開目錄 |
| 未開放／過期每日菜單 | API 回空或不可訂，不可結帳 |
| 每日價格與 flavor base price 不同 | quote 使用每日價格快照 |
| quantity=0 | available=false，拒絕新增有效 quote |
| stall link 帶入 price_per_box | 公開 DTO 完全不含任何價格 key |
| food_truck price_per_box | 僅輸出 pricePerBox |
| disabled schedule／flavor | 不公開 |
| radish online_enabled=false | 不公開 |
| disabled merchandise category | 該分類商品不公開 |
| 客戶自行附加總額／付款狀態 | 忽略或拒絕，不影響伺服器計算 |
| 會員查詢他人訂單 | 403 或隱匿式 404 |
| 訪客 claim token 過期／撤銷 | 拒絕查詢 |
| 同 Idempotency-Key 同 payload | 回放同一結果，不重複建單 |
| 同 Idempotency-Key 不同 payload | 409 |
| expectedVersion 過期 | 409，不覆蓋新資料 |
| personal_data_admin 更新履約 | 403 |
| 未確認付款要求出貨 | 拒絕 |
| webhook 重複事件 | 不重複處理 |

## 7. 尚未解決的正式上線阻擋項

1. merch_products／merch_categories 寬鬆 RLS policy 尚未修補。
2. SECURITY DEFINER functions 的 EXECUTE grants／search_path 尚未逐支完成最小權限審查。
3. 新會員 Supabase Auth provider、註冊方式與會員 profile schema 尚未實作。
4. 正式訂單 quote／建單／庫存交易 API 尚未部署。
5. 金流供應商、webhook 驗證、退款與對帳尚未接通。
6. 物流服務商、費率、寄件標籤及追蹤 API 尚待確認。
7. 官網與 App 的共同服務層尚未實作與 staging 驗收。
8. iOS／Android 原生專案、簽章、商店帳號與上架流程尚未完成。

## 8. Phase 65 結論

本階段完成可供實作的共用 API 草案、資料來源映射、公開／個資／管理邊界及驗收矩陣。它不是已部署 API，也未連正式資料。

### 下一階段（Phase 66）
把本契約轉成可執行的合成 contract tests：檢查五種公開資料 DTO、擺攤零價格欄位、quote 輸入不得信任客戶端價格、會員／訪客訂單權限、管理角色及錯誤碼；納入 GitHub Actions。仍不連正式 Supabase、不寫正式資料。
