# Phase 22｜周邊商品 Caller Matrix／外部入口清單／本機安全測試

日期：2026-11-08  
分支：app/phase-1-planning  
範圍：以 active branch 前端程式、既有 Supabase metadata／Function source、GitHub 程式搜尋與本機 Node.js fixtures 進行盤點。正式環境唯讀。

## 1. 已確認的前端訂單入口

| 業務流程 | 前端／來源 | 建單入口 | 付款資料 | 付款證明上傳 | 狀態 |
|---|---|---|---|---|---|
| 涼糕送到府 | home-delivery-order.html（Phase 16 已查） | `create_customer_order` RPC | 依既有流程欄位 | 本次未重新確認完整頁面 | 已知 DB RPC caller |
| 涼糕超商冷藏寄放 | convenience-order.html | `create_cooling_pickup_order` RPC | 匯款後五碼 | 未見付款證明上傳 caller | 已確認前端 RPC caller |
| 涼糕超商冷藏寄放 | convenience-order-v2.html | `create_cooling_pickup_order` RPC | 匯款後五碼 | 未見付款證明上傳 caller | 已確認前端 RPC caller |
| 蘿蔔糕配送 | radish-order.html | 前端讀取 site_admin_content；送單流程需與 RPC 版本進一步核對 | 本次搜尋片段未足以確認完整付款欄位 | 未找到付款證明上傳 caller | 部分確認 |
| 周邊商品 | merch.html | 直接 INSERT merch_orders，接著 INSERT merch_order_items | 寫入匯款後五碼；payment_status='unpaid' | 完整 submit handler 沒有 file input／Storage upload／payment_proof_url | 已確認無 proof upload |
| 周邊商品管理 | merch-admin.html | 直接讀寫 merch_orders／merch_order_items | 可更新 payment_status | 無上傳；個資清除時 payment_proof_url 設 NULL | 已確認 |
| 周邊商品管理 | merch-admin-v2.html | 讀取 merch_orders | 顯示 payment_status | Storage upload 僅 merch-images 商品圖 | 已確認 |

**關鍵結論**：周邊商品目前不是「付款證明上傳 caller 尚未被搜尋到」而已；active branch 的 `merch.html` 完整訂單 submit handler 已讀取，流程中確實沒有付款證明檔案上傳。需要先開發客戶端上傳與後端 finalize，才會有真正的付款證明通知事件。

## 2. Edge Function caller matrix

| Function | 已知 DB caller | 已知前端 caller | 外部 caller | Phase 22 判斷 |
|---|---|---|---|---|
| line-customer-notify | 未找到 DB pg_net caller | GitHub active branch 搜尋未找到 | 未知 | 保留；須確認出貨管理端、物流商／外部自動化入口 |
| line-payment-notify | 未找到 DB pg_net caller | 已檢查頁面未找到 | 未知 | 保留；需核對 Dashboard logs、第三方 webhook、手動呼叫 |
| merch-payment-sync | 未找到 DB pg_net caller | merch.html 未呼叫 | 未知 | 保留；未證明為實際週邊商品付款入口 |
| line-order-send-v2 | orders INSERT trigger → notify_line_on_new_order() | 前端透過建單 RPC 間接觸發 | 未知 | 已確認 DB trigger caller；不要另由前端重複呼叫 |
| line-order-payment-send-v2 | orders 付款資料更新 trigger → notify_line_on_payment_proof() | 前端透過付款 RPC 間接觸發（依 Phase 16） | 未知 | 已確認 DB trigger caller |
| cooling-order-line-notify | cooling_pickup_orders INSERT／付款資料 trigger | 前端透過 create_cooling_pickup_order 間接觸發 | 未知 | 已確認 DB trigger caller |
| line-order-notify | 本次未找到 DB caller | 已檢查頁面未找到 | 未知 | 不可停用 |
| line-payment-order-notify | 本次未找到 DB caller | 已檢查頁面未找到 | 未知 | 不可停用 |

### Caller 證據界線
- DB function definition／trigger inventory 能確認資料庫內部 caller。
- 前端 GitHub 搜尋能確認已提交並可搜尋的程式；不能涵蓋未提交本機檔、正式部署舊版、其他 repository 或外部服務。
- Function logs 無紀錄不能證明無 caller。
- Edge Function 的 verify_jwt=false 只描述平台 JWT 驗證設定，不能單獨證明其內部授權安全。
- 本階段沒有呼叫任何 Function endpoint，也沒有讀取客戶訂單 payload。

## 3. 需專案管理者人工確認的外部 Caller 清單

以下位置無法只靠 PostgreSQL metadata 或 GitHub 搜尋完整證明，正式切換前必須逐一確認：

