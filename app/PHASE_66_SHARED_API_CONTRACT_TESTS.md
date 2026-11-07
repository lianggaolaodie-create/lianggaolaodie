# Phase 66｜共用 API Contract 自動化測試

## 範圍
- 使用合成 fixtures 驗證 Phase 65 API contract 的關鍵安全規則。
- 新增 `app/mock-api/shared-api-contract.test.js`。
- GitHub Actions 新增 Phase 66 測試步驟。

## 測試案例
1. 公開 flavors／蘿蔔糕／周邊 DTO 僅輸出 allowlist 欄位，隱藏停用資料。
2. 每日菜單使用每日價格快照，不輸出精確庫存數字。
3. 擺攤 payload 即使來源有現行與 legacy 價格，也完全沒有價格 key。
4. 餐車僅輸出 `price_per_box`，不使用 legacy price 欄位。
5. 結帳授權僅採伺服器登記 quote，不接受客戶端自帶 total／paymentStatus 作為權威；模型仍不建立訂單或扣款。
6. 會員只能查詢已驗證綁定的本人訂單。
7. 訪客 claim 到期或撤銷後不可查詢。
8. 個資管理員不得審核付款或更新履約。
9. 未確認付款不得出貨。

## 安全限制
- 測試只呼叫本地純函式與記憶體模型。
- 不連 Supabase、不讀真實會員／訂單資料、不呼叫金流、不建立物流單。
- GitHub Actions 成功只能證明合成契約測試通過，不代表正式 API 已部署或整合完成。

## 驗收
- 等待 GitHub Actions Phase 66 run 完成；只有 runner 回報成功後才可標記測試通過。

## 下一階段（Phase 67）
建立 API mock server 的 HTTP contract layer，將公開 GET、quote、會員／訪客訂單查詢與後台角色操作轉成標準 HTTP status／錯誤格式，仍只用合成資料，避免接觸正式 Supabase。
