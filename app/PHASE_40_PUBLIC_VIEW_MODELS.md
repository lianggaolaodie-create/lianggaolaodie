# Phase 40｜顧客端公開資料 View Model／Presenter

日期：2026-11-08  
分支：`app/phase-1-planning`  
狀態：顯示資料整理層及合成資料測試已建立；尚未接入正式 App 畫面。

## 1. 新增檔案

- `app/mock-api/public-view-models.js`
- `app/mock-api/public-view-models.test.js`
- `app/PHASE_40_PUBLIC_VIEW_MODELS.md`

## 2. 商品列表 View Model

輸出欄位：
- `id`、`name`、`category`
- `description`、`spec`
- `imageUrl)、`imageFallbackLabel`
- `priceLabel)、`available)、`availabilityLabel`

顯示規則：
- category 映射為「涼糕」或「蘿蔔糕」。
- 缺少商品名稱時顯示「商品名稱待更新」。
- 缺少或不安全圖片 URL 時使用 `imageUrl: null`，畫面可使用 fallback label。
- 只有明確的非負整數 TWD 價格才格式化為 NT$。
- null、負數、非整數或非 TWD 幣別不會被顯示成價格。
- `available !== true` 或價格無效時，顯示「暫不可訂購」。
- View Model 不自行計算折扣或訂單總額，正式結帳仍以伺服器核價為準。

## 3. 公開內容 View Model

- 只轉換 `published === true` 的 section。
- 標題缺失時顯示「公告」。
- 內容缺失時使用空字串，不編造公告文字。
- 圖片 URL 僅接受 HTTP／HTTPS；缺圖回傳 null。

## 4. 餐車／擺攤 View Model

共同欄位：
- `id`、`type`、`typeLabel`
- `date`、`title`、`region`、`timeLabel`
- `flavors`（口味 id／名稱）

規則：
- 日期僅接受 YYYY-MM-DD 外觀格式，否則顯示「日期待公布」。
- 時間僅接受 HH:mm，開始與結束皆有才組合區間；缺漏顯示「時間待公布」。
- 缺少地區顯示「地區待公布」。
- 缺少行程名稱時使用「餐車行程」或「出攤行程」。
- 不認得的 schedule type 不會進入顧客列表。
- 餐車 flavor 僅在明確有效 TWD 價格時輸出 priceLabel。
- 擺攤 flavor 即使來源物件意外帶入 price／currency，也會在 View Model 中徹底移除，輸出不含價格欄位。

## 5. 測試

執行：
```bash
node --test app/mock-api/*.test.js
```

新增測試涵蓋：
1. 涼糕與蘿蔔糕商品欄位轉換。
2. 缺圖、缺價與不可訂購狀態。
3. 不安全 URL（javascript／data／錯誤 URL）拒絕。
4. 只顯示已發布內容。
5. 缺少行程日期、地區、時間的 fallback。
6. 餐車可顯示價格、擺攤不可輸出價格。
7. 不明行程類型過濾。
8. 無效價格與非 TWD 幣別不顯示金額。

## 6. 使用示意

```js
const { mapCatalogToViewModels, mapSchedulesToViewModels } =
  require('./public-view-models');

const catalogCards = mapCatalogToViewModels(catalogResponse.data.items);
const truckCards = mapSchedulesToViewModels(truckResponse.data.items, 'food_truck');
const stallCards = mapSchedulesToViewModels(stallResponse.data.items, 'stall');
```

上述是顯示資料轉換示意，尚未接入正式 App UI framework。

## 7. 限制

- View Model 是顯示層資料，不是資料庫 schema，也不是正式價格／庫存授權依據。
- 沒有正式 App 頁面、iOS／Android build 或商店上架。
- 沒有正式 Supabase、官網或真實顧客資料串接。
- 沒有修改正式資料庫、RLS、GRANT、RPC、Edge Functions、Storage、Secrets 或官網。
- 測試結果以本階段提交後的 GitHub Actions workflow 為準。

## 8. 下一階段 Phase 41

建立首頁／商品目錄／出攤行程的 screen state 與 loading／empty／error／retry model，讓 App UI 可以一致處理載入中、沒有資料、網路失敗、逾時及重新整理；繼續使用 mock repository，不連正式服務。