### Supabase Dashboard
1. Edge Functions → Functions：確認每支 Function 的部署版本、verify_jwt、最近部署時間、Secrets 名稱（只確認存在與否，不複製值）。
2. Edge Functions → Logs：依 Function 名稱與時間範圍確認是否有外部呼叫；注意 logs 保留期及空結果限制。
3. Database → Webhooks：確認是否有對 orders、merch_orders、cooling_pickup_orders、radish_orders 設定 webhook。
4. Integrations／Cron／Scheduled jobs：確認 Dashboard 可見的排程、Database Webhooks、外部整合。
5. Storage → Policies／Buckets：確認 transfer-proofs、付款證明相關 bucket 是否存在、是否有客戶端上傳政策；本次不改設定。
6. Project Settings → API：確認 exposed schemas 與 Data API 暴露範圍。

### LINE Developers／Messaging API
1. LINE Developers Console → Messaging API：確認 webhook URL 指向哪個 Function。
2. LINE webhook events：確認是否有外部服務轉發出貨或付款事件。
3. LINE 官方帳號管理後台／管理員工具：確認是否有手動推播工具或第三方整合。
4. 不要將 Channel Secret、Access Token、簽章密鑰貼入對話或 GitHub。

### 第三方與外部自動化
1. GitHub Actions／其他 CI：搜尋是否使用 Supabase Function URL。
2. Vercel／Netlify／Cloudflare／自架主機：檢查 Environment Variables 與 server-side routes 中是否呼叫 Function。
3. Zapier／Make／n8n／Pipedream／自建 cron：確認 webhook URL 與排程工作。
4. 物流商後台或 API callback：確認是否呼叫 line-customer-notify 或其他 shipment endpoint。
5. 管理員手機捷徑、LINE Bot 管理工具、內部表單：確認是否有手動或自動通知入口。

### 管理員回報方式
只需回報「系統／頁面名稱、Function 名稱、用途、是否仍使用、最近使用日期」；不要提供 token、secret、客戶資料或完整 webhook URL。未知來源標記為「未確認」，不能當作「不存在」。

## 4. 本機純函式測試

新增：
- `app/tests/phase22-security.js`
- `app/tests/phase22-security.test.js`

測試內容：
1. merch 舊狀態 pending／unpaid 對應 unpaid。
2. 舊 paid 對應 confirmed，保留原始值供稽核。
3. 未知付款狀態標記 needsReview。
4. proof_submitted 不可直接跳過核款到 paid；需依狀態機允許 transition。
5. confirmed 可退款，但不可退回 unpaid。
6. shipment token 必須同時符合 hash match、order binding、未過期、未消耗、未撤銷。
7. shipment token 拒絕無效、錯單、過期、已消耗、撤銷。
8. shipment message 只使用 DB verified recipient／order fields，不接受 body 偽造。
9. 未綁定 LINE recipient 即使 body 提供 recipient 也拒絕。
10. event_id 必須足夠長且未被處理。

執行結果：
`node --test app/tests/phase22-security.test.js`

- 10 tests passed
- 0 failed
- 本機 Node.js 純函式／fixture 測試
- 未連 Supabase、未呼叫 LINE、未讀取真實訂單

**重要限制**：這些測試只驗證 helper 的預期行為，不驗證真正的 HMAC 密碼學實作、資料庫原子交易、Storage policy、Edge Function runtime、LINE API 或併發／重試整合。

## 5. 本階段結論

- 已確認周邊商品前台目前沒有付款證明上傳流程；後台付款證明欄位只有清除用途，尚無上傳與安全檢視流程。
- 已整理主要前端建單入口與通知 Function caller matrix。
- 三條已知 pg_net 通知 trigger caller 保留。
- 未知 Function 外部 caller 尚未由專案管理者完成 Dashboard／第三方控制台確認。
- 出貨 token lifecycle 及付款證明 upload patch 尚未套用。
- 本機 10／10 tests passed；未執行 DB／Edge Function 整合測試。

## 6. 下一階段 Phase 23

1. 根據 Phase 22 caller matrix，製作「正式切換前必須由管理者確認」逐項檢核表。
2. 產生付款狀態轉換與舊資料相容表，逐欄對照 merch_orders 目前狀態值；不讀取顧客資料。
3. 產生 token lifecycle SQL／RPC／Edge Function 的完整 patch diff 草案，僅提交 GitHub，不執行部署。
4. 產生 merch proof upload 的前後端 patch diff 草案，確保舊 checkout 不被覆蓋。
5. 將測試補強為 HMAC 真實 crypto fixtures、重播、過期、order binding 與冪等測試；仍只在本機執行。

本階段未做正式環境寫入、Function 部署、Secrets 修改、LINE 推播、Storage upload 或官網覆蓋。
