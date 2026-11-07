# Phase 10 — Supabase Schema／RPC 與狀態機對照

日期：2026-11-08  
分支：app/phase-1-planning  
狀態：唯讀盤點與差異分析；未執行任何資料庫寫入。

## 1. 盤點邊界
本文件根據目前 Supabase schema metadata、欄位／constraint、資料庫產生的 TypeScript types、Edge Function 清單及先前官網唯讀程式碼審查整理。
- 只讀 schema metadata 與型別資訊；沒有執行 DDL、DML、migration、RLS／GRANT 變更。
- 沒有部署、停用或替換 Edge Functions。
- 沒有讀取或列出顧客個資、完整訂單內容或秘密值。
- Edge Function 清單只確認名稱、ACTIVE 狀態及 verify_jwt 設定，不代表重新完成每支原始碼安全審查。

## 2. 核心訂單表實際欄位

### 2.1 涼糕送到府：orders／order_items／order_private

| 資料表 | 目前重要欄位 | 狀態機對照 |
|---|---|---|
| orders | id、order_number、delivery_date、delivery_region、pickup_type、product_total、pickup_fee、total_amount、status、payment_status、transfer_last5、transfer_proof_path、customer_user_id、shipment_notify_token、payment_notification_sent、seven_eleven_tracking_code、seven_eleven_service_status | 有訂單與付款兩欄，但 status 混合履約／付款／寄放語意；未見獨立 fulfillment_status |
| order_items | flavor_id、flavor_name、unit_price、quantity、subtotal | 有名稱、單價、數量、小計快照；仍需確認所有寫入路徑是否由 DB 可信資料建立 |
| order_private | customer_name、customer_phone、customer_note、pickup_store、delivery_address | 敏感資料分表；舊送到府流程曾將地址放入 pickup_store 參數，需相容映射 |

orders.status 目前 CHECK：
pending、confirmed、preparing、shipped、completed、cancelled、paid、stored、delivering、delivered。

orders.payment_status 目前 CHECK：
unpaid、proof_submitted、confirmed、rejected、cod。

**差異**
1. status 同時包含 paid（付款）、stored（寄放）、delivering（物流）、completed（訂單完成），無法乾淨表達三套獨立狀態機。
2. payment_status 的 confirmed 代表付款已確認，但未涵蓋退款、部分退款、退款失敗、COD 代收／回款。
3. 未見通用物流狀態、物流商、物流單號及完整事件時間欄位；現有 7-ELEVEN 欄位偏單一物流商。
4. order_items 有商品快照欄位，但仍需確認價格與品名由資料庫重查產生。
5. 地址欄位映射需保留舊官網相容，不可直接重命名或改寫歷史資料。

### 2.2 涼糕超商冷藏寄放：cooling_pickup_orders／items

| 資料表 | 目前重要欄位 | 狀態機對照 |
|---|---|---|
| cooling_pickup_orders | order_number、order_date、customer_id、region_name、convenience_store、store_name、store_address、merchandise_total、storage_fee、total_amount、payment_last5、status、notes | 單一 status 混合待匯款、已付款、製作、出貨、寄放、取貨、完成、取消 |
| cooling_pickup_order_items | flavor_name、unit_price、quantity、line_total、product_name、flavor_id | 有商品快照欄位；須由可信 DB 主檔查價與重建快照 |

status 現有值：待確認匯款、已付款、製作中、已出貨、已寄放、已取貨、已完成、已取消。

**差異**
1. 單一 status 混合付款、製作、物流與取貨。
2. storage_fee 欄位存在，但建單時須由後端讀 pickup_settings 核對，不可信任前端傳值。
3. 有門市名稱與地址，但需確認縣市、門市代碼、取件期限及逾期處理是否結構化。
4. 主表／明細未見通用狀態事件稽核欄位；需確認是否有獨立 log table 或 trigger。
5. RLS 已啟用；先前盤點發現主表／明細公開 INSERT 權限或政策疑慮。未完成相容與安全測試前不可直接收緊正式權限。

### 2.3 蘿蔔糕：radish_orders／radish_order_items

| 資料表 | 目前重要欄位 | 狀態機對照 |
|---|---|---|
| radish_orders | order_number、customer_name、customer_phone、delivery_address、customer_note、total_amount、status、payment_method、shipping_fee、shipping_method、pickup_store | 單一 status、付款方式文字、物流方式與費用；未見獨立 payment_status、fulfillment_status、付款證明及通用追蹤號 |
| radish_order_items | product_id、product_name、unit_price、quantity、subtotal | 有商品明細快照 |

