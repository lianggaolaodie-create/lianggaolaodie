# laodie-pos（Phase 1）

獨立於官網的 React + Vite 收銀前端。此資料夾可在 Vercel 設定為單獨的 Root Directory：`pos`。

## 本階段功能
- 餐車收銀登入（Supabase Auth）
- 從 `food_truck_products` 載入啟用商品
- USB／藍牙鍵盤型掃碼槍輸入條碼（Enter 結束）
- 購物車數量、單價與總額計算
- 結帳寫入既有 `food_truck_sales`
- 58mm 紙寬瀏覽器列印版面

## Vercel 設定
Root Directory：`pos`
Build Command：`npm run build`
Output Directory：`dist`
Install Command：`npm install`

環境變數：
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

只能使用 publishable/anon key；不可將 service_role/secret key 放入前端。

## 注意
列印採瀏覽器列印對話框，紙寬 58mm。iPhone Safari 不一定能直接連接所有藍牙熱感印表機；正式現場建議使用可列印的桌機／平板瀏覽器或印表機廠商支援的列印橋接程式。
