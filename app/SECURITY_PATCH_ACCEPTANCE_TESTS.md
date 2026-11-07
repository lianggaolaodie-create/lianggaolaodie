# App 安全修正驗收測試清單（草案）

## A. 訂單個資 RPC
- [ ] anon 呼叫 get_line_order_notification_payload(uuid) → permission denied。
- [ ] authenticated 普通會員呼叫同 RPC → permission denied。
- [ ] service_role 透過 Edge Function 讀取指定訂單 → 僅取得通知必要欄位。
- [ ] anon／authenticated 呼叫 get_cooling_order_line_notification_payload(bigint) → permission denied。
- [ ] service_role 通知流程成功；訂單資料與通知內容一致。

## B. 通知旗標
- [ ] anon／authenticated 呼叫 mark_line_payment_notification_sent(uuid) → permission denied。
- [ ] 尚未發送的通知可由可信 Function 執行一次。
- [ ] 同一訂單併發兩次通知只成功發送一次。
- [ ] LINE API 失敗不標記成功，重試不遺失通知。

## C. 付款與訂單狀態
- [ ] 顧客不能自行把 payment_status 改成 paid。
- [ ] 匯款後五碼／付款證明只代表 proof_submitted，不代表 paid。
- [ ] 只有管理員核實入帳或可信金流 webhook 能更新 paid。
- [ ] COD 訂單使用獨立收款完成流程。
- [ ] 取消、退款、已送達等狀態轉移符合前置條件。

## D. 會員與訪客
- [ ] 會員只能讀取 customer_user_id=auth.uid() 的訂單。
- [ ] 會員只能讀取本人 order_items 與必要 order_private 欄位。
- [ ] 不可用姓名／電話自動認領歷史訪客訂單。
- [ ] 訪客查詢使用高熵、短效、限次驗證 token，不暴露完整個資。

## E. 既有網站相容
- [ ] 涼糕送到府下單成功。
- [ ] 涼糕超商冷藏寄放下單成功、寄放費由可信設定讀取。
- [ ] 蘿蔔糕冷凍店到店與宅配下單成功。
- [ ] 現有 LINE 新單通知、付款證明通知、出貨通知成功。
- [ ] 老闆後台可查單、核款、更新物流；非授權角色不能操作。
- [ ] 官網原有商品、行程、下單頁及管理功能不回歸。

## F. 部署與回復
- [ ] 先在 staging／測試專案套用 SQL migration。
- [ ] 備份正式 DB schema/data、Storage metadata、Function source/secrets 管理清單、官網版本。
- [ ] 取得明確核准後才安排 production migration。
- [ ] 部署順序：相容的新 Edge Functions → SQL 權限收斂 → 端到端測試 → 監控。
- [ ] 保留上一版 Function 與 SQL rollback；若回復會重新開放個資 RPC，必須先修好 Function 呼叫路徑，不能為了回復而暴露個資。
