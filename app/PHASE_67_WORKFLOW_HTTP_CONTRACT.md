# Phase 67｜HTTP 工作流程契約模擬服務

## 交付
- `app/mock-api/workflow-http-server.js`：Node.js built-in HTTP server，合成記憶體資料。
- `app/mock-api/workflow-http-server.test.js`：HTTP 整合測試。
- GitHub Actions 加入 Phase 67 測試步驟。

## Endpoint 示範
| Method | Path | 行為 |
|---|---|---|
| GET | `/api/v1/health` | 顯示 mock_only |
| POST | `/api/v1/quotes` | 由可信測試商品／費率產生報價 |
| POST | `/api/v1/checkout/authorize` | 檢查報價、購物車、收件資料與冪等鍵 |
| GET | `/api/v1/member/orders/{id}` | 會員本人訂單查詢 |
| GET | `/api/v1/guest/orders/{id}` | 訪客 claim token 查詢 |
| PATCH | `/api/v1/admin/orders/{id}/fulfillment` | 管理員履約狀態更新 |

## 驗證項目
- 標準 v1 success／error envelope、request id、HTTP status。
- 後端可信商品／費率計價，忽略客戶端自帶價格／總額。
- 會員本人與他人訂單隔離；訪客 claim 驗證。
- 管理員角色、expectedVersion、idempotency key。
- 無效 JSON 與未知路徑錯誤回應。
- quote／checkout 僅示範授權，不建立真實訂單、不執行付款。

## 安全限制（重要）
- `resolvePrincipal` 必須由測試注入；預設一律未登入。測試用 header resolver 只是測試 fixture，不是正式身份驗證。
- server 只使用 synthetic in-memory data，不連 Supabase、不讀正式個資／訂單。
- 此階段沒有正式 Auth、RLS、金流、物流或 production API。
- 不可將此 mock server 直接部署公開網路。

## 下一階段（Phase 68）
建立正式整合前的 staging readiness 清單與部署拓樸草案：身份驗證接點、Edge Function／API hosting 選擇、環境變數隔離、資料庫交易邊界、RLS 修補驗收、測試資料與回滾程序；仍不動正式環境。
