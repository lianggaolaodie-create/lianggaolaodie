# Phase 80｜Staging 安全修補套件（審查草稿）

## 交付內容
- 每個目標分開產生 migration 草稿及 rollback 草稿。
- 每個草稿包含目標、修補目的、人工確認欄位及驗收方向。
- 權限測試案例沿用匿名、顧客 A／B、資料擁有者及管理員角色矩陣。
- 產生器明確標示不可直接執行。

## 目標
| ID | 目標 | 修補方向 |
|---|---|---|
| SEC-001 | public.merch_products | 商品資料最小權限 |
| SEC-002 | public.merch_categories | 分類資料最小權限 |
| SEC-003 | public.orders | 訂單擁有者隔離 |
| SEC-004 | public.transfer_proofs | 匯款證明私有存取 |

## 為何只產生草稿
目前尚未重新取得 staging 的實際 policy 名稱、欄位、管理員 predicate、guest claim 規格及 Storage object path 規格。直接猜測 SQL 可能鎖死後台或暴露會員資料。因此草稿使用 placeholder，不可執行。

## 執行前人工補齊
1. staging 專案 ref 與 production 隔離證據。
2. 最新 schema、policy、grant、function、storage policy snapshot。
3. 實際 admin role claim 來源與 predicate。
4. orders／transfer_proofs 的 owner 欄位及 guest token 規格。
5. 逐表 migration、rollback、驗收 SQL。
6. 備份還原測試與明確變更核准。

## 安全限制
- 不連線 Supabase。
- 不執行 SQL。
- 不修改 policy、GRANT、function、Storage 或 secrets。
- 不產生 production 可直接套用 migration。
- 不批次撤銷 SECURITY DEFINER 權限。
- 所有輸出預設 `executable: false`，必須人工審查。
