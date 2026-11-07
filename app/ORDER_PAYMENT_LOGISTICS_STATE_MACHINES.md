# 老爹．涼糕｜訂單、付款、物流狀態機與轉換規則

版本：1.0  
日期：2026-11-08  
Git 分支：app/phase-1-planning  
狀態：規格草案；未連接正式服務、未修改正式資料庫。

> 本文件定義未來 App、官網與老闆後台共用的狀態語意。它不是已部署的程式或資料庫約束。所有金額、庫存、付款及狀態轉換必須由可信後端驗證，前端只能呈現結果。

## 1. 核心原則
1. 訂單、付款、物流是三個獨立狀態機，不可用單一「訂單狀態」混合表示。
2. 顧客送出訂單不代表已付款；LINE 通知送出成功也不代表已付款。
3. 商品售價、折扣、運費、寄放費、庫存與商品明細以伺服器驗證後的訂單快照為準。
4. 每次狀態變更須記錄操作者／來源、時間、原狀態、新狀態、原因及關聯事件 ID。
5. 重要操作必須冪等；重複點擊、網路重送或 webhook 重播不可重複扣庫存、重複收款或重複出貨。
6. 取消、退款、退件不得刪除原始訂單與歷史明細。
7. 顧客端只可讀取本人資料；訪客訂單需短效驗證，不得只憑訂單編號讀取個資。
8. 不同商品物流路徑分開驗證：涼糕送到府、涼糕超商冷藏寄放（不得稱冷藏宅配）、蘿蔔糕冷凍店到店、蘿蔔糕冷凍宅配。
9. 員工／PDA／現場揀貨及核銷本階段暫緩，不納入角色或狀態轉換。

## 2. 三套狀態機總覽

| 子系統 | 狀態欄位建議 | 狀態更新責任 |
|---|---|---|
| 訂單 | order_status | 訂單服務；管理員有限操作 |
| 付款 | payment_status | 金流可信 webhook 或付款核對權限管理員 |
| 物流 | fulfillment_status | 物流服務或授權管理員 |

訂單可以是「已成立／處理中」，付款是「待付款」，物流則是「尚未建立」。不可因訂單成立就直接標記付款完成或物流已出貨。

## 3. 訂單狀態機

### 3.1 狀態定義
| 狀態 | 意義 | 顧客可見文案 |
|---|---|---|
| draft | 尚未提交的購物車／草稿，不是正式訂單 | 尚未送出 |
| placed | 伺服器驗證成功並建立訂單 | 訂單已成立 |
| accepted | 訂單通過必要檢查，等待履約 | 訂單處理中 |
| preparing | 訂單進入備貨／製作階段 | 準備中 |
| fulfilled | 商品已完成交付／取貨 | 已完成 |
| cancellation_requested | 顧客提出取消，等待審核 | 取消申請處理中 |
| cancelled | 訂單已取消 | 已取消 |
| rejected | 因無法履約而拒絕成立後訂單，須保留原因 | 訂單無法受理 |
| exception | 需要人工處理的異常，不可自動視為完成 | 訂單處理異常 |

### 3.2 允許轉換
| 目前 | 可轉至 | 執行者／條件 |
|---|---|---|
| draft | placed | 顧客提交；後端重新驗證商品、價格、庫存、開單、配送、收件資料 |
| placed | accepted | 訂單服務確認訂單資料完整、未重複 |
| placed | rejected | 後端判定無法履約；需記錄原因 |
| accepted | preparing | 訂單管理權限；依商品類型及營運規則 |
| accepted | cancellation_requested | 顧客在允許時間內提出 |
| preparing | cancellation_requested | 符合取消政策時提出，需人工審核 |
| cancellation_requested | cancelled | 授權管理員審核完成；同步檢查付款與庫存補回 |
| cancellation_requested | accepted / preparing | 管理員拒絕取消並記錄原因 |
| preparing | fulfilled | 確認已交付／取貨，並核對相應物流或取貨證據 |
| accepted / preparing | exception | 系統或管理員發現資料、製作、配送異常 |
| exception | accepted / preparing / cancelled | 管理員依查核結果決定並留存理由 |

### 3.3 禁止轉換
- fulfilled 不可直接回到 preparing；若發生退貨／退款，應建立退貨／退款流程，不抹除已完成歷史。
- cancelled 不可重新啟用原訂單；顧客需重新下單。
- 顧客端不得直接寫入 order_status。
- 付款狀態不得自動覆蓋訂單狀態。
- 通知送出、管理員打開訂單頁，不構成狀態轉換。

## 4. 付款狀態機

