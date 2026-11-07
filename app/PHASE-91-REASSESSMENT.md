# Phase 91｜專案重新盤點與可交付範圍確認

更新日期：2026-11-08  
Repository：`lianggaolaodie-create/lianggaolaodie`  
Branch：`app/phase-1-planning`  
盤點基準 commit：`1ae4cfb9888f5d030cf377d2805d8a77938e4218`

## 1. 本階段修正

重新檢查完整 Git tree 後，確認 Phase 90 靜態盤點對既有 App 原型的描述不完整。此分支並非完全沒有 App 程式碼；目前已有 PWA 示範外殼、顧客流程原型、老闆端原型及多個 mock API／純函式測試。本文件補充並修正該範圍，不代表正式 App 已完成。

## 2. 已找到的實際程式

- `app/pwa/index.html`：PWA 主頁與導覽。
- `app/pwa/styles.css`：黑金介面樣式。
- `app/pwa/app.js`：顧客端示範頁、購物車、配送預覽、示範訂單查詢及老闆端示範入口。
- `app/pwa/core.js`：路由、購物車、示範訂單查找及結帳閘門等純函式。
- `app/pwa/manifest.webmanifest`、`app/pwa/sw.js`：PWA manifest 與靜態外殼快取。
- `app/mock-api/`：商品、購物車、訂單生命週期、會員查詢、管理端、權限、RLS 模型及 HTTP contract 等模組與測試。
- `app/customer-app-preview.html`、`app/customer-flow-preview-v2.html`、`app/owner-admin-preview.html`、`app/owner-order-preview.html` 等既有畫面原型。

## 3. CI 自動化測試實際結果

已讀取 GitHub Actions 最新的 Pure Node safety tests 執行結果：

- Workflow run：294
- Run URL：https://github.com/lianggaolaodie-create/lianggaolaodie/actions/runs/42414320526
- Branch：`app/phase-1-planning`
- Commit：`1ae4cfb9888f5d030cf377d2805d8a77938e4218`
- 結果：`success`
- Job：`pure-node-tests` 成功。
- 已成功的測試步驟包含 Phase 22、24、29、53、55–60、66–83 的純 Node／mock／安全模型測試；Phase 83 PWA app shell tests 亦成功。

此結果代表上述 CI 指定的自動化測試通過；不代表瀏覽器端到端測試、真實裝置測試、正式資料庫整合、付款或物流測試已通過。

## 4. PWA 目前限制

依 `app/pwa/README.md` 與程式碼確認：

- 商品、價格與購物車均為示範資料／本頁記憶體狀態。
- 示範訂單查詢只使用合成示範單號，不查真實顧客資料。
- 正式會員 Auth、Supabase API、付款、物流、推播與管理端授權尚未串接。
- 老闆入口仍為示範介面，不能管理正式資料。
- 尚未產生已簽章 iOS IPA 或 Android APK，也未完成 App Store／Google Play 上架。
- PWA README 說明部署至 HTTPS 後可由 iPhone Safari 加入主畫面；目前此分支尚未部署到正式官網。

## 5. 部署路徑檢查

`.github/workflows/deploy-pages.yml` 的自動部署觸發條件是 push 到 `main`，不是 `app/phase-1-planning`。因此不能把目前功能分支上的 PWA 檔案視為已公開部署或已可由顧客安裝。

## 6. 安全界線維持

本階段僅檢視 GitHub 原始碼與 CI 結果。沒有連接或修改正式 Supabase schema、資料、RLS、Secrets、Edge Functions、付款、物流或正式官網；沒有部署或合併分支。正式結帳維持停用。

## 7. Phase 91 結論與下一步

**已確認：** 專案已有可操作的 PWA 示範外殼及多個 mock 模組，且最新指定 CI 測試通過。

**尚未完成：** 真實會員／資料 API 串接、後台正式授權、付款／物流、跨裝置端到端驗收、正式部署與原生商店上架。

建議下一步先在不接觸正式資料的前提下，對 PWA 做瀏覽器層級互動與可及性檢查，補齊顧客端和老闆端原型的整體導覽，再準備隔離測試環境及正式整合前的安全核准。員工 PDA 與掃碼工作流程仍依主控清單暫緩，不納入本階段交付。
