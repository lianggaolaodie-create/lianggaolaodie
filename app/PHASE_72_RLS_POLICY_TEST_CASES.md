# Phase 72｜RLS 權限測試案例與驗收矩陣

## 本階段建立
- `app/mock-api/rls-policy-test-model.js`：資料表與角色的合成 policy evaluator。
- `app/mock-api/rls-policy-test-model.test.js`：10 項 Node 原生測試。
- 本文件：定義 staging 真實 RLS 測試應覆蓋的正向／負向案例。
- GitHub Actions：加入 Phase 72 測試。

## 覆蓋資料表
`flavors`、每日開單三表、餐車排程兩表、`merch_products`、`merch_categories`、`orders`、`order_items`、`transfer_proofs`。

## 核心安全案例
1. 會員 A 只能讀取 A 自己的訂單／明細；不能讀取會員 B 的資料。
2. anon 不得讀取匯款證明等私人檔案／資料。
3. 一般會員不得新增、修改或刪除周邊商品與分類。
4. product_admin 可管理商品，但不能核款或履約。
5. order_admin 可管理訂單，但不能管理商品或付款證明。
6. payment_admin 可處理付款證明，不可管理商品或出貨。
7. personal_data_admin 的檢視權不等於寫入權。
8. 公開 SELECT 不可推導出 INSERT／UPDATE／DELETE 權限。
9. 未知資料表、未知角色一律拒絕。

## 與 production 現況差異提醒
已知 production 曾盤點出 `merch_products`、`merch_categories` 有 authenticated permissive ALL policy，可能 OR 合併繞過嚴格管理 policy。此階段僅以合成模型定義預期安全行為，**沒有查詢個資、沒有執行 SQL，也沒有修補 production**。

## 真實 staging 驗收必做
- 建立 anon、會員 A、會員 B、product_admin、order_admin、payment_admin、personal_data_admin、super_admin 對應 JWT。
- 逐表執行 SELECT／INSERT／UPDATE／DELETE 正反向案例。
- 以實際 SQL policy 和 grants 驗證，不以 UI 隱藏按鈕當作安全控制。
- 驗證 PERMISSIVE policy 的 OR 語意、table grants、RPC SECURITY DEFINER、Storage policies。
- 對每個拒絕案例確認資料庫拒絕，而非只在前端擋住。
- 匯出修補前後 policy／grant snapshot；每個 migration 必須附 rollback。
- staging 通過後仍需 production 變更清單及使用者明確核准。

## 限制
此模型不是 Supabase RLS，不會執行 SQL，不連線 production，也不證明真實資料庫已安全。只有獨立 staging 中以真實 JWT／資料庫 policy 跑完測試，才能標記 RLS 整合驗收完成。
