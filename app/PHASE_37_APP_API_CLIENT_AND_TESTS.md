# Phase 37｜App API Client、逾時／取消、錯誤解析與分頁

日期：2026-11-08  
分支：`app/phase-1-planning`  
狀態：可移植 fetch client 與合成 HTTP 測試已提交；尚未接入正式 App、正式 API 或 Supabase。CI 結果尚未取得。

## 1. 本階段交付

新增：
- `app/mock-api/api-client.js`：無框架依賴的 fetch client。
- `app/mock-api/api-client.test.js`：使用 Phase 36 localhost HTTP mock server 的 client integration tests，並測試錯誤、逾時與取消。

CI workflow 已在 Phase 36 更新為 `node --test app/mock-api/*.test.js`，因此會包含本階段測試。

## 2. Client 使用方式（範例）

```js
const { createPublicApiClient } = require('./api-client');

const api = createPublicApiClient({
  baseUrl: 'http://127.0.0.1:3000',
  timeoutMs: 10000
});

const catalog = await api.getCatalog({ limit: 20 });
const content = await api.getContent();
const schedules = await api.getSchedules({ type: 'stall', limit: 20 });
```

這是開發範例，不代表目前已啟動任何服務。正式 App 應由環境設定注入 HTTPS API base URL，不可將 mock localhost URL 當正式網址。

## 3. 已提供能力

- `getCatalog({ cursor, limit, signal, headers })`
- `getContent({ signal, headers })`
- `getSchedules({ type, cursor, limit, signal, headers })`
- `getAllCatalog({ limit, maxPages, signal })`
- `getAllSchedules({ type, limit, maxPages, signal })`
- Query string 自動編碼；忽略 null／undefined／空字串。
- 使用 AbortController 實作 timeout，支援呼叫端 AbortSignal 取消。
- 統一解析成功／錯誤 envelope。
- `ApiClientError` 提供 status、code、requestId、fieldErrors、retryable。
- 區分 TIMEOUT、ABORTED、NETWORK_ERROR、INVALID_JSON、INVALID_ENVELOPE 與伺服器端錯誤。
- 全頁分頁 helper 有 maxPages 上限，避免 cursor 異常時無限請求。
- 不自動重試寫入；本階段只有 GET，亦未加入自動重試策略。

## 4. 安全與行為原則

- 只呼叫三個已定義 GET endpoints；沒有建單、付款或管理寫入方法。
- Client 只負責傳輸及格式解析，不能決定可信價格、運費、庫存、付款狀態或訂單權限。
- 任何正式下單金額與可售狀態仍必須由可信後端重新計算。
- `retryable` 只作錯誤提示，不代表可以盲目重送會產生副作用的操作。
- 取消請求不視為網路故障；timeout 與使用者取消分開回報。
- 不在 client 內寫入 Supabase keys、LINE token、付款資料或其他 secrets。

## 5. 測試覆蓋

使用合成資料與 Phase 36 本機 HTTP server，測試：
1. query string encoding。
2. 商品、公開內容、行程讀取。
3. 擺攤不含價格欄位。
4. 全頁 catalog 分頁。
5. 指定 type 的 schedules 分頁。
6. 400 validation error 解析及 request_id 保留。
7. 非法行程類型。
8. 無效 JSON 與無效 envelope。
9. 網路錯誤標準化。
10. timeout abort。
11. 呼叫端 AbortSignal 取消。
12. 分頁最大頁數保護。
13. 無效 client options。

執行指令：

```bash
node --test app/mock-api/*.test.js
```

目前未取得 GitHub Actions run 的本次測試結果，因此不可宣稱測試已通過。

## 6. 尚未完成／不可誤認

- 尚未建立完整 iOS／Android App shell 或將此 client 接入正式 App。
- 尚未有正式 HTTPS API host。
- 尚未連線 Supabase、Auth 或真實資料。
- 尚未實作會員、訪客訂單驗證、購物車、報價、建單、付款、物流或後台寫入 API。
- 尚未設定正式 API rate limit、CORS／origin allowlist、TLS、監控及 production gateway。
- 尚未完成 schema 與 schedule enum 的最終核實。
- 沒有正式部署，也沒有修改官網、Supabase、Edge Functions、RLS、GRANT、Storage、Secrets。

**Phase 37 交付判定：App 可移植的公開讀取 API client 與 mock integration tests 已建立；CI 待確認，正式 App 串接及正式服務未完成。**

## 7. 下一階段（Phase 38）

整理前端可直接採用的 API contract／資料型別文件與 DTO schema，將 catalog、content、schedules 的欄位、必填／選填、分頁、錯誤碼與餐車／擺攤價格差異明確化；新增 contract validation tests，並檢查 mock server、client 與文件三者一致。仍使用合成資料，不連正式 Supabase。