### 4.1 狀態定義
| 狀態 | 意義 |
|---|---|
| not_required | 經核准的付款方式不需預付，例如符合條件的貨到付款 |
| pending | 已建立訂單，尚未收到可核實付款 |
| proof_submitted | 顧客已提交付款證明，尚未核實 |
| reviewing | 具付款核對權限的人員正在核對 |
| paid | 可信金流 webhook 或授權管理員已確認入帳 |
| rejected | 付款證明資料不足／不符，等待顧客補件 |
| failed | 金流交易失敗或逾時 |
| refund_pending | 已核准退款並等待執行 |
| partially_refunded | 部分退款已成功 |
| refunded | 全額退款已成功 |
| refund_failed | 退款執行失敗，需人工處理 |

### 4.2 允許轉換
| 目前 | 可轉至 | 執行者／條件 |
|---|---|---|
| pending | proof_submitted | 顧客上傳證明；檔案驗證、訂單綁定成功 |
| pending | paid | 可信金流 webhook 或授權管理員核實入帳 |
| pending | failed | 可信金流回報失敗／逾時規則成立 |
| proof_submitted | reviewing | 付款核對流程接手 |
| reviewing | paid | 管理員核對銀行入帳成功 |
| reviewing | rejected | 證明不清、金額不符或交易無法辨識 |
| rejected | proof_submitted | 顧客重新提交合格證明 |
| rejected | reviewing | 顧客補件後重新進入核對 |
| paid | refund_pending | 管理員依政策核准退款 |
| refund_pending | partially_refunded | 部分退款已由可信服務確認 |
| refund_pending | refunded | 全額退款已由可信服務確認 |
| refund_pending | refund_failed | 退款執行失敗 |
| refund_failed | refund_pending | 修正問題後重新送退款，須使用新冪等鍵 |
| not_required | not_required | 保持狀態；若改付款方式需新付款紀錄，不可偽造 paid |

### 4.3 付款安全規則
- 「已上傳匯款截圖」只代表 proof_submitted，不等於 paid。
- 前端不可呼叫任意 RPC 把付款旗標設為 true。
- 付款通知旗標 RPC 不得被當作付款狀態。
- LINE 通知、簡訊或 Email 發送成功不得變更 payment_status。
- 付款證明採私有儲存；限制 MIME、大小、路徑、覆寫、訂單關聯及讀取角色。
- 管理員核款必須驗證角色、訂單金額、付款帳戶資訊（若有）、交易日期及重複交易。
- 金流 webhook 驗證簽章、事件唯一性、金額、幣別、商店／訂單識別與交易狀態。
- 部分退款必須有退款金額、原因、操作者及交易 ID；累計退款不得超過已收款金額。
- 貨到付款須分開記錄「付款方式」與「物流代收款狀態」。出貨不代表已收款。

## 5. 物流／履約狀態機

### 5.1 通用狀態
| 狀態 | 意義 |
|---|---|
| not_created | 尚未建立物流資料 |
| pending | 等待備貨或安排物流 |
| ready | 資料完整，可交付物流 |
| shipped | 已交寄／已交給配送端 |
| in_transit | 配送中 |
| arrived | 已到達指定門市／配送站 |
| delivered | 已完成交付／顧客取貨 |
| delivery_failed | 配送失敗 |
| returned | 已退回寄件端 |
| cancelled | 物流單已取消 |
| exception | 物流異常，需人工處理 |

### 5.2 允許轉換
| 目前 | 可轉至 | 執行者／條件 |
|---|---|---|
| not_created | pending | 訂單接受且需物流 |
| pending | ready | 收件／門市、物流類型、運費及包裝資料驗證完成 |
| ready | shipped | 取得託運單號或物流交寄確認 |
| shipped | in_transit | 物流商狀態或可信管理員更新 |
| shipped / in_transit | arrived | 物流商回報抵達指定門市／站點 |
| in_transit / arrived | delivered | 物流商回報簽收或門市取件完成 |
| shipped / in_transit / arrived | delivery_failed | 物流商回報配送失敗 |
| delivery_failed | in_transit / returned / exception | 重新配送、退回或人工處理 |
| returned | exception | 退回後待確認重寄、退款或其他處置 |
| pending / ready | cancelled | 訂單取消且物流單尚未交寄，完成物流取消確認 |
| 任一未結案狀態 | exception | 物流資料不一致、遺失、破損或 API 異常 |

### 5.3 各物流類型特別規則

**涼糕送到府**
- 需驗證服務地區、完整地址及可配送日期／時段。
- 舊流程曾將地址資料放在 pickup_store 欄位；正式整合前需確認並規劃相容資料映射，不能假設欄位語意正確。
- 運費現況曾盤點為 0，但不能推定未來永遠免運；需由正式設定決定並保存快照。

