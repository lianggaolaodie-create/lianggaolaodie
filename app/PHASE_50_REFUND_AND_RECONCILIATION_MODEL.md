# Phase 50 — 退款生命週期與付款對帳參考模型

## 交付
- `app/mock-api/refund-model.js`：已付款快照登記、退款申請、冪等 key、累計退款上限、核准／拒絕／處理中／成功／失敗轉換、退款額度保留與對帳差異。
- `app/mock-api/refund-model.test.js`：合成資料測試部分退款、累計不得超過已付款金額、重複申請、payload conflict、拒絕／失敗後釋放額度、非法狀態轉換、對帳相符及差異。
- 退款狀態：requested → approved → processing → succeeded／failed；requested 可被 rejected。
- requested／approved／processing／succeeded 均占用可退款額度；rejected／failed 不占用。
- 對帳比較本地已登記付款與成功退款，對照金流商提供的付款／退款明細，標出缺漏、金額或幣別差異及外部多出紀錄。

## 正式後端必要條件
1. 退款申請、核准、送金流、回寫結果必須以資料庫交易與 row lock 防止併發超退。
2. 金流退款 API 必須使用 provider-specific idempotency key；本模型 key 僅供參考。
3. 退款成功只能由已驗證的金流回應／webhook 確認，不能由前端或一般管理畫面直接宣告。
4. 對帳匯入需驗證檔案來源、簽章／存取權限、日期區間、幣別、時區、手續費與交易狀態定義。
5. 實際對帳需分清授權、請款、入帳、退款、撤銷、手續費及銀行撥款；本模型只比較合成付款與退款列。
6. 正式資料須保存原始供應商 reference、稽核人員、時間、原因及每次狀態變更。
7. 退款後訂單、庫存回補、通知與發票／稅務處理需另行定義，不能由退款模型自行推定。

## 限制
- 純 Node reference model，使用記憶體 Map 與合成資料。
- 不呼叫金流、不建立退款交易、不改正式訂單、不匯入真實銀行資料。
- 尚未選定金流供應商；正式退款流程、費用、時限與對帳格式待確認。
- 正式 Supabase、官網、Edge Functions、Secrets 未修改。
