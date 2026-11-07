# Phase 69｜最低成本 Staging 建置方案與費用確認清單

日期：2026-11-08  
分支：`app/phase-1-planning`  
狀態：成本評估與建置計畫；未建立任何新服務。

## 1. 結論先看

**目前最省錢的路線：先維持 $0，繼續使用 GitHub Actions + 合成 fixtures + mock API；真正需要測試 Supabase Auth／RLS／Edge Functions 時，再建立獨立 staging project。**

不要把 production 當 staging，也不要把 Phase 67 mock HTTP server 公開上線。

Supabase 官方資料（查閱日期 2026-11-08）：
- Free：$0/月；每位 Owner／Admin 在所有組織合計最多 2 個 active free projects；Free project 閒置一週可能暫停，且沒有自動備份。參考：[官方價格](https://supabase.com/pricing)、[官方計費說明](https://supabase.com/docs/guides/platform/billing-on-supabase)。
- Pro：$25/月／組織起；含每月 $10 compute credit，可抵一個 Micro project；同一 Pro 組織中的額外 Micro project 約 $10/月起。Pro 與 Free 不能在同一組織混用，計費依組織方案。參考：[官方價格](https://supabase.com/pricing)、[官方 Billing FAQ](https://supabase.com/docs/guides/platform/billing-faq)。

以上是美元標價，未計稅、匯率、信用卡海外交易費、超額用量及其他 add-ons。價格可能調整，實際以建立當下官方 Dashboard／帳單為準。

## 2. 三種方案比較

| 方案 | 預估月費（USD） | 適用情境 | 限制／風險 |
|---|---:|---|---|
| A. 先不建立 staging | $0 新增費用 | 繼續開發 UI、契約、純 Node、mock 測試 | 無法驗證真實 Supabase Auth／RLS／Function |
| B. Supabase Free 獨立 staging | $0 | 短期、間歇式整合測試 | 受兩個 active free projects 總額限制；閒置可能暫停；無自動備份；不可當正式服務 |
| C. Supabase Pro 組織 | 約 $25/月起 | 需要持續運作、備份與正式一點的 staging | 組織級計費；若另加 Micro project，可能增加約 $10/月；需確認現有組織方案與 compute credits |

### 方案 A（現在建議採用）
- 不建立新 Supabase project。
- 保留現有 mock tests、GitHub Actions 與合成資料。
- 先完成 migration 草案、RLS 測試案例、Edge Function 授權審查、前端 adapter。
- 新增費用：$0。
- 仍然不能宣稱真實登入、真實資料庫交易或正式整合測試通過。

### 方案 B（低成本真實整合測試）
只有在確認帳戶尚有 Free project 額度、且可接受暫停與無自動備份時才使用。
- 建立一個全新、獨立的 Supabase Free project。
- 使用全新合成資料，不複製 production data。
- 僅測試 Auth、RLS、Storage、Edge Functions、API adapter。
- 關閉／不設定正式 LINE、金流、物流通知；一律使用 sandbox 或測試收件端。
- 測試結束後可暫停或刪除 staging；刪除前先確認沒有需要保留的測試證據。
- 不把 Free staging 當成正式營運服務。

### 方案 C（持續整合測試）
- 先確認現有 Supabase organization 是 Free 還是 Pro。
- Pro 是組織級方案；不能只把一個 project 單獨設成 Pro 而讓同組織其他 project 留在 Free。
- 官方標價 Pro $25/月起，包含 $10 compute credit；新增 Micro project 可能另加約 $10/月。
- 需評估備份、資料庫大小、流量、儲存與 Edge Function 用量；Spend Cap／超額限制需在 Dashboard 確認。
- 沒有核准前不得升級方案或建立 project。

## 3. 本專案建議採用順序

1. **先用方案 A（$0）**：Phase 69 之後先完成 staging seed script、RLS policy 測試設計、Function caller matrix、migration／rollback review。
2. **核對 Supabase 帳戶**：確認目前 organization plan、active free projects 數量、Owner／Admin 額度、現有付款方案及可用 compute credits。只查看帳單與設定，不做升級。
3. **若 Free 額度可用**：提出方案 B 的建立清單，等待使用者明確核准後才建立。
4. **若沒有 Free 額度或需要長期在線**：列出方案 C 的實際月費試算，等使用者核准再升級／建立。
5. **Staging 整合通過後**：逐項審核 production 變更，使用獨立變更窗口與明確核准；不能自動把 staging SQL 推上 production。

## 4. 建立 staging 前的檢查清單

- [ ] 確認 Supabase organization plan。
- [ ] 確認目前 Owner／Admin 可用的 Free project 額度。
- [ ] 確認現有 project 數量與各自用途，避免誤動 production。
- [ ] 確認預計新增服務的月費、compute、儲存、流量、稅費及可能超額。
- [ ] 確認是否會需要付費 Email／SMS、LINE OA、金流 sandbox、物流 sandbox。
- [ ] 確認 staging 專用 URL、anon key、service-role key 與 Function secrets。
- [ ] 確認資料全部為 synthetic fixtures。
- [ ] 確認 staging 不會寄送正式通知、不會建立正式訂單、不會扣款。
- [ ] 確認刪除／暫停 staging 的程序及測試證據保存方式。

## 5. Staging 最小資源清單

| 資源 | 最小需求 | 費用處理 |
|---|---|---|
| Supabase project | 1 個獨立 project | Free 額度可用時 $0；否則先報價 |
| Database | 只建必要 schema／測試資料 | 使用 Free quota；監控容量 |
| Auth | 測試帳號、Email OTP／magic link | 不先啟用付費 SMS |
| Storage | 合成商品圖與測試檔 | 不上傳真實匯款證明或顧客文件 |
| Edge Functions | 僅部署 staging 版本 | 先核對 invocation quota |
| GitHub Actions | 現有 runner 與 mock tests | 先使用現有免費額度；核對 GitHub 帳戶限制 |
| Email／SMS／LINE | 測試收件端或 sandbox | 未確認費率前不開通付費發送 |
| Payment／logistics | sandbox 或 mock provider | 不連正式帳戶、不產生真實交易 |

## 6. 風險控制

- 不複製正式資料庫，不匯入會員、訂單、電話、地址、付款證明、LINE payload。
- 不把 production secrets 放進 staging；不把 staging secrets 放進 production。
- Staging Function 不可使用正式金流、物流、LINE、SMS 或 Email 發送憑證。
- 測試資料需可重建；測試前後保存 schema、policy、function version 與測試報告。
- 所有 RLS 測試至少包含 anon、會員 A、會員 B、各管理角色；驗證拒絕案例。
- 任何 migration 都先在 staging 執行並驗證 rollback；不可在 production 試跑。
- Free project 閒置暫停不代表可作為可靠 uptime 環境；上線前必須重新確認專案狀態。

## 7. 核准閘門

本文件**不構成**建立 staging、升級方案、綁定付款方式或購買第三方服務的授權。

開始建立之前，必須另行取得明確同意，且同意內容至少包含：
1. 選擇方案 A／B／C。
2. 最高可接受新增月費（USD 或 TWD）。
3. 是否同意建立獨立 Supabase staging project。
4. 是否同意任何第三方測試服務（Email／SMS／LINE／金流／物流）。

未取得核准前，維持方案 A，新增費用 $0。

## 8. 本階段驗收結論

- [x] 比較 $0 mock-only、Free staging、Pro staging 三種路線。
- [x] 整理 Supabase 官方方案與計費方式。
- [x] 列出最低 staging 資源清單。
- [x] 列出建立前費用核對與資料隔離檢查表。
- [x] 明確定義未核准不得建立／升級／綁卡／啟用付費服務。
- [ ] 查核帳戶目前方案與剩餘 Free project 額度（需帳戶唯讀檢視）。
- [ ] 建立 staging project（需明確核准）。
- [ ] 真實 Auth／RLS／Function 整合測試。

**結論：Phase 69 成本方案與核准清單完成；目前仍採 $0 方案 A，未建立新 project、未升級方案、未產生新增費用。**
