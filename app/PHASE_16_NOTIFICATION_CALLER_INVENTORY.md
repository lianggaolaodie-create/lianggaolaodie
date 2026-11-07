# Phase 16｜通知 Function、官網與資料庫 Caller Inventory

日期：2026-11-08  
分支：app/phase-1-planning  
範圍：Supabase Edge Function source／active 清單、Postgres trigger metadata／definition、GitHub branch 內主要結帳及管理頁唯讀檢查。

> 本階段只讀取程式與 metadata；未讀顧客資料列、未呼叫通知端點、未發送 LINE 訊息、未執行任何寫入或部署。本文不包含任何 secret 明文。

## 1. 執行摘要

本階段確認目前三條 DB trigger 通知鏈：
- `orders` INSERT → `orders_notify_line_after_insert` → `notify_line_on_new_order()` → `line-order-send-v2`。
- `orders` UPDATE（payment_status／transfer_last5／transfer_proof_path）→ `orders_notify_line_after_payment` → `notify_line_on_payment_proof()` → `line-order-payment-send-v2`。
- `cooling_pickup_orders` INSERT／UPDATE payment_last5 → `cooling_orders_notify_line_after_payment` → `notify_line_on_cooling_order_payment()` → `cooling-order-line-notify`。

GitHub 目前檢查的舊官網主要結帳頁，使用 Supabase RPC 建立訂單；未發現它們直接呼叫上述 LINE 通知 Functions。這表示通知入口主要由 DB trigger 驅動，但仍需檢查完整 branch、部署中的官網版本及外部自動化，不能把「在已檢查頁面未找到」解讀成所有 caller 已排除。

## 2. Function 現況矩陣

| Function | Active 版本／JWT | Source 檢查結果 | 已知 caller 狀態 | 風險／處理 |
|---|---|---|---|---|
| line-order-send-v2 | v13／verify_jwt=false | request body 接受 order_id；來源檢查未見 JWT／內部 secret／HMAC caller 驗證；service_role 取得訂單通知 payload 並推播 | 已確認由 orders INSERT trigger 呼叫 | P0；必須加入可信事件驗證及冪等 |
| line-order-payment-send-v2 | v5／false | 依訂單 ID 讀 payload；固定 header secret；付款證明提交可能被寫成已付款 | 已確認由 orders payment trigger 呼叫 | P0/P1；修正狀態語意、Secrets 及 event 去重 |
| cooling-order-line-notify | v4／false | 固定 header secret；使用 publishable key 取得 payload 的舊路徑；末五碼存在不等於付款完成 | 已確認由 cooling payment trigger 呼叫 | P0/P1；切換可信服務端 payload、修正文案 |
| line-order-notify | v5／false | 有自訂 header secret；以 service_role 查 orders、order_private、order_items 並推播 | 在目前 DB trigger 定義及已檢查官網頁未找到 caller | P1；疑似平行／舊版本，先查外部 caller，不可直接停用 |
| line-payment-order-notify | v2／false | service_role 呼叫 get_line_order_notification_payload；依 proof_submitted 與末五碼判斷通知 | 在目前 DB trigger 定義及已檢查官網頁未找到 caller | P1；使用公開 payload RPC；需確認是否舊 caller |
| line-payment-notify | v4／false | service_role 查 merch_orders／items；request order_id；檢查 proof_submitted；沒有可見 caller authentication | 未找到 DB trigger 或已檢查官網頁 caller | P1；付款通知入口可被未授權呼叫；訊息文案須與 proof_submitted 一致 |
| merch-payment-sync | v3／false | service_role 查 merch_orders／items 並推播；request order_id；無可見 caller authentication | 未找到已檢查官網頁 caller；可能與 line-payment-notify 重疊 | P1；兩支 Function 有功能重疊，先追查外部 caller |
| line-customer-notify | v5／false | 驗證 shipment notify token，但仍要求 body recipient，且使用 body pickup_type／其他顯示欄位組訊息 | 未找到 DB trigger 或已檢查官網頁 caller | P1；token 驗證後應由 DB 查收件人及通知內容 |
| line-webhook | v7／false | 自行驗證 LINE raw-body HMAC；處理手機／訂單綁定及管理員綁定指令 | LINE 平台 webhook | P0；管理員綁定目前未見管理員 allowlist／邀請驗證 |
| admin-manage | v1／verify_jwt=true | 以 Auth getUser 驗證 JWT，並檢查 enabled super_admin | 管理後台 | 初步正向；保留並補輸入驗證／audit log |
| line-order-test、line-order-test-2～7 | 各 v1／false | 目前 source 為簡單 OK／{ok:true} 回應 stub，未執行真實通知 | 未找到 caller | 暫不刪除／停用；仍須確認 URL 是否被外部依賴 |
| tiktok-live-proxy、tiktok-live-chat 等 | Active | 非本次 LINE 通知修補範圍 | 官網首頁 script 可見 TikTok proxy／chat URL | 不修改、不停用 |

