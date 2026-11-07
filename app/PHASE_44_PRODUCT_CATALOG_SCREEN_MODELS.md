# Phase 44 — 涼糕／蘿蔔糕商品專區畫面模型

## 本階段交付
- 建立涼糕與蘿蔔糕兩個獨立商品分類。
- 支援依商品名稱、介紹、規格搜尋。
- 商品卡包含名稱、介紹、規格、圖片 URL／fallback、價格標籤與可售狀態。
- 商品詳情模型提供介紹、規格、價格、販售狀態欄位。
- 缺價、價格待確認或停售商品仍可顯示，但不可加入購物車。
- 購物車入口只回傳導覽意圖，不建立訂單、不修改庫存、不執行付款。
- 不自行計算價格；沿用上游顯示價格字串。
- 無正式商品資料或假商品寫入；測試使用合成 fixtures。

## 新增檔案
- `app/mock-api/product-catalog-screen.js`
- `app/mock-api/product-catalog-screen.test.js`
- `app/PHASE_44_PRODUCT_CATALOG_SCREEN_MODELS.md`

## 驗收範圍
- 涼糕／蘿蔔糕分類隔離
- 搜尋名稱、介紹、規格
- 空搜尋、無結果、空分類、未知分類
- 缺圖 fallback
- 缺價／停售不可訂購
- 詳情欄位 placeholder
- 購物車入口可用性與未知動作封鎖

## 限制
本階段是 framework-independent 的純 JavaScript 畫面資料模型與單元測試，不是原生 iOS／Android UI；尚未連接正式商品 API、購物車狀態、下單、付款或庫存。沒有修改正式 Supabase、官網、LINE、Secrets 或部署任何服務。

## 下一階段建議
Phase 45：建立購物車純模型，處理商品加入／移除／數量調整、重複商品合併、價格快照顯示與缺價／停售阻擋；先定義購物車資料契約，不建立正式訂單。
