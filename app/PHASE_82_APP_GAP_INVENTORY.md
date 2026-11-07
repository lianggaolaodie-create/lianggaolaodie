# Phase 82｜老爹涼糕 App 功能缺漏盤點

## 盤點方法與限制
本次檢查 GitHub 分支 `app/phase-1-planning` 的根目錄、`app/`、`app/mock-api/`、`app/security/`、`app/release/`、`app/tests/`、`supabase/migrations/` 與 workflow 檔案。這是 repository evidence audit，不是 production 主機掃描，也不代表所有 branch／部署環境內容。

## 真實結論
目前專案有大量規格、畫面原型、純函式模型、mock HTTP server 與自動化測試；但目前檢視到的交付尚不足以證明一套可安裝、已串接正式後端的 iOS／Android App。

| 範圍 | 判定 | 依據／說明 |
|---|---|---|
| 原生／跨平台 App 工程 | 缺少證據 | 檢視根目錄未見 package.json、原生工程；App README 仍描述規劃 |
| 顧客端 | 原型 | 有 customer-app-preview.html 等，不等於正式 App |
| 老闆後台 | 原型 | 有 owner-admin-preview.html 等，不等於正式權限及 API |
| Auth | 規格 | Supabase Auth 是規劃，未完成 staging 驗收 |
| 商品 API | Mock | 有 public read API 與 adapter 模型，未證明 production adapter |
| 購物車／報價 | 模型／Mock | 沒有真實價格與訂單交易整合證據 |
| 訂單 | Mock | 模擬服務使用合成資料，非真實訂單建立 |
| 付款／退款 | 模型 | 未連接金流 sandbox 或真實 webhook |
| 物流 | 模型 | 未證明物流供應商 API 已接通 |
| LINE 通知 | 盤點／測試 | 尚待 caller/token/payload 修補及實際測試 |
| 餐車／擺攤 | 規格＋既有網站 | App 共用發布流程未驗收；擺攤價格必須隱藏 |
| PDA | 暫緩 | 依先前範圍暫緩員工作業 |
| 優惠券／刮刮樂 | 規格 | 未證明兌換防重複後端 |
| DB／RLS／Storage | 未整合 | 目前安全工具與草稿不能當作已修補 |
| CI | 有自動測試 | 純函式測試成功不等於端到端產品驗收 |
| 商店上架 | 缺少證據 | 未見可提交 build、簽章或商店審核產物 |
| 既有官網 | 已存在 | root index.html 與 Pages workflow 存在，應維持正常運作 |

## 優先缺口
### P0
- GAP-001：建立真正可建置的 iOS／Android 工程。
- GAP-004：建立並驗收會員 Auth。
- GAP-007：訂單真實 staging API、訪客 claim、會員 ownership。
- GAP-008：付款 sandbox 與 webhook。
- GAP-016：staging DB／RLS／Storage 整合。
- GAP-018：可安裝 build、簽章與商店上架證據。

### P1
- 顧客及老闆正式 UI 與 API 整合。
- 商品／報價、退款取消、物流、通知、餐車／擺攤共用發布。
- 監控、備份與回復演練。

### P2
- PDA、優惠券／刮刮樂等後續模組。

## 不應重複開發
已存在的規格、模型、mock 與純函式測試應沿用；後續應集中在真實工程、staging adapter、端到端驗收，不要再把同一個模型換名稱重做。

## 建議執行順序
1. 建立可建置的跨平台 App 工程與基本導覽。
2. 先完成 staging 的公開商品／餐車／擺攤唯讀 API。
3. 建立 Auth、訪客購物車、伺服器報價與訂單建立。
4. 接入金流 sandbox、付款 webhook、取消／退款及物流 sandbox。
5. 建立老闆後台正式 API、角色權限與稽核。
6. 最後才做 PDA、促銷模組與商店上架。

## 安全與成本界線
不建立付費服務、不新增 Supabase 專案、不改 production schema／RLS／Storage／Functions／Secrets、不建立真實訂單、不觸發付款或通知、不部署 App。所有缺口狀態均以目前檢視到的 GitHub 分支證據為準。
