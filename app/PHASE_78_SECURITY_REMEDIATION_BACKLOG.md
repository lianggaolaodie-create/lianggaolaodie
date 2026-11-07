# Phase 78｜安全修補工作清單與驗收責任分工

## 執行原則
本清單只安排工作，不代表授權修改資料庫。所有任務先在獨立 staging 執行；production migration 必須另外取得明確核准。

## 優先工作
| ID | 優先 | 工作 | 負責角色 | 目前狀態 |
|---|---|---|---|---|
| SEC-001 | P0 | merch_products 寬鬆 ALL policy | database_security_owner | 等待 staging |
| SEC-002 | P0 | merch_categories 寬鬆 ALL policy | database_security_owner | 等待 staging |
| SEC-003 | P1 | 訂單／明細 ownership 隔離 | auth_and_database_owner | 等待 staging |
| SEC-004 | P1 | 匯款證明與私有 Storage | payment_security_owner | 等待 staging |
| SEC-005 | P1 | SECURITY DEFINER／search_path／EXECUTE | database_security_owner | 等待逐函式審查 |
| SEC-006 | P2 | 其他資料表 RLS 缺漏 | database_security_owner | 等待分類 |
| SEC-007 | P2 | 管理角色分離與稽核紀錄 | application_security_owner | 等待角色來源確認 |

## 每項工作必須附帶
- 修補前 policy／GRANT／function snapshot。
- staging migration diff 與明確的回復腳本。
- 使用 anon、顧客 A、顧客 B、各管理角色 JWT 的正反向測試。
- 官網公開讀取與 App／後台既有流程回歸。
- 修補後 snapshot 比對與人工審查簽核。

## 停止條件
跨會員讀取、匿名取得私人資料、公開商品讀取中斷、管理員職責越權、無法回復或環境不確定時，立即 NO-GO。

## 責任角色說明
以上是待指派的職能角色，不代表已指定某位員工或已建立 Supabase 權限帳號。

## 限制
Phase78 不建立 staging、不執行 SQL、不修改 policy／GRANT／functions、不改 secrets、不產生費用。所有項目預設 blocked，不能由清單自動執行。
