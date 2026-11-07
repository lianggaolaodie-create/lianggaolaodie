# Phase 38｜公開 API Contract／DTO 欄位規格與驗證

日期：2026-11-08  
分支：`app/phase-1-planning`  
狀態：DTO 規格、驗證器與測試已提交；mock API 仍非正式服務。

## 1. 本階段交付

新增：
- `app/mock-api/api-contract.js`：欄位規格及無第三方依賴的 DTO validators。
- `app/mock-api/api-contract.test.js`：對 Phase 35 mapper 產出的資料執行 contract tests。

修正：
- `app/mock-api/public-read-api.js`：`null`／`undefined`／空字串價格不再被 JavaScript 的 `Number(null) === 0` 誤判為 0 元。明確的數字 0 仍可視為合法非負整數價格。
- DTO validators 採嚴格欄位 allowlist，未知欄位會被拒絕。

CI workflow 已執行 `node --test app/mock-api/*.test.js`，會包含本階段及前面階段的 mock tests。

## 2. Endpoint 與回應契約

| Method | Endpoint | 成功 data |
|---|---|---|
| GET | `/api/v1/catalog` | `{ items, next_cursor }` |
| GET | `/api/v1/content` | 已發布 section 的 key-value object |
| GET | `/api/v1/schedules` | `{ items, next_cursor }` |

成功 envelope：
```json
{
  "data": {},
  "meta": {
    "request_id": "non-empty string",
    "api_version": "v1"
  }
}
```

錯誤 envelope：
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "可供使用者閱讀的錯誤訊息",
    "field_errors": [],
    "retryable": false
  },
  "meta": {
    "request_id": "non-empty string",
    "api_version": "v1"
  }
}
```

## 3. Catalog DTO

必填欄位：
- `product_id: string`
- `name: string`
- `category: "lianggao" | "radish_cake"`
- `price: non-negative integer | null`
- `currency: "TWD"`
- `available: boolean`

選填欄位：
- `description: string`
- `spec: string`
- `image_url: string`

補充規則：
- 涼糕 flavor 只輸出 `enabled === true` 的資料。
- 蘿蔔糕產品要同時符合管理啟用與 `online_enabled === true) 才可購買；停用線上販售時仍可依商品目錄策略顯示，但 `available=false`。
- 價格缺失／null 不得變成 0 元；價格為 0 只有在來源明確提供數字 0 時才合法。
- 所有商品價格均為整數 TWD；正式訂單仍須由後端重新核價，不能信任 App 傳回的價格。

## 4. Content DTO

每個公開 section 必須包含：
- `title: string`
- `content: string`
- `image_url: string`
- `published: true`

只允許既有公開 section allowlist，且必須明確 `published === true)。未發布 section、未知 section、額外內部欄位不輸出。

## 5. Schedule DTO

每筆行程必填：
- `schedule_id: string`
- `type: "food_truck" | "stall"`
- `service_date: string`（YYYY-MM-DD 格式由資料來源／正式 schema 再核實）
- `title: string`
- `region: string`
- `start_time: string`
- `end_time: string`
- `flavors: array`

每個 flavor 的共同必填欄位：
- `flavor_id: string`
- `name: string`

| 行程類型 | 價格欄位規則 |
|---|---|
| `food_truck` 餐車 | 可選 `price: non-negative integer` 與 `currency: "TWD"` |
| `stall` 擺攤 | 嚴禁出現 `price`、`currency`，不是顯示空白，而是 JSON 中完全不包含這兩個 key |

餐車價格取自已配置的行程口味價格；正式來源欄位與資料庫關聯仍待 schema／RPC 最終核實。停用行程與停用口味不輸出。

## 6. Pagination 與 query

- `limit`：整數 1–100。
- `cursor`：不透明字串；無下一頁時 `next_cursor=null)。
- schedules 的 `type`：只接受 `food_truck` 或 `stall`。
- 不允許重複 query key 或未知 query key。
- cursor 目前是 mock offset cursor，不是正式穩定資料庫游標；正式版須使用穩定排序鍵並處理資料新增／刪除。

## 7. 錯誤碼

| HTTP | code | 意義 |
|---|---|---|
| 400 | `VALIDATION_ERROR` | query、cursor、limit 或 type 不合法 |
| 404 | `NOT_FOUND` | 路徑不存在 |
| 405 | `METHOD_NOT_ALLOWED` | 本 mock API 僅提供 GET |
| 500 | `INTERNAL_ERROR` | 未預期伺服器錯誤 |

Client 端另有 `TIMEOUT`、`ABORTED`、`NETWORK_ERROR`、`INVALID_JSON`、`INVALID_ENVELOPE`、`INVALID_DATA`、`PAGE_LIMIT_EXCEEDED` 等本地錯誤碼。

## 8. 驗證與測試

執行：
```bash
node --test app/mock-api/*.test.js
```

Contract tests 覆蓋：
1. catalog 涼糕／蘿蔔糕 DTO。
2. 已發布內容及未知欄位不外洩。
3. 餐車價格欄位。
4. 擺攤完全不含價格欄位。
5. success／error envelope。
6. 型別、必填欄位與 enum 錯誤。
7. 嚴格欄位 allowlist。
8. API version 驗證。

## 9. 測試結果與已發現修正

查閱先前 GitHub Actions run（run ID `42402604173`）時，發現既有 catalog 測試有一項失敗：來源價格為 `null` 時，原本 `Number(null)` 會轉成 0，造成「未定價」口味被誤認為 0 元。已在本階段修正轉換函式，並新增 contract tests。

本階段最新提交後的 CI run 結果仍待確認；不宣稱所有測試通過。

## 10. 限制與下一階段

- DTO 是前端／後端協作契約草案，不代表正式資料庫 schema 已完成核對。
- 沒有連線正式 Supabase、沒有真實顧客資料、沒有部署正式 API。
- 沒有修改官網、RLS、GRANT、RPC、Edge Functions、Storage 或 Secrets。
- 沒有完成正式 App 串接。

下一階段 Phase 39：建立「App 與官網整合 adapter／repository」設計及 mock implementation，統一讀取入口，支援 mock transport 替換；明確隔離 public read 與未來 authenticated／order write API，繼續不連正式資料庫。