## 3. 官網 caller inventory（已檢查頁面）

| 頁面 | 已確認呼叫 | 是否直接呼叫 LINE Function |
|---|---|---|
| convenience-order-v2.html | 讀取 daily_order_settings、pickup_settings、daily_order_regions、daily_order_flavors、flavors；RPC create_cooling_pickup_order | 未發現 |
| convenience-order.html | 舊版同樣使用 create_cooling_pickup_order | 未發現 |
| home-delivery-order.html | 讀取每日開單／地區／口味；RPC create_customer_order | 未發現 |
| radish-order.html | 讀取 site_admin_content；RPC create_radish_delivery_order | 未發現 |
| admin-orders-fixed-v3.html | 直接讀寫 cooling_pickup_orders、orders、order_private、order_items、order_customers、daily_order_* 等資料表 | 未發現直接呼叫 LINE Function |
| admin-radish-orders.html | 直接讀寫 radish_orders／radish_order_items；登入後檢查 admin_profiles | 未發現 |
| admin-customers.html | 直接讀寫冷藏寄放訂單與 order_customers | 未發現 |
| merch-admin.html、merch-admin-v2.html、merch-admin/index.html | 本次字串掃描未找到 line-payment-notify／merch-payment-sync endpoint 或 Function invoke | 未發現；不代表沒有其他外部 caller |
| index.html、script.js、online-order.html | 首頁導向線上訂購；首頁有 TikTok proxy/chat 呼叫 | 未發現 LINE 通知 endpoint |

### 官網相容性風險

- 舊官網付款／結帳頁直接以 RPC 建立訂單；若修補改動 RPC 參數或 ACL，必須保留舊版 caller adapter。
- admin-orders-fixed-v3.html 目前存在直接 UPDATE 訂單 status、DELETE 訂單／明細、修改個資及直接管理每日開單設定的流程。這些是後續管理後台權限收斂的重點，不可在沒有完整替代流程前直接撤權。
- radish-order.html 直接呼叫 create_radish_delivery_order；付款證明與核款流程仍需從完整頁面及資料庫 RPC 確認，不能只看通知 Function。
- 本階段未對官網 production URL 進行互動測試，也未確認 GitHub Pages 實際部署 commit 是否等於此 branch。

## 4. 資料庫 caller 核對

已唯讀確認以下 trigger：
- `orders_notify_line_after_insert`：AFTER INSERT ON public.orders。
- `orders_notify_line_after_payment`：AFTER UPDATE OF payment_status, transfer_last5, transfer_proof_path ON public.orders。
- `cooling_orders_notify_line_after_payment`：AFTER INSERT OR UPDATE OF payment_last5 ON public.cooling_pickup_orders。

其中 orders 新單 trigger 目前只傳 order_id，未帶可驗證的內部 caller proof；付款及冷藏寄放 trigger 有固定 header secret。密鑰明文不寫入本報告。

在已查詢的 trigger definitions 中，未見 line-order-notify、line-payment-order-notify、line-payment-notify、merch-payment-sync、line-customer-notify 及 line-order-test-* 的直接呼叫。仍需查其他 RPC、外部自動化、手動管理工具及歷史部署來源。

## 5. P0 新發現：LINE 管理員綁定缺乏身份授權

line-webhook 在 LINE HMAC 驗證後，對訊息「綁定管理員」執行 line_notification_settings upsert，將傳訊者的 LINE user ID 設為管理員通知收件者。已檢視的該分支程式路徑沒有看到：
- 既有管理員 LINE user ID allowlist；
- 由已登入 super_admin 發出的邀請；
- 一次性高熵邀請碼；
- 管理員核准流程。

LINE HMAC 只證明事件由 LINE 平台送達，不代表發訊息者具有公司管理員身份。若 DB 端也沒有額外限制，此路徑可讓任意 LINE 使用者搶先／覆蓋管理員通知收件者，列為 P0。

建議修補：
1. 移除任何人可直接以固定文字完成管理員綁定的流程。
2. 管理員初始設定只透過受控 Secrets／管理後台完成。
3. 後續變更採既有 super_admin 登入後產生一次性邀請碼，短效、限次、使用後作廢。
4. 記錄 actor、target、時間、event ID、變更前後值。
5. 增加測試：非 allowlisted LINE user、重播邀請碼、過期邀請碼及已使用邀請碼均拒絕。

