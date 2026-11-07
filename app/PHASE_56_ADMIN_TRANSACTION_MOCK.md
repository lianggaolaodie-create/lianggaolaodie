# Phase 56｜每日開單與蘿蔔糕商品交易 Mock 服務

- 日期：2026-11-08（Asia/Taipei）
- 分支：`app/phase-1-planning`
- 狀態：可執行 in-memory mock service 與合成測試；未連正式環境。

## 1. 本階段交付
- 每日開單完整替換式儲存：設定、地區、口味與每日價格快照一次提交。
- 樂觀版本控制：舊版本寫入回傳 VERSION_CONFLICT。
- 模擬交易中止：任何提交前失敗均不修改資料、稽核或冪等紀錄。
- 冪等 key：同 key 同 payload 重播原結果；同 key 不同 payload 拒絕。
- 蘿蔔糕 JSON section 僅允許更新 radish_products，不覆蓋 radish_order_settings。
- 蘿蔔糕 expectedVersion 防止多人最後寫入覆蓋。
- 管理角色拒絕測試、日期／價格／重複 ID 驗證與稽核紀錄。

## 2. 執行邊界
Mock service 只使用 Node.js 記憶體 Map 與合成資料。沒有 Supabase client、網路、Storage、真實顧客資料、付款、訂單或官網操作。transaction abort 是模型層原子性模擬，不等於正式 PostgreSQL transaction 已實作。

## 3. 每日開單規則
- 日期必須是有效 YYYY-MM-DD。
- 每個 flavorId 不可重複；價格為非負整數；數量為 null 或非負整數。
- 地區名稱不可重複。
- 初次建立 expectedVersion 可省略或為 0；更新必須傳目前版本。
- 每次成功更新 version + 1。
- 保存完整 replacement snapshot，避免分次刪除／插入造成部分狀態。
- idempotency key 同內容重送不重複稽核；不同內容重用同 key 拒絕。

## 4. 蘿蔔糕 JSON 規則
- 只允許 section_id = radish_products。
- 每個商品需有唯一 id、name、非負整數 price、online_enabled boolean。
- enabled 可省略；若提供必須是 boolean。
- 更新必須傳 expectedVersion，成功後版本加一。
- 其他 section（例如 radish_order_settings）完全不受影響。

## 5. 權限模型（Mock）
- owner、super_admin、product_admin 可管理每日開單與蘿蔔糕商品。
- order_admin、一般會員、匿名不得寫入商品／開單設定。
- 此角色是 Phase 56 測試用 mock policy，不代表正式 admin_profiles 的欄位／權限已對應；正式權限須以 server-side helper 與 RLS 為準。

## 6. 測試覆蓋
- 初次建立與版本遞增。
- stale concurrent writer 衝突。
- transaction abort 完整回復。
- 輸入驗證與重複 flavor／product IDs。
- 一般會員與 order_admin 寫入拒絕。
- idempotency replay 與 key reuse conflict。
- radish section allowlist、version conflict、無關 section 保留。
- 稽核紀錄只在成功 commit 後新增。

## 7. 正式環境待辦
要轉為正式 RPC，仍須補 PostgreSQL row lock／transaction、資料表欄位映射、唯一鍵與 FK 驗證、實際 admin helper、EXECUTE grants、RLS、API exposure、備份及 staging 測試。沒有明確核准前不部署、不執行 SQL。
