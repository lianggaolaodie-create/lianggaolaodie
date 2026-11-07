# Phase 48 — 訂單建立前 Checkout Gate／冪等性契約

## 交付內容
- 新增 `app/mock-api/checkout-gate.js`：使用 server-held quote registry、session-scoped idempotency key 與 quote reservation 的純 Node reference model。
- 新增 `app/mock-api/checkout-gate.test.js`：驗證報價不存在／過期、購物車或配送方式不符、收件資料不符、冪等 key 缺漏、重複請求、payload conflict、跨 session 與 quote replay。
- 只接受 quote ID，從 server-held quote registry 取得報價；不接受 client quote body、價格、運費或總額作權威。
- 對收件人姓名、電話、地址或門市欄位建立穩定 fingerprint，防止報價後竄改。
- 相同 session + idempotency key + 相同 payload 回傳原決策；同 key 不同 payload 回傳 conflict。
- 同一 quote 被不同 key／session 再次使用時拒絕。
- Gate 僅回傳「允許進入建單交易」的授權決策；不建立訂單、不執行付款。

## 重要限制
本模型的 Map 僅模擬流程，不提供跨程序／多伺服器持久性或真正競態安全。正式系統必須在資料庫單一交易中：
1. 鎖定 server-held quote 與 idempotency record。
2. 驗證 quote 未過期、未消耗、購物車／配送／收件資料 fingerprint 一致。
3. 以唯一索引保證 session scope + idempotency key 唯一。
4. 相同 key + 相同 request hash 回傳既有結果；相同 key + 不同 hash 回傳 conflict。
5. 建立訂單與標記 quote consumed／保存 idempotency result 原子提交；任何一步失敗則整筆 rollback。
6. 付款請求另以 payment idempotency key 防止重複扣款；不可將前端按鈕 disable 當成防重複保證。

## 測試與安全範圍
- 使用合成商品、報價與收件資料。
- 不連正式 Supabase、不寫正式訂單、不觸發付款或物流。
- 尚未實作正式 API、資料表、唯一索引、資料庫鎖、交易、訂單建立或付款。
- 必須在正式環境變更前提供 SQL／函式／資料流程、風險、備份與 rollback，並取得對該變更清單的明確核准。
