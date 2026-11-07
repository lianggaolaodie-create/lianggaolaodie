# Phase 39｜App／官網共用公開資料 Repository

日期：2026-11-08  
分支：`app/phase-1-planning`  
狀態：唯讀 Repository adapter 與 mock adapter 已建立；尚未接入正式 App、官網或 Supabase。

## 1. 本階段目標

提供單一公開資料存取介面，讓未來 App 與官網前端不必直接依賴 HTTP endpoint 細節。正式 API 與合成 mock API 可透過相同方法替換。

## 2. 新增檔案

- `app/mock-api/public-repository.js`：正式 HTTP client adapter 與 mock adapter。
- `app/mock-api/public-repository.test.js`：repository adapter 測試。
- `app/PHASE_39_PUBLIC_DATA_REPOSITORY.md`：本階段文件。

## 3. 統一讀取介面

| Repository method | 用途 | 傳入條件 |
|---|---|---|
| `listCatalog(options)` | 讀取商品／口味目錄 | cursor、limit、signal、headers |
| `getPublishedContent(options)` | 讀取已發布官網內容 | signal、headers |
| `listSchedules(options)` | 讀取餐車／擺攤行程 | type、cursor、limit |
| `listAllCatalog(options)` | 讀取全部商品分頁 | limit、maxPages |
| `listAllSchedules(options)` | 讀取全部行程分頁 | type、limit、maxPages |

回應保留：
- 單頁讀取：`{ data, meta })
- 全頁集合：`{ items, pages, meta })

`meta` 保留 request_id 與 api_version，方便未來除錯及追蹤。

## 4. Adapter 替換方式

正式 HTTP client：
```js
const { createPublicApiClient } = require('./api-client');
const { createPublicRepository } = require('./public-repository');

const client = createPublicApiClient({
  baseUrl: '由部署環境提供的公開 API base URL'
});
const repository = createPublicRepository({ client });
```

合成 mock API：
```js
const { buildPublicReadApi } = require('./public-read-api');
const { createMockPublicRepository } = require('./public-repository');

const mockApi = buildPublicReadApi(syntheticFixtures);
const repository = createMockPublicRepository({ api: mockApi });
```

以上為模組使用示意；未在正式官網或 App 執行。正式環境 base URL 不硬編碼於原型。

## 5. 安全邊界

本 repository 只提供公開唯讀資料：
- 商品／口味目錄。
- 已發布內容。
- 餐車行程。
- 擺攤行程。

不提供：
- 建立／修改／取消訂單。
- 付款核對、退款或付款證明。
- 會員登入、會員資料或個資讀取。
- 庫存寫入、商品管理或價格修改。
- 管理員權限與後台操作。

這些功能必須由後續獨立的 authenticated repository／server-side command 建立，並在後端重新驗證使用者、價格、庫存、配送方式與權限。不可把公開 API client 當作會員或管理員授權機制。

## 6. 餐車／擺攤規則

- 餐車行程可含 price／currency。
- 擺攤行程不含 price／currency key。
- Repository 只轉交 API DTO，不自行補價格、不從前端計算售價。
- 商品目錄的價格與可售狀態仍以可信後端回傳為準。

## 7. 測試範圍

新增測試涵蓋：
1. mock adapter 的 catalog／content／schedule 統一讀取。
2. 餐車價格存在、擺攤價格欄位不存在。
3. 商品與行程多頁收集。
4. 分頁安全上限。
5. HTTP client adapter 委派呼叫。
6. repository 不暴露訂單寫入方法。
7. 錯誤 envelope 與錯誤 adapter 防護。

執行命令：
```bash
node --test app/mock-api/*.test.js
```

## 8. 限制

- 目前仍是 Node.js CommonJS 原型模組，尚未決定正式 App 技術框架及 bundler。
- 尚未建立正式 App route／頁面串接。
- 尚未在官網部署 repository bundle。
- 尚未連接正式 Supabase、正式 API 或真實顧客資料。
- 沒有修改正式資料庫、RLS、GRANT、RPC、Edge Functions、Storage、Secrets 或官網。
- CI 最新結果以 GitHub Actions 實際 run 為準。

## 9. 下一階段 Phase 40

建立前端頁面使用的「公開資料 View Model／Presenter」：
- 商品目錄整理為顧客 App 顯示資料。
- 餐車／擺攤行程整理為一致列表。
- 擺攤價格欄位持續完全不輸出。
- 對缺圖、缺時間、缺地區等資料採安全顯示策略。
- 使用 mock fixtures 驗證 UI model，不連正式服務。
