# Phase 52 — 訂單狀態、付款、物流與通知協調模型

## 交付
- `app/mock-api/order-flow-model.js`：訂單、付款、履約三組獨立狀態；版本檢查；事件冪等；通知 outbox 與重試狀態。
- `app/mock-api/order-flow-model.test.js`：合成資料測試狀態分離、付款前不可出貨、非法轉換、版本衝突、事件重送、取消後不可付款、通知冪等及重試。

## 設計原則
1. 訂單、付款、履約狀態分開管理，不能用單一「訂單狀態」推測付款或物流。
2. 未付款不可出貨；取消訂單不可再核實付款。
3. 每次狀態變更使用 expectedVersion 防止舊畫面覆蓋新狀態，並以 eventId 防止事件重複套用。
4. 通知先寫入 outbox，再由正式 worker 發送；重試不應重複建立通知紀錄。
5. LINE／Email／SMS／Push 只保存通知任務狀態，不在此模型實際發送訊息。
6. 配送類型保留涼糕送到府、涼糕超商冷藏寄放、蘿蔔糕冷凍店到店、蘿蔔糕冷凍宅配及餐車取貨識別。

## 正式後端必要條件
- 訂單、付款、履約事件與 outbox 應在同一資料庫交易內提交；以 row lock／version 欄位及唯一事件索引確保一致。
- worker 使用 provider-specific idempotency，避免 LINE／郵件服務重送造成重複訊息。
- 訊息 payload 應使用最少必要個資；recipientRef 必須由後端可信資料查得，不接受客戶端任意指定收件對象。
- 需補齊既有 DB status check constraints、RPC、RLS、admin 權限與歷史資料轉換對照後，才能映射正式狀態。
- 本模型的簡化狀態轉換是參考草案，正式狀態必須依各物流方式、付款方式與既有資料庫約束逐一核對。

## 限制
- 純 Node in-memory reference model 與合成測試。
- 不呼叫 LINE、不發送 Email／SMS／Push、不修改正式訂單或物流狀態。
- 正式 Supabase、官網、Edge Functions、Secrets 未修改。
