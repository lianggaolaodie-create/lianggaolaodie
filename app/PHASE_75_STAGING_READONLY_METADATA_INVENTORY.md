# Phase 75｜Staging 唯讀 Metadata Inventory

## 交付
- `app/security/phase-75-staging-metadata-inventory.sql`：PostgreSQL metadata-only 查詢。
- `app/security/readonly-sql-guard.js`：靜態安全檢查。
- `app/security/readonly-sql-guard.test.js`：Node 測試。
- 不需要建立 Supabase 專案、不產生費用、不修改 production。

## 使用前確認
1. 必須先確認 Supabase project ref 是獨立 staging，並由管理者確認不是 production。
2. SQL 以 `BEGIN TRANSACTION READ ONLY` 開始，最後 `ROLLBACK`。
3. 查詢僅涵蓋 schema、欄位 metadata、RLS policies、table privileges、function metadata、foreign keys、Storage bucket metadata 與 Storage policies。
4. 不讀取訂單、會員、付款證明等業務資料列，也不讀取 Storage object 內容。
5. SQL 編輯器若不支援交易或 READ ONLY，停止執行，不要移除安全包裝來硬跑。

## 輸出核對
- 逐一確認 11 張目標資料表是否存在。
- merch_products／merch_categories：找出所有 permissive policies，特別是 authenticated + ALL，確認 USING／WITH CHECK。
- orders／order_items：確認 ownership 欄位與 FK 路徑；不可只靠 UI。
- transfer_proofs：確認表政策與 Storage objects policy 同時限制 owner／授權角色。
- Functions：逐一檢查 SECURITY DEFINER、search_path、anon/authenticated EXECUTE；不得批次撤權。
- 缺少的表、欄位、policy 或 privilege 必須標記「未發現／待確認」，不可自行補猜。

## 限制
靜態 guard 不是完整 PostgreSQL parser，也不能證明任意 SQL 絕對安全。這份 SQL 沒有在任何資料庫執行；CI 只驗證檔案安全結構。真實 staging 結果尚未取得。production 維持唯讀。
