# Phase 24｜HMAC 真實測試、付款證明 fixtures 與 Caller 追查

日期：2026-11-08  
分支：app/phase-1-planning  
性質：本機 Node 測試＋正式環境唯讀檢視。無正式環境變更。

## 1. 本階段完成

- 新增 Node.js crypto HMAC-SHA256 測試 helper。
- 新增付款證明 capability／finalize 純函式 fixtures。
- 依目前正式 DB CHECK values 寫入周邊商品付款與出貨狀態測試。
- 重新檢查兩個周邊商品管理頁的實際功能差異。
- 只讀檢查正式 DB token 相關 function source，以及 line-customer-notify v5 source。
- 本機執行 15 個 Node tests：15 passed、0 failed。

## 2. HMAC 測試結果

測試檔案：
- `app/tests/phase24-crypto-and-proof.js`
- `app/tests/phase24-crypto-and-proof.test.js`

涵蓋：
1. canonical envelope 確定性序列化。
2. HMAC-SHA256 正確簽章可驗證。
3. token／order_id／path／HTTP method／event_id 被竄改時拒絕。
4. 簽章格式錯誤與錯誤 secret 拒絕。
5. timestamp 超過 5 分鐘容許偏差或格式錯誤時拒絕。
6. 過短 secret 拒絕。
7. 付款狀態轉換符合正式 DB CHECK。
8. 舊後台 paid／pending adapter；refunded 必須人工覆核。
9. 出貨狀態只允許正式 DB CHECK 值。
10. 付款證明 capability 訂單綁定、期限、消耗、MIME、大小檢查。
11. finalize 必須先確認 object 存在及 event_id 有效。
12. finalize 只能將 unpaid／rejected 轉成 proof_submitted，不可自動 confirmed。
13. 重複 event_id 的冪等 fixture。

執行命令：
```bash
node --test app/tests/phase24-crypto-and-proof.test.js
```

本次實際執行結果：15 tests、15 passed、0 failed。

**測試限制**：使用 Node 內建 crypto 對測試 fixture 做真實 HMAC 計算，但沒有連線正式 Supabase、沒有部署 Deno Edge Function、沒有測試正式 secret、沒有驗證 DB transaction／併發／Storage signed upload 或 LINE API。此 helper 是參考實作與單元測試，不代表正式 Function 已修補。

## 3. 兩個周邊商品後台實際入口差異

### merch-admin.html
- 讀取 `merch_orders` 與 `merch_order_items`。
- 直接更新 `payment_status`、`shipment_status`。
- UI 付款值使用 pending／paid／refunded。
- UI 出貨值使用 pending／processing／shipped／completed。
- 直接寫入 DB，沒有 canonical adapter。
- 商品圖片上傳至 `product-images`；不是付款證明。
- 個資刪除會將 `payment_proof_url` 設為 NULL；沒有同步刪除 Storage object 的證據。

### merch-admin-v2.html
- 讀取最近最多 200 筆 merch_orders，顯示付款與出貨狀態。
- 本頁目前呈現訂單查詢／商品管理功能，未發現付款／出貨狀態更新 UI。
- 商品圖片上傳使用 `merch-images`；不是付款證明。
- 未發現付款證明上傳／預覽流程。

**結論**：兩頁功能不等價。不能直接刪除或合併任一頁；仍需由管理者確認哪一頁是日常正式入口、哪些人正在使用。

## 4. 出貨 Token 發出端追查

### DB source
只讀搜尋正式資料庫 function source，包含 `shipment_notify_token` 的 function 只找到：
- `public.verify_shipment_notify_token(p_order_id uuid, p_token text)`
- SECURITY DEFINER。
- source 只檢查 `orders.id` 與明文 `shipment_notify_token` 相等並回傳 boolean。

未找到其他 DB function source 負責讀取、更新、輪替、消耗或撤銷此 token。

### Edge Function source
重新讀取 ACTIVE `line-customer-notify` v5：
- verify_jwt=false。
- 接收 body 的 order_id、notify_token、recipient、order_number、pickup_type、pickup_store。
- 使用 anon/publishable client 呼叫 `verify_shipment_notify_token`。
- 驗證通過後，recipient 與訊息中的訂單／門市資料仍來自 request body。
- 未看到 token consumed、expiry、event id、HMAC envelope 或 DB 取回 recipient 的流程。

### Token 產生來源
DB 欄位 `orders.shipment_notify_token` 的 default 會在新增 orders row 時產生 24-byte random value 的 hex 表示。這可證明 DB 有預設產生值，但本次沒有找到可信 caller 讀取／傳送該 token 到通知 Function 的程式證據。

GitHub code search 未回傳可用的 token caller 結果；此搜尋不能涵蓋所有 branch／正式部署版本／外部系統。因此「token 發送端」仍未確認。

**風險處理**：保留舊欄位、舊 Function 與 RPC；不改 grants、不停用、不部署新版。

## 5. 蘿蔔糕訂單建立路徑補充

`radish-order.html` 透過 `create_radish_delivery_order` RPC 建立訂單，傳入收件人、電話、地址／門市資訊、配送方式、備註與商品項目。它不是周邊商品 `merch_orders` 的直接 insert 路徑。未讀取客戶訂單資料，也未呼叫 RPC。

## 6. 本階段阻擋項目

| 項目 | 狀態 |
|---|---|
| HMAC helper 單元測試 | 完成，15/15 |
| 付款證明純函式 fixtures | 完成 |
| merch-admin.html／v2 差異 | 已檢視 |
| Token DB 驗證 function | 已檢視 |
| Token 發送端 caller | 未確認 |
| 管理者 Dashboard／外部自動化 caller | 待管理者回報 |
| 正式 DB 整合測試 | 未執行 |
| Storage／LINE／Deno runtime 整合測試 | 未執行 |
| 正式環境修補 | 未執行 |

## 7. 下一階段 Phase 25

1. 對照正式網站入口／管理員導覽，追查 merch-admin 與 merch-admin-v2 哪一頁被連結及部署使用。
2. 以不讀取客戶資料的方式，繼續追查 token default 值是否由任何可見 server endpoint／管理員頁讀取並傳給 line-customer-notify；若沒有證據，保留「未知 caller」。
3. 針對 DB canonical status 製作 merch-admin.html 前端修正 diff（只提交草案，不改線上頁）。
4. 設計隔離 Supabase 專案上的整合測試計畫；不得使用正式專案做測試寫入。
5. 整理逐檔 patch 與人工核准清單。未經明確核准不做正式環境變更。
