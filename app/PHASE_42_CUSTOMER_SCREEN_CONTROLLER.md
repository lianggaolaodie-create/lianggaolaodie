# Phase 42｜顧客端首頁、商品與行程 Screen Controller 整合

日期：2026-11-08  
分支：`app/phase-1-planning`  
狀態：框架無關的組合控制器與 mock 測試已建立；尚未接入正式 App UI 或正式 API。

## 1. 本階段串接層

`customer-screen-controller.js` 將既有三層組合：
1. Phase 39：公開唯讀 repository。
2. Phase 40：首頁內容、商品、行程 view models。
3. Phase 41：idle／loading／success／empty／error／refreshing 狀態、取消與過期請求保護。

資料流：
```
Public Repository (mock or HTTP adapter)
  -> DTO envelope / paged items
  -> View Model mapping
  -> Screen State reducer
  -> subscribe() state snapshots for future UI
```

## 2. 已提供的畫面載入方法

| 方法 | 資料來源 | 顯示規則 |
|---|---|---|
| `loadHome()` | `getPublishedContent()` | 僅轉換已發布內容 |
| `loadCatalog()` | `listAllCatalog()` | 涼糕與蘿蔔糕商品 |
| `loadTruckSchedules()` | `listAllSchedules({type:'food_truck'})` | 餐車行程，符合條件時可顯示價格 |
| `loadStallSchedules()` | `listAllSchedules({type:'stall'})` | 擺攤行程，view model 不包含價格 |

共用控制：
- `getState()` 取得四個畫面最新狀態。
- `subscribe(listener)` 訂閱狀態快照，並回傳取消訂閱函式。
- `cancel(screenKey)`／`cancelAll()` 取消請求。
- `dispose()` 結束控制器，取消工作並清除訂閱。
- 每個畫面獨立 requestId 與 AbortController；同一畫面新請求會取消舊請求。
- 舊請求即使忽略 signal、晚回傳，也不會覆蓋較新的畫面資料。
- 重新整理失敗時保留最後成功資料，並保留可重試錯誤資訊。

## 3. 重要資料規則

- 首頁不顯示未發布區塊。
- 商品目錄讀取完整分頁結果；分頁上限仍由 repository/API client 控制。
- 餐車行程只查詢 `food_truck`。
- 擺攤行程只查詢 `stall`。
- 擺攤 view model 不輸出 `priceLabel`、`price` 或 `currency`。
- 本控制器不建立訂單、不處理會員、不寫入資料庫，也不決定正式售價。

## 4. 新增檔案

- `app/mock-api/customer-screen-controller.js`
- `app/mock-api/customer-screen-controller.test.js`
- `app/PHASE_42_CUSTOMER_SCREEN_CONTROLLER.md`

## 5. 測試範圍

- 首頁已發布內容過濾。
- 商品目錄涼糕／蘿蔔糕映射。
- 餐車與擺攤行程分開查詢。
- 擺攤價格欄位完全不輸出。
- 空資料狀態。
- 重新整理失敗保留上次成功資料。
- 新請求取代舊請求及過期回應保護。
- AbortController 取消。
- 訂閱與取消訂閱。
- cancelAll／dispose。
- 無效 repository 與分頁參數拒絕。

執行命令：
```bash
node --test app/mock-api/*.test.js
```

## 6. 尚未完成／限制

- 尚未建立正式 React Native、Swift 或 Android UI 畫面。
- 尚未連接正式 Supabase、正式 API 或官網。
- 尚未進行 iPhone／Android 真機、背景切換、網路切換測試。
- 本階段使用合成資料與 mock repository。
- 未修改正式資料庫、RLS、RPC、Edge Functions、Secrets、官網或任何正式訂單資料。
- 未增加付費服務。

## 7. 下一階段 Phase 43

把 controller 的輸出整理成顧客首頁資訊架構與導覽頁面模型：首頁 Banner／公告、商品分類、餐車／擺攤入口、空狀態與錯誤狀態；建立可供未來原生 UI 使用的導覽定義與互動驗收測試。仍不宣稱已完成可安裝 App。
