# Phase 41｜顧客端畫面狀態模型

日期：2026-11-08  
分支：`app/phase-1-planning`  
狀態：框架無關的 screen state reducer 與 mock 單元測試已建立；尚未接入正式 App UI。

## 1. 新增檔案

- `app/mock-api/screen-state.js`
- `app/mock-api/screen-state.test.js`
- `app/PHASE_41_SCREEN_STATE_AND_RETRY_MODEL.md`

## 2. 統一畫面狀態

| 狀態 | 畫面用途 |
|---|---|
| idle | 尚未載入 |
| loading | 首次載入中 |
| success | 有資料可顯示 |
| empty | 請求成功但沒有資料 |
| error | 首次載入失敗 |
| refreshing | 已有舊資料，背景更新中 |

畫面提示由 `getScreenMessage(state)` 提供，不把網路錯誤與空資料混為一談。

## 3. 錯誤、重試與保留資料

- `retryable: true` 才顯示可重試狀態。
- `NETWORK_ERROR`／`TIMEOUT` 可由 API client 標記可重試。
- 驗證錯誤及使用者取消不應自動重試。
- 重新整理時保留舊資料，更新失敗也不清空舊畫面。
- reducer 不會自行發出網路請求或自動重試；由 UI 的「重試」按鈕再次呼叫 loader。
- 每次請求使用遞增 requestId；較舊請求晚回來時會被忽略，避免舊結果覆蓋新資料。
- 使用 AbortController 的 signal 可取消請求；取消不顯示為一般網路錯誤。

## 4. 可重用載入 helper

`createLoadActions(repositoryMethod, mapData)` 將 repository 呼叫轉為：
- LOAD_START
- LOAD_SUCCESS
- LOAD_ERROR
- LOAD_CANCEL

呼叫端需提供 dispatch、單調遞增 requestId、可選 signal 及 options。每個畫面應自行管理 requestId，確保新請求使用比前次更大的整數。

## 5. 使用示意

```js
const { createScreenState, screenReducer, createLoadActions } =
  require('./screen-state');

let state = createScreenState();
let requestId = 0;
const dispatch = action => { state = screenReducer(state, action); };

const loadProducts = createLoadActions(
  options => repository.listCatalog(options),
  response => mapCatalogToViewModels(response.items)
);

async function refreshProducts() {
  requestId += 1;
  const controller = new AbortController();
  await loadProducts({
    dispatch,
    requestId,
    signal: controller.signal,
    options: { limit: 20 }
  });
}
```

上述為框架無關的整合示意，不是已完成的 App 畫面。實際 UI 離開畫面時需呼叫該畫面持有的 controller.abort()。

## 6. 測試

執行：
```bash
node --test app/mock-api/*.test.js
```

新增測試涵蓋：
1. 初始／首次載入狀態。
2. 有資料與空列表狀態。
3. 可重試與不可重試錯誤。
4. 重新整理保留舊資料。
5. 舊請求回應不得覆蓋新請求。
6. 取消請求後回復 idle 或保留舊資料。
7. RESET 清除錯誤及資料。
8. loader 的 loading／success／error／cancel action。
9. 未知 action 不修改 state。

## 7. 尚未完成

- 尚未建立正式 React Native／原生 iOS／Android 畫面。
- 尚未接上正式 API、Supabase 或官網。
- 尚未進行 iPhone 真機操作、背景切換或商店 build 測試。
- 沒有新增自動輪詢、背景監控或自動重試，避免無意義流量與費用。
- 沒有正式資料庫、RLS、RPC、Edge Function、Secrets 或官網變更。

## 8. 下一階段 Phase 42

建立顧客首頁／商品目錄／餐車與擺攤列表的 screen controller 組合層：把 Phase 39 repository、Phase 40 view models、Phase 41 screen state 接在一起，提供可測試的 load／refresh／cancel 方法，仍只使用 mock fixtures，並驗證擺攤資料不會帶出價格。
