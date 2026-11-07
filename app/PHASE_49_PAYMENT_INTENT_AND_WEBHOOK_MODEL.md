# Phase 49 — 付款意圖、付款狀態與 Webhook 驗證參考模型

## 交付
- `app/mock-api/payment-model.js`：建立付款意圖、session scope 冪等 key、付款期限、HMAC-SHA256 webhook 簽章與時間窗驗證、事件去重、金額／幣別／provider／intent 綁定。
- `app/mock-api/payment-model.test.js`：合成資料測試建立付款意圖、重複請求、金額衝突、簽章錯誤、時間戳過期、重複 webhook、事件 ID 衝突、付款成功／失敗、金額不符、逾時及終態保護。
- 狀態僅有 pending、succeeded、failed、expired；成功／失敗／逾時後不允許回退或覆寫。
- webhook 僅在簽章、時間窗、payload、intent、amount、currency、provider 全部通過後才可更新模型內狀態。

## 正式後端必須補足
1. 使用金流供應商文件規定的原始 request bytes、簽章 header、簽章演算法及 timestamp 格式；本模型的 `timestamp.rawBody` HMAC 只是通用示範，不可直接當任何供應商正式規格。
2. 金鑰只能存放於 server-side Secrets；不得放 App、官網前端、GitHub 文件或日誌。
3. 在資料庫交易內鎖定 payment intent、檢查唯一 event ID、驗證訂單與金額快照、更新付款狀態並寫稽核紀錄。
4. 以唯一索引保證 provider + event ID、provider + payment ID、session scope + idempotency key 唯一。
5. 對 webhook 重試回傳供應商要求的成功 HTTP acknowledgement，但重複事件不得重複入帳或重複通知。
6. 付款成功必須核對訂單仍可付款、金額與幣別完全一致；退款須使用獨立退款狀態機與金流退款 API。
7. 逾時不能只靠前端計時器；由後端排程／查詢供應商最終狀態處理，避免晚到成功通知與逾時競態。

## 範圍限制
- 純 Node reference model 與合成測試；不呼叫金流、不建立真實付款、不扣款、不修改正式訂單。
- Map 不具跨程序持久性或資料庫交易／併發安全。
- 尚未選定／串接實際金流供應商，不能視為已可收款。
- 正式 Supabase、官網、Edge Functions、Secrets 均未修改。