status 現有值：pending、confirmed、preparing、shipped、delivered、completed、cancelled。

**差異**
1. 單一 status 無法獨立記錄付款核實與物流異常。
2. payment_method 是付款方式，不是付款狀態。
3. 有 shipping_method、shipping_fee、pickup_store，未見通用 carrier、tracking_number、shipment_events、COD collection status。
4. product_id 是 text，沒有明確外鍵連產品主檔；需確認 site_admin_content.radish_products JSON 的穩定 ID 與快照策略。
5. 建單 RPC 有 5 參數與 6 參數 overload，需先保留舊官網相容，不可直接移除。

## 3. 商品、設定及行程主檔

| 資料表 | 實際欄位／觀察 | 整合影響 |
|---|---|---|
| flavors | id、name、description、price、image_url、enabled、product_name、flavor_type | 口味主檔；flavor_type 為 single／filled／mixed，商品類型不可只靠名稱推斷 |
| daily_order_settings | order_date、ordering_enabled、notes | 每日開單控制存在；建單時需後端再次驗證 |
| daily_order_regions | order_date、region_name、enabled | 有日期／地區開放設定；詳細地址服務範圍尚未證明 |
| daily_order_flavors | order_date、flavor_name、price、enabled、quantity、flavor_id、product_name | 有當日價格／數量欄位；需驗證扣庫存交易與超賣防護 |
| pickup_settings | familymart_enabled／fee、seven_eleven_enabled／fee | 有寄放費設定；不是最新物流合約報價的證明 |
| payment_settings | enabled、bank_name、branch_name、account_number、account_name | 欄位存在；先前唯讀資料為 enabled=false、銀行欄位 null，不可視為已啟用收款 |
| food_truck_schedules | schedule_date、title、region、start_time、end_time、note、enabled、schedule_type | 可區分 food_truck／stall；未見 address／latitude／longitude |
| food_truck_schedule_flavors | schedule_id、flavor_id、price_per_box、price、unit_price | 三個價格欄位並存，需決定唯一權威欄位 |
| admin_profiles | user_id、role、enabled、can_manage_food_truck_schedule、can_manage_food_truck、food_truck_schedule_admin、food_truck_schedule_enabled、can_manage_products | 角色與功能旗標並存，需定義唯一權限矩陣並在 RPC／RLS 強制 |
| site_admin_content | section_id、data jsonb、updated_at | 蘿蔔糕商品／開單設定由 JSON section 管理，需規範 JSON schema |

### 3.1 目前 schema 未直接滿足的目標
- 餐車地圖：schedule 未見地址／座標欄位。
- 會員資料：orders.customer_user_id 是訂單歸屬，不等於完整會員 profile；order_customers 是訂單聯絡資料，不是會員主檔。
- 退款：核心訂單表未見完整退款交易與部分退款紀錄模型。
- 物流追蹤：特定 7-ELEVEN 欄位不足以通用支援四種物流流程。
- 狀態稽核：上述主表未見完整狀態事件表；仍需確認是否存在其他稽核表或 trigger。
- 冪等：目前已知主訂單表未見 idempotency key 欄位；仍需確認是否由 RPC 或其他表實作。

## 4. 目前可確認 RPC 簽名

下列參數摘要來自目前資料庫產生型別；不代表重新驗證函式內部實作或 EXECUTE 權限。

