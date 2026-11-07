# Phase 36｜HTTP Mock Server、標準回應與整合測試

日期：2026-11-08  
分支：`app/phase-1-planning`  
狀態：HTTP mock server 與 HTTP integration tests 已提交；GitHub Actions 已更新納入全部 mock API 測試。尚未確認 CI run 結果。不是正式部署 API。

## 1. 本階段交付

新增：
- `app/mock-api/http-server.js`：Node.js built-in HTTP server。
- `app/mock-api/http-server.test.js`：使用 Node.js fetch 與臨時 localhost port 的 HTTP integration tests。

更新：
- `.github/workflows/app-public-read-api.yml`：執行 `app/mock-api/*.test.js`，同時涵蓋純函式與 HTTP integration tests。

沒有引入 npm 套件、資料庫 client、環境 secrets 或付費服務。

## 2. HTTP 路由

| Method | Path | 功能 |
|---|---|---|
| GET | `/api/v1/catalog` | 商品目錄，支援 cursor／limit |
| GET | `/api/v1/content` | 公開內容 section |
| GET | `/api/v1/schedules` | 餐車／擺攤行程，支援 type／cursor／limit |

本階段沒有任何 POST／PATCH／DELETE 路由；非 GET 方法回傳 405。未知路徑回傳 404。

## 3. 成功與錯誤回應

成功：

```json
{
  "data": {},
  "meta": {
    "request_id": "每次請求產生的 UUID",
    "api_version": "v1"
  }
}
```

錯誤：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "查詢參數不正確。",
    "field_errors": [],
    "retryable": false
  },
  "meta": {
    "request_id": "每次請求產生的 UUID",
    "api_version": "v1"
  }
}
```

同時提供 `x-request-id` response header、JSON UTF-8 content type、`Cache-Control: no-store`、`X-Content-Type-Options: nosniff` 及 `Referrer-Policy: no-referrer`。

request_id 由 server 端產生，不信任客戶端提供值。

## 4. Query validation

- catalog：只允許 `cursor`、`limit`。
- content：不接受任何 query parameter。
- schedules：只允許 `type`、`cursor`、`limit`。
- 重複 query key、未知 key、無效 type、超出 limit 範圍及無效 cursor 都回傳 400 結構化錯誤。
- 此為 prototype；正式 API 尚需加入 rate limiting、穩定排序 cursor、監控與正式 CORS／origin policy。

## 5. HTTP integration tests

使用合成 fixtures，server 綁定臨時 `127.0.0.1` port，不對外開放。測試涵蓋：
1. catalog 成功回應、envelope、request_id。
2. content 僅公開已發布 allowlist 欄位。
3. stall 行程不包含 price／currency。
4. food truck 行程可顯示價格。
5. HTTP cursor 分頁。
6. limit 驗證與錯誤 envelope。
7. 未知及重複 query parameter。
8. 未知路徑 404。
9. POST 寫入路由被拒絕。
10. 每次請求 request_id 唯一。

執行：

```bash
node --test app/mock-api/*.test.js
```

GitHub Actions workflow 已更新為同時執行所有 `*.test.js`。本階段沒有讀到 workflow run 的完成狀態，故不宣稱測試已通過。

## 6. 啟動方式與限制

此模組目前提供 `createPublicReadHttpServer({ fixtures })` factory，供本機測試與後續 App frontend 開發使用；尚未提供正式資料 fixture、預設 port 或 production start script。啟動時應由開發者明確傳入合成 fixtures，並只綁定 localhost。

本階段：
- 不連 Supabase，不使用真實顧客或訂單資料。
- 不提供會員登入、訪客訂單、報價、建單、付款或管理寫入。
- 不提供正式 CORS、TLS、rate limiting、API gateway 或 production hosting。
- 不代表 iOS／Android App 已完成 HTTP 串接。
- 不修改官網、正式資料庫、RPC、RLS、GRANT、Storage、Secrets 或 LINE。
- 不部署正式 Edge Function。

**Phase 36 交付判定：三個公開讀取路由的本機 HTTP mock transport、共通 envelope、query validation 與 integration tests 已建立；CI 結果待確認，正式服務仍未部署。**

## 7. 下一階段（Phase 37）

加入 App 可直接使用的 API client reference（Node 測試先行、前端可移植的 fetch wrapper）、typed endpoint contract examples、timeout／abort、錯誤解析與分頁 helper；用 mock HTTP server 測試 client 行為。仍不連正式 Supabase、不部署。
