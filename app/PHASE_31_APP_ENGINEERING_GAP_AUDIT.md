# Phase 31｜App 工程現況盤點與可交付缺口

日期：2026-11-08  
狀態：唯讀盤點；未建立可安裝 App、未部署服務。

## 盤點依據

本階段以分支 `app/phase-1-planning` 中可讀取的 `app/README.md`、`app/FULL_SYSTEM_ARCHITECTURE.md`、主控 tracker、狀態機及既有安全測試文件為依據。此盤點不代表完整 Git tree 的逐檔掃描，也不代表正式主機目前部署內容。

## 現況判斷

| 項目 | 目前證據 | 真實狀態 |
|---|---|---|
| 顧客 App iOS／Android | 目前 App README 與架構規劃 | 需求／規格階段，未證明存在可建置原生或跨平台 App 工程 |
| App 啟動與導覽 | 畫面清單／視覺規格 | 未證明已實作 |
| 會員 Auth | 規劃 Supabase Auth | 未建立或驗收新會員系統 |
| 商品／購物車／結帳 | 現有官網頁面及既有 RPC 被盤點 | App API 尚未完成 |
| 訂單追蹤 | 狀態機草案 | 未完成跨資料表 API 與 RLS 驗收 |
| 老闆後台 | 既有 merch-admin 頁面及原型盤點 | 現有後台不等於新 App 後台；付款／物流狀態有相容缺口 |
| 餐車／擺攤 | 既有排程表與頁面 | 新 App 共用發布流程未驗收 |
| 優惠券／刮刮樂 | 架構需求 | 未證明有完整後端防重複兌換實作 |
| LINE 通知 | 現有 Functions 已盤點部分 | 存在 caller、token、payload 信任邊界待修補 |
| App Store／Google Play | 上架需求清單 | 未建立簽章、商店素材、可提交 build 或審核紀錄 |
| 自動化純函式測試 | Phase 22／24／29 tests 與 CI workflow | workflow 已建立，執行結果仍待 GitHub Actions 回報 |
| DB／RLS／Storage／Edge Function 整合 | Phase 26 環境檢查 | 尚未整合驗收 |

## 不應誤認為已完成的事項

1. App 規格、畫面清單或黑金 UI 參考，不是可安裝 App。
2. 官網現有頁面不是 App API。
3. 現有 Supabase 專案 URL 不代表新會員／App 功能已安全串接。
4. 測試 fixture 不代表正式資料庫測試。
5. GitHub Actions workflow 建立不代表 workflow 已通過。
6. 既有後台頁面不代表新後台已具備完整權限與正確狀態更新。

## 本階段完成的可用交付

- 確認目前交付物仍以規格、盤點、原型及純函式測試為主。
- 將真正可交付 App 的必要工程缺口列明。
- 建議後續工程優先順序：建立跨平台 App shell 與路由 → 顧客唯讀商品／行程 API 契約 → 訪客購物車與結帳 API → Auth／會員隔離 → 訂單追蹤 → 老闆後台 → 行銷 → 上架 build。
- 員工 PDA、員工登入、揀貨／包裝／出貨工作站依使用者目前範圍暫緩，不納入本階段實作。

## 外部阻擋

- 使用者目前只有 iPhone，無法在本機執行完整 Xcode／Android SDK／Docker／Supabase CLI 工具鏈。
- 不新增付費雲端開發環境。
- 未獲逐項核准前，不修改正式 Supabase schema／RLS／Storage／Functions／Secrets，不切換官網。
- 若需真正產出可安裝 iOS build，仍需 Apple 開發者帳號、簽章與可用 macOS/Xcode 建置流程；Android 需 Android build/signing 與 Play Console 資料。

## 安全界線

本階段僅新增盤點文件；無正式資料庫寫入、部署、LINE 推播、Storage 上傳、網站切換或商店提交。
