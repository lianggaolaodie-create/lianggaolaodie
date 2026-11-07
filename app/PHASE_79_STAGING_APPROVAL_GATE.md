# Phase 79｜Staging 修補前核准閘門

## 目的
在任何 staging 資料庫修補前，確認環境、備份、回復、測試、費用及核准資料完整。此階段只建立靜態核對工具，不連線、不執行 SQL。

## 必備證據（全部為 true 才可進入「另行核准」）
1. staging 專案身分已核實。
2. staging 與 production 已確認隔離。
3. 修補前 schema／RLS policy／GRANT 快照已保存。
4. 備份已完成且還原演練成功。
5. migration 與 rollback 經人工審查。
6. anon、顧客 A／B、各管理角色合成測試通過。
7. 官網、App、後台回歸測試通過。
8. 費用及帳單影響已核准。
9. 已指定技術負責人。
10. 已取得明確變更核准。

## 判定
- 任一證據缺漏或不是布林 true：NO-GO。
- 全部齊備：READY FOR SEPARATE EXECUTION APPROVAL。
- 即使全部齊備，工具仍不會執行資料庫變更；仍需另行明確批准及受控執行。

## 不可略過
- 不得把 production 當 staging。
- 不得在未測試 rollback 前套用 migration。
- 不得批次撤銷 SECURITY DEFINER function 權限。
- 不得將 service_role key 放入前端、GitHub 或測試輸出。
- 不得使用真實顧客資料做測試；使用合成資料及專用測試帳號。
- 發現權限外洩、跨會員讀取、匿名讀取私人資料或回復失敗，立即停止。

## 本階段限制
不建立 Supabase 專案、不更動方案或付款、不建立帳號、不改 secrets、不執行 SQL、不修改任何正式或 staging 資料。