| RPC | 參數摘要 | 用途 | 缺口／注意事項 |
|---|---|---|---|
| create_customer_order | p_customer_name、p_customer_phone、p_delivery_date、p_delivery_region、p_pickup_store、p_pickup_type、p_customer_note?、p_items? | 涼糕送到府建單 | 地址映射、運費、服務區需明確化；價格與庫存由 DB 驗證 |
| create_cooling_pickup_order | p_convenience_store、p_items、p_merchandise_total、p_name、p_notes、p_order_date、p_payment_last5、p_phone、p_region_name、p_storage_fee、p_store_address、p_store_name、p_total_amount | 涼糕冷藏寄放 | 前端 fee／total 不可作權威；DB 需讀設定、查價、重建快照 |
| create_radish_delivery_order（5 參數） | p_customer_name、p_customer_note、p_customer_phone、p_delivery_address、p_items | 蘿蔔糕舊版建單 | 保留舊官網相容直到切換驗收 |
| create_radish_delivery_order（6 參數） | 上述參數＋p_shipping_method? | 蘿蔔糕新版物流 | 後端需驗證開單、物流方式與最新運費 |
| submit_customer_payment | p_order_id、p_transfer_last5?、p_transfer_proof_path? | 顧客提交付款資訊 | 只代表提交證明，不等於 paid |
| admin_confirm_payment | p_order_id | 管理端核款 | 需角色、金額、證明、重複交易驗證及稽核 |
| admin_update_order_status | p_order_id、p_status | 管理端更新涼糕狀態 | 需依允許轉換白名單限制 |
| admin_generate_seven_eleven_label | p_order_id | 產生 7-ELEVEN 標籤 | 檢查訂單類型、門市資料及重複標籤 |
| get_line_order_notification_payload | p_order_id | LINE 訂單 payload | P0：先前確認 anon／authenticated 可執行且回傳敏感資料；修正前不可供新 App 呼叫 |
| get_cooling_order_line_notification_payload | p_order_id | 冷藏寄放 LINE payload | P0：同類個資風險；修正前不可供新 App 呼叫 |
| mark_line_payment_notification_sent | p_order_id | 更新付款通知旗標 | P0：先前確認缺少明確 caller authorization；通知旗標不等於付款狀態 |
| get_my_admin_profile／get_current_admin_profile／is_admin／is_order_admin／is_personal_data_admin | 無參數或 required_role | 管理員身份與角色判斷 | 需核對所有管理 RPC／RLS 是否一致使用可信角色來源 |

## 5. Edge Functions 清單（只確認目前 ACTIVE 與 verify_jwt）

verify_jwt=false 不必然是漏洞；仍須檢查函式內是否驗證簽章、token、caller、payload、速率與冪等。

| Function | verify_jwt | 整合注意 |
|---|---:|---|
| line-webhook | false | 保留 HMAC 簽章驗證及事件去重 |
| line-payment-notify | false | 通知不可反向標記付款 |
| line-customer-notify | false | payload 必須由可信後端取得 |
| merch-payment-sync | false | 是否納入 App 核心待確認 |
| admin-manage | true | 維持 JWT 與 admin role 驗證 |
| line-order-notify | false | 不可暴露敏感 payload |
| line-payment-order-notify | false | 與付款狀態分離 |
| line-order-test、line-order-test-2 至 line-order-test-7 | false | 測試用途待確認依賴，不可未盤點就停用 |
| line-order-payment-send-v2 | false | caller 驗證與 Secrets 安全 |
| line-order-send-v2 | false | caller 驗證與 Secrets 安全 |
| cooling-order-line-notify | false | 安全 payload 與 caller 驗證 |
| tiktok-live-proxy | false | 非本階段 App 核心，不可擅自停用 |
| tiktok-live-room-test | false | 依賴待確認 |
| tiktok-live-chat | false | 非本階段核心 |

## 6. 相容整合策略（不直接改正式資料）

不要直接把舊 status 改名或改寫歷史資料。官網、管理後台、LINE 通知可能依賴舊值。

建議分階段：
1. 定義舊狀態映射表，保留原始值。
2. 新服務層建立標準化讀取模型，例如 order_state、payment_state、fulfillment_state，由 adapter 將舊欄位映射為統一語意。
3. 新建單與狀態變更經受控 API／RPC，舊官網讀取先維持相容。
4. 官網與 App 雙向回歸測試通過後，再評估新增正式欄位或事件表。
5. 任何 schema 變更先提供 migration 草案、備份、rollback 計畫，取得該項正式變更明確核准。

### 6.1 舊狀態初步映射（待業務確認）

