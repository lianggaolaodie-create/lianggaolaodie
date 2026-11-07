# Phase 62｜訂單後台權限與取消冪等性補強

## 本階段修正
- 將履約管理權限收斂至 super_admin、order_admin；personal_data_admin 可依授權查看個資，但不可變更備貨／出貨狀態。
- 訂單取消加入冪等紀錄：同一 key、同一內容重送回傳 duplicate，不重複寫入稽核；同 key 不同內容回傳 IDEMPOTENCY_CONFLICT。
- 取消流程先驗證 store、key、時間，再檢查訂單版本及狀態。
- 新增測試覆蓋個資管理員不可操作履約，以及取消重送／key reuse 衝突。

## 安全邊界
- 變更只在 in-memory mock model 與合成測試。
- 不修改正式 Supabase 權限、資料、訂單、付款、物流或員工帳號。
- 正式部署前仍需將同等權限規則落實在 server-side authorization 與 RLS，並完成 staging 測試。
