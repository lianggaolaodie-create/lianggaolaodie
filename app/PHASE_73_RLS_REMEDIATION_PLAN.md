# Phase 73｜資料庫 RLS 修補藍圖與回復驗收計畫

## 目的
針對已知 `merch_products`、`merch_categories` 的 authenticated permissive ALL policy 風險，建立明確的目標權限與修補前後驗收規格。此階段只建立可測試的修補藍圖，**不執行 SQL、不更動 Supabase**。

## 優先順序
| 優先 | 資料表 | 目標 |
|---|---|---|
| P0 | merch_products | 公開僅能讀取已發布商品；寫入限 product_admin／super_admin |
| P0 | merch_categories | 公開僅能讀取已發布分類；寫入限 product_admin／super_admin |
| P1 | orders／order_items | 顧客僅限本人；管理員按職責管理；拒絕跨會員存取 |
| P1 | transfer_proofs | 私有資料；本人與付款審核角色依最小必要權限存取 |

## 修補前後檢查
1. 匯出目標 table 的所有 policy（含 permissive/restrictive、command、roles、USING、WITH CHECK）。
2. 檢查 table grants，確認 policy 與 GRANT 同時符合最小權限。
3. 特別搜尋 authenticated 的寬鬆 ALL policy；PostgreSQL permissive policies 是 OR 語意，不能只新增一條較嚴格 policy 就認定已限制。
4. 刪除或替換前，逐條確認 policy 名稱、依賴、匿名公開讀取需求與現有官網功能。
5. 建立 staging migration，先跑 Phase72 正反向測試，再跑官網公開商品讀取回歸。
6. 將 migration、policy snapshot、grant snapshot、測試結果與 rollback 一起審核。

## SQL 修補草案原則（非可執行腳本）
- 不使用 `TO authenticated USING (true) WITH CHECK (true)` 作為商品管理授權。
- 不用前端隱藏按鈕代替資料庫授權。
- 對公開目錄採明確的 published 條件；實際欄位名稱必須先由 schema 核實，不能猜欄位。
- 對管理寫入使用已驗證的 server-side role predicate；目前舊草案中的 `<VERIFIED_ADMIN_PREDICATE>` 仍是未解決佔位符，禁止直接執行。
- 不做全域 REVOKE，不批次修改 SECURITY DEFINER grants；逐函式檢查用途、search_path、呼叫者及資料範圍。
- Storage transfer-proofs bucket 必須另行檢查 object path ownership 與 bucket policy。

## 回復策略
- 每個 staging migration 必須附有對應 rollback migration。
- rollback 前先保存當前 policy/grant snapshot；確認 rollback 不會重新開啟寬鬆 ALL。
- 若官網商品讀取、管理員寫入、顧客訂單隔離任一測試失敗，停止發布並回復 staging。
- Production 變更須另外提交精確 migration diff、影響範圍、備份確認、維護時段與明確核准；未核准不得執行。

## 自動化驗證
- `app/security/rls-remediation-plan.js`：明確列出目標範圍與限制。
- `app/security/rls-remediation-plan.test.js`：檢查不允許 broad authenticated ALL、私有資料需 owner predicate。
- 測試是靜態規格檢查，不連線資料庫、不驗證真實 RLS。

## 完成判定
本階段只完成「修補規格／靜態檢查」。真正修補仍待獨立 staging、真實 JWT、policy/grant snapshot 與使用者明確核准。