本階段未修改此 Function。

## 6. P1 新確認：兩支周邊商品付款通知 Function 重疊

line-payment-notify 與 merch-payment-sync 均：
- 接受 request body 的 order_id；
- 使用 service_role 讀取 merch_orders 與 merch_order_items；
- 以 payment_status=proof_submitted 作為可通知條件；
- 查詢 line_notification_settings 並推播管理員 LINE；
- 更新 payment_notification_sent。

目前未找到官網管理頁直接呼叫任一端點，也未在已查詢 DB trigger 定義找到 caller。必須再追查：
- 周邊商品付款證明上傳後是否由資料庫 trigger、Storage webhook、排程或第三方自動化呼叫；
- 兩支是否同時存在不同版本／不同入口；
- payment_notification_sent 是否被兩支共用，是否存在競態及重複通知；
- Function 呼叫是否有外部排程或管理員手動觸發。

未確認前不可刪除、停用或合併其中任何一支。

## 7. line-order-test-* stub 盤點

line-order-test、line-order-test-2～7 目前 source 內容為簡單回應 stub，未見訂單查詢或 LINE push。這只代表目前部署 source 的內容，不代表其 URL 沒有被外部服務使用。建議先觀察 logs、查外部呼叫設定與建立日期；若無流量且 owner 確認無依賴，才提出退役計畫。此階段未停用任何 Function。

## 8. Phase 16 建議修補分組

### Batch A｜LINE webhook 管理員身份授權（最高優先）
- 修改 line-webhook 管理員綁定分支。
- 新增一次性邀請碼／super_admin 授權來源。
- 保留 LINE raw-body HMAC。
- 加 event 去重、rate limit 與 audit log。
- 不改一般客戶綁定流程，直到 OTP 方案完成相容設計。

### Batch B｜新訂單通知入口
- 修正 line-order-send-v2 caller authentication。
- 對應 notify_line_on_new_order trigger 改成簽章／可靠內部事件。
- payload RPC 改為可信內部服務專用。
- 新增 idempotency key 及失敗重試。

### Batch C｜付款通知狀態與密鑰
- line-order-payment-send-v2、cooling-order-line-notify、line-order-notify 逐一移除 source／trigger 明文 secret。
- proof_submitted 僅顯示待核款；confirmed 才顯示已付款。
- 先部署兼容 Function，再切換 trigger，最後限制舊 RPC。

### Batch D｜周邊商品付款通知去重
- 找出 line-payment-notify／merch-payment-sync 實際 caller。
- 決定唯一通知入口；其他端點需先確認流量及依賴再退役。
- 使用 DB 原子鎖／事件 ID 防止並發重複推播。

### Batch E｜顧客出貨通知
- 查明 line-customer-notify 的 token 產生、驗證、呼叫者及撤銷路徑。
- 後端依 token 讀取已綁定 LINE recipient、訂單、物流資料。
- request body 只接受短效 token 與必要識別碼。

## 9. 尚未完成的追查（不可誤報完成）

- 全部 RPC function body 是否呼叫上述 Functions／HTTP endpoints。
- pg_net request queue、cron jobs、Storage webhook、Database Webhook、第三方自動化是否呼叫周邊商品通知。
- line-customer-notify 的 shipment token mint／verify／revoke 完整流程。
- 所有 GitHub branch／Pages 實際部署版本是否與檢查分支一致。
- 外部服務、手機 App、管理員書籤／手動工具是否呼叫任何 verify_jwt=false Function。
- 各測試 Function 的實際請求 log 與外部依賴。
- 真實 HMAC 測試、LINE sandbox push、Supabase integration tests 均未執行。

## 10. 本階段狀態

| 項目 | 狀態 |
|---|---|
| 三條 DB trigger 通知鏈 | 已確認 |
| 主要舊官網結帳頁 RPC caller | 已確認一輪 |
| 官網直接呼叫 LINE Function | 在已檢查頁面未發現 |
| LINE 管理員綁定缺身份授權 | 已確認 source 路徑缺少明示驗證，列 P0 |
| 周邊商品兩支付款通知 Function 重疊 | 已確認 source 重疊；實際 caller 未知 |
| test Functions | 已確認目前是 stub；外部依賴未知 |
| 全部外部 caller inventory | 未完成 |
| 逐支最終可部署 patch diff | 未完成 |
| 正式環境變更 | 未執行，維持唯讀 |

### 下一階段
Phase 17：追查所有 RPC function definitions、pg_net／cron／webhook／Storage／外部呼叫紀錄，補齊 line-customer-notify token 生命週期及 merch payment caller；完成後才產生逐支可審核 patch diff。正式環境仍維持唯讀。