**涼糕超商冷藏寄放**
- 顧客選擇的是冷藏寄放服務，不是冷藏宅配。
- 需驗證縣市、門市名稱、門市代碼（若可取得）、收件人電話及領取規則。
- 寄放費從 pickup_settings 等可信設定讀取；不能信任前端傳入金額。
- 必須保存下單當時寄放費快照。
- 門市到貨、通知成功、顧客實際領取是不同事件；不能將通知送出當作 delivered。
- 超時未取、退回或逾期處理需由營運政策明確定義。

**蘿蔔糕冷凍店到店**
- 物流商、支援門市、冷凍規格及正式合約費率需確認。
- 舊程式曾出現 7-ELEVEN 129、全家 99、宅配 250 等硬編碼值；這些不是已核實的現行合約費率，不得直接沿用。
- 需記錄冷凍溫層、包裝要求、物流商、門市與託運單號。

**蘿蔔糕冷凍宅配**
- 需驗證配送地址、配送範圍、收件時間及冷凍溫層。
- 運費以經老闆確認的正式物流設定為準。
- 不可套用涼糕最低訂購量規則。

## 6. 訂單、付款、物流三者關聯規則

| 情境 | 訂單 | 付款 | 物流 |
|---|---|---|---|
| 訪客送出轉帳訂單 | placed | pending | not_created |
| 顧客上傳匯款證明 | placed / accepted | proof_submitted | not_created / pending |
| 管理員核實入帳 | accepted | paid | pending |
| 物流已交寄 | preparing | paid 或符合 COD 規則 | shipped |
| 配送完成 | fulfilled | paid 或 COD 已收款狀態 | delivered |
| 顧客取消且未付款、未交寄 | cancelled | pending / not_required | cancelled / not_created |
| 已付款後核准取消 | cancelled | refund_pending | cancelled / not_created |
| 已付款退款成功 | cancelled 或依退貨政策 | refunded | 依實際物流狀態保留 |
| 貨到付款已出貨未收款 | preparing | not_required（付款方式）＋ COD collection pending（收款子狀態） | shipped |
| 貨到付款完成收款 | fulfilled | COD collection paid | delivered |

COD 建議另設 collection_status（not_applicable / pending / collected / remitted / exception），不要把「免預付」誤認成「已收款」。

## 7. 角色與權限矩陣（初稿）

| 操作 | 顧客本人 | 訪客 | 訂單管理員 | 付款核對管理員 | 個資管理員 | 系統服務 |
|---|---:|---:|---:|---:|---:|---:|
| 建立訂單 | ✓ | ✓ | — | — | — | 驗證 |
| 查詢本人訂單 | ✓ | 驗證後 | ✓ | 限必要欄位 | 依權限 | — |
| 修改商品／價格 | — | — | ✓ | — | — | 最終驗證 |
| 更新訂單履約狀態 | — | — | ✓ | — | — | 受限轉換 |
| 核實付款 | — | — | — | ✓ | — | 驗證 webhook |
| 發起退款核准 | — | — | 依授權 | 依授權 | — | 執行／回報 |
| 讀取完整個資 | 本人必要欄位 | 驗證後必要欄位 | 最小必要 | 最小必要 | 依核准 | 受控 |
| 更新物流 | — | — | ✓ | — | — | 物流 webhook |
| 發送通知 | — | — | 受限觸發 | 受限觸發 | — | 組合安全 payload |

此表為建議權限模型，必須與實際 admin_profiles 角色及資料庫 RLS／RPC 一一核對後才能實作。不得只在前端隱藏按鈕。

## 8. 每次狀態轉換必備稽核欄位
- event_id：唯一事件 ID。
- entity_type、entity_id：訂單／付款／物流主體。
- from_status、to_status。
- actor_type、actor_id：customer、guest、admin、system、provider。
- reason_code、reason_note。
- created_at：伺服器時間。
- idempotency_key：避免重複操作。
- correlation_id：關聯訂單、付款及物流事件。
- provider_event_id：外部 webhook 去重。
- 不記錄完整卡號、密碼、token、完整付款憑證內容或不必要個資。

