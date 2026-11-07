# Phase 74｜正式資料庫修補前逐表盤點清單

## 範圍與安全界線
本清單整理先前唯讀 schema audit 已知資料表，供下一次獨立 staging 盤點使用。**本階段不連線 Supabase、不讀取會員／訂單內容、不執行 SQL、不修改 production。** 欄位、policy 名稱、GRANT、RLS 開關等未在本階段重新查核的項目均標示待確認，不以猜測補齊。

## 逐表盤點
| 優先 | 資料表 | 已知摘要 | 必查項目 |
|---|---|---|---|
| P0 | merch_products | 曾發現 authenticated permissive ALL 風險 | 全部 policies、USING/WITH CHECK、GRANT、RLS、公開欄位條件 |
| P0 | merch_categories | 曾發現 authenticated permissive ALL 風險 | 全部 policies、USING/WITH CHECK、GRANT、RLS、公開欄位條件 |
| P1 | flavors | 先前觀察到 36 筆 | 欄位、約束、policy、GRANT、索引、外鍵 |
| P1 | daily_order_settings | 每日開單設定表 | 欄位、約束、policy、GRANT、索引、外鍵 |
| P1 | daily_order_regions | 每日服務區域表 | 欄位、約束、policy、GRANT、索引、外鍵 |
| P1 | daily_order_flavors | 每日口味與價格快照 | 欄位、約束、policy、GRANT、索引、外鍵 |
| P1 | food_truck_schedules | 餐車排程；先前未見地址座標欄位 | 欄位、policy、GRANT、索引、外鍵 |
| P1 | food_truck_schedule_flavors | 餐車排程口味 | 欄位、policy、GRANT、索引、外鍵 |
| P1 | orders | 訂單主檔；現行政策待重新確認 | owner key、訪客 claim、policy、GRANT、狀態寫入者 |
| P1 | order_items | 訂單明細；現行政策待重新確認 | 父訂單 ownership、policy、GRANT、快照欄位 |
| P1 | transfer_proofs | 私人匯款證明 | owner/order 關聯、policy、GRANT、Storage object path、審核紀錄 |

## staging 唯讀盤點順序
1. 核對 staging project ref、region、方案及環境標籤，確認不是 production。
2. 只查 information_schema／pg_catalog 的 schema metadata，不查真實訂單列或個資。
3. 匯出每張表 RLS enabled 狀態、policy command／roles／USING／WITH CHECK。
4. 匯出 table grants、sequence grants、function execute grants；逐一標註來源與用途。
5. 檢查 Storage bucket policy，尤其 transfer-proofs 的 object ownership 路徑。
6. 核對前端實際讀寫路徑與公開網站相容性。
7. 產生盤點快照與 SHA-256，修補前後逐項比對。

## 不得直接套用的事項
- 不得因為有一條 restrictive policy 就忽略其他 permissive policy 的 OR 語意。
- 不得猜測商品「已發布」欄位或管理員角色 predicate。
- 不得全域 REVOKE、不批次撤銷 SECURITY DEFINER function grants。
- 不得直接執行 Phase55 舊草案中的 `<VERIFIED_ADMIN_PREDICATE>` 佔位符。
- 不得以 mock 測試代替真實 JWT／RLS staging 測試。

## Go／No-Go
**Go**：確認隔離 staging、完整 metadata snapshot、角色 JWT、rollback migration、測試資料及前端回歸測試均備妥。
**No-Go**：無法確認環境、權限 predicate 未驗證、缺 rollback、匿名公開讀取回歸失敗、或出現跨會員讀取。
Production 修補仍需獨立列出 SQL diff、影響、備份、維護窗口及明確核准。
