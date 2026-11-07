# Phase 70｜合成 Staging Seed 與免費安全測試基礎

- 新增 `app/mock-api/staging-seed.js`：固定合成會員、管理角色、商品、口味、餐車／擺攤、訂單、訪客 claim、冪等 fixtures。
- 新增 `app/mock-api/staging-seed.test.js`：6 個 Node 原生測試，檢查合成環境、角色資料、擺攤價格隱藏、餐車價格、claim 過期／撤銷與測試 email。
- 此 seed 僅為 JS 資料匯出，**不會連線 Supabase、不會寫入任何資料庫**。
- 不包含真實會員資料、密碼、有效 token、API key 或任何 secrets。
- 目前的 RLS 與 Function 權限測試仍須在隔離 staging project 使用真實 JWT／資料庫 policy 才能驗證；本 mock 測試不能替代該步驟。