| 現有資料 | 舊值 | 標準化呈現 | 注意 |
|---|---|---|---|
| orders.status | pending | placed／待確認 | 結合 payment_status |
| orders.status | confirmed | accepted／已確認 | 需確認舊官網語意 |
| orders.status | preparing | preparing／製作中 | 訂單履約 |
| orders.status | shipped | shipped／已出貨 | 物流 |
| orders.status | delivering | in_transit／配送中 | 物流 |
| orders.status | stored | arrived／已寄放 | 只適用冷藏寄放 |
| orders.status | delivered | delivered／已送達 | 是否代表實際領取待確認 |
| orders.status | completed | fulfilled／已完成 | 不代表付款必定成功 |
| orders.status | paid | 不應作訂單狀態 | 付款看 payment_status |
| orders.status | cancelled | cancelled／已取消 | 同時檢查付款與物流 |
| orders.payment_status | unpaid | pending／待付款 | — |
| orders.payment_status | proof_submitted | proof_submitted／已提交證明 | 不等於 paid |
| orders.payment_status | confirmed | paid／已核實 | 需確為入帳 |
| orders.payment_status | rejected | rejected／待補件 | — |
| orders.payment_status | cod | not_required＋COD pending | COD 收款另追蹤 |
| cooling_pickup_orders.status | 待確認匯款 | order accepted + payment pending | 一個舊值混合兩種語意 |
| cooling_pickup_orders.status | 已付款 | payment paid + order accepted | 需確認確有核款 |
| cooling_pickup_orders.status | 製作中 | order preparing | — |
| cooling_pickup_orders.status | 已出貨 | fulfillment shipped | — |
| cooling_pickup_orders.status | 已寄放 | fulfillment arrived | 不等於顧客已取貨 |
| cooling_pickup_orders.status | 已取貨／已完成 | fulfillment delivered／order fulfilled | 需確認歷史差異 |
| cooling_pickup_orders.status | 已取消 | order cancelled | 同時檢查退款 |
| radish_orders.status | pending／confirmed／preparing | placed／accepted／preparing | 結合付款資料 |
| radish_orders.status | shipped／delivered | fulfillment shipped／delivered | 交付證據待確認 |
| radish_orders.status | completed | order fulfilled | 付款仍需獨立核對 |
| radish_orders.status | cancelled | order cancelled | 同時檢查退款與物流 |

## 7. 優先差異

### P0 — 上線前安全阻擋
1. LINE payload RPC 個資讀取權限。
2. 付款通知旗標 RPC 呼叫者授權。
3. service_role Edge Functions caller 驗證與敏感資料來源。
4. Secrets 硬編碼與輪替計畫。
5. cooling pickup RPC 後端費率／明細快照驗證。
6. radish RPC 開單開關與運費後端驗證。

### P1 — 狀態機一致性
1. 三種訂單表的訂單／付款／物流狀態分離映射。
2. 狀態事件稽核、冪等及 webhook 去重。
3. 退款紀錄、COD 收款狀態與物流追蹤資料模型。
4. 訪客訂單驗證及會員本人明細安全查詢。
5. 管理角色矩陣與每個 RPC 授權一致性。

### P2 — App／官網整合
1. schedule address／coordinates 欄位方案。
2. food_truck_schedule_flavors 價格欄位唯一權威規則。
3. 蘿蔔糕商品 JSON schema／版本管理。
4. 共用 API adapter 與官網相容層。
5. 商品、活動、會員、報表服務契約。

## 8. 免費靜態驗證案例
不建立付費 Supabase branch、不連線執行正式寫入。先用純函式與 fixture 測試：
- 每個舊 status 都有明確 mapping 或標記 unknown。
- orders.status=paid 不映射成付款成功，須以 payment_status 判斷。
- 冷藏寄放「已寄放」不映射成顧客已取貨。
- radish_orders.payment_method 不可當 payment_status。
- 不允許 cancelled → preparing、fulfilled → preparing。
- proof_submitted 不可直接轉 paid，除非有可信核款事件。
- 未交寄不可直接轉 delivered。
- 重複事件 ID 只處理一次。
- 未知狀態保留原值並標記 exception，不可靜默當 completed。

Fixture 測試只能驗證程式映射邏輯，不能證明正式 Supabase RLS、RPC transaction 或 Edge Function 整合安全。

## 9. 本階段交付狀態
- [x] 唯讀取得核心資料表欄位、主鍵、外鍵及 RLS enabled metadata。
- [x] 確認三種訂單模型的實際 status CHECK 值。
- [x] 取得目前資料庫產生的 RPC TypeScript signatures。
- [x] 確認目前 ACTIVE Edge Function 清單及 verify_jwt 設定。
- [x] 列出舊欄位與新狀態機的主要差異。
- [x] 設計舊官網相容 adapter 的分階段策略。
- [ ] 逐條核對 RLS policy／table grants。
- [ ] 全部 RPC 核對 SECURITY DEFINER、search_path、EXECUTE grants 與函式內容。
- [ ] 實作純函式狀態映射及 fixture tests。
- [ ] 執行免費靜態測試並記錄輸出。
- [ ] 正式 schema／RLS／RPC／Edge Function 變更（未開始，須另行明確核准）。

**安全聲明：**本次只讀盤點，不代表正式環境已修補或可安全上線。正式 Supabase、Edge Functions、Secrets 與官網均未修改。
