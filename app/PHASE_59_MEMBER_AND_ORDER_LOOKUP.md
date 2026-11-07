# Phase 59｜會員資料與顧客訂單查詢參考模型

## 本階段交付
- 會員資料同步模型：只接受外部驗證完成的 identity subject；不收密碼、不自行簽發登入 session。
- 會員個人資料採欄位白名單，僅保存顯示名稱、驗證狀態及遮罩聯絡資訊。
- 會員訂單查詢：必須由已驗證身份 subject 與訂單 owner 綁定。
- 訪客訂單查詢：使用高熵隨機 claim token，資料庫正式版僅保存 token hash；具期限及撤銷能力。
- 訂單查詢回應白名單：不回傳完整電話、地址、內部備註或 owner subject。
- 6 項合成資料測試。

## 新增檔案
- app/mock-api/member-order-model.js
- app/mock-api/member-order-model.test.js
- app/PHASE_59_MEMBER_AND_ORDER_LOOKUP.md

## 安全與正式環境限制
- 這是 Node.js 記憶體 reference model，不是正式會員登入或訂單 API。
- 真正登入必須使用 Supabase Auth 或其他正式身份供應商；App 不得自行儲存密碼或自行宣告 verified。
- 訪客 claim token 必須透過已驗證的下單流程安全交付；正式環境只存 hash，並加上速率限制、稽核、撤銷與期限。
- 正式查詢必須由 server-side RLS／RPC 再驗證訂單擁有權；不可相信客戶端傳入的 user ID。
- 未讀寫 Supabase、未改官網、未建立真實會員、未查詢或更動正式訂單。