## 9. 通知觸發規則
| 事件 | 通知對象 | 條件 |
|---|---|---|
| order.placed | 顧客／管理端 | 訂單成功建立 |
| payment.proof_submitted | 管理端 | 證明檔案通過上傳驗證 |
| payment.paid | 顧客／管理端 | 已由可信來源核實 |
| payment.rejected | 顧客 | 附補件原因，不洩露內部資訊 |
| fulfillment.shipped | 顧客 | 有有效物流資料 |
| fulfillment.arrived | 顧客 | 物流端確認到店／站點 |
| fulfillment.delivered | 顧客 | 有可信交付證據 |
| order.cancelled | 顧客／管理端 | 取消已正式完成 |
| refund.refunded | 顧客／管理端 | 退款成功確認 |

通知應由狀態事件觸發，而非由前端自行宣稱成功。通知失敗只更新通知任務狀態，不回滾已確認的訂單／付款／物流事實。通知任務需可重試且冪等。

## 10. 取消、退款、庫存與例外處理
- 取消前先檢查製作／出貨進度、付款狀態、物流是否已交寄。
- 未付款取消：依政策釋放保留庫存；已實際扣庫存者須透過受控交易補回。
- 已付款取消：訂單可先進入取消流程，付款另進 refund_pending；退款完成才標 refunded。
- 已交寄後不可假裝物流單已取消；需走攔截、退回或退貨流程。
- 退款失敗不得將訂單標示為已退款。
- 庫存扣減與訂單建立應在同一個資料庫交易或具等效一致性機制中完成。
- 重複 webhook、重複按鈕及併發下單要使用唯一鍵／冪等機制。
- 異常事件需有人工處理佇列、負責角色及結案原因。

## 11. 免費靜態／Mock 驗收案例

| ID | 測試情境 | 預期結果 |
|---|---|---|
| ORD-01 | 關閉開單時提交訂單 | 拒絕建單，不扣庫存 |
| ORD-02 | 商品價格在購物車後被修改 | 後端重新計價，前端金額不可覆蓋 |
| ORD-03 | 庫存不足 | 拒絕或依規則部分處理，不產生超賣 |
| ORD-04 | 相同 idempotency key 重送 | 回傳同一訂單結果，不重複建單 |
| PAY-01 | 上傳付款證明 | 狀態為 proof_submitted，不是 paid |
| PAY-02 | 未授權會員呼叫核款 | 拒絕並記錄安全事件 |
| PAY-03 | 重複 webhook event ID | 只處理一次 |
| PAY-04 | 退款金額超過實收 | 拒絕退款 |
| LOG-01 | 前端自行傳入較低運費 | 後端依正式設定重新計算 |
| LOG-02 | 冷藏寄放使用者選擇宅配地址流程 | 顯示正確寄放語意並要求門市資訊 |
| LOG-03 | 物流尚未交寄就收到 delivered | 拒絕不合理狀態跳轉或轉 exception |
| LOG-04 | 物流通知失敗 | 不回滾物流狀態，可安全重試通知 |
| SEC-01 | 只憑訂單號查訪客訂單 | 不回傳個資 |
| SEC-02 | 一般會員讀取他人訂單 | 拒絕 |
| AUD-01 | 管理員核款／取消／退款 | 必須有操作者、時間、理由及狀態歷程 |

以上僅為測試規格，未宣稱已執行或通過。當前免費測試可先用純函式、固定 fixture、靜態檢查及 mock 驗證狀態轉換；無法取代真實 Supabase RLS、RPC 交易與 webhook 整合測試。

## 12. 正式實作前待確認事項
1. 涼糕送到府的實際服務地區、運費、時段及取消期限。
2. 冷藏寄放的目前合作門市規則、實際寄放費、超時未取及退回政策。
3. 蘿蔔糕冷凍店到店／宅配目前簽約物流商、費率、溫層與包裝規格。
4. 付款方式、正式銀行資料、核款角色與退款核准門檻。
5. COD 適用物流、代收款回款與對帳方式。
6. 各商品開始製作／備貨後是否允許取消。
7. orders、cooling_pickup_orders、radish_orders 目前資料表與 RPC 能否承載上述獨立狀態；若不足，先提出相容方案，不直接修改正式 schema。

## 13. 本文件驗收狀態
- [x] 訂單、付款、物流狀態語意初稿。
- [x] 允許與禁止轉換初稿。
- [x] 顧客、管理員及系統服務權限初稿。
- [x] 物流類型差異與通知觸發規則。
- [x] 免費 Mock 測試案例。
- [ ] 與目前正式 schema／RPC 完整逐欄位映射。
- [ ] 狀態轉換純函式測試實作與執行。
- [ ] Supabase 隔離環境整合測試（未建立；不得為此自行產生費用）。
- [ ] 正式環境變更核准與部署（未開始）。

**安全邊界：**本文件建立不代表已更改任何正式資料、RLS、RPC、Edge Function、Secrets 或官網。
