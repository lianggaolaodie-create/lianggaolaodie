# Phase 92｜PWA 快取與手機互動修正

更新日期：2026-11-08  
Branch：`app/phase-1-planning`

## 本階段完成的程式修正

### 1. Service Worker 快取隔離
檔案：`app/pwa/sw.js`

- 將靜態外殼快取版本升級為 `laodie-pwa-shell-v2`，讓瀏覽器能辨識新版外殼。
- 清理舊快取時只刪除 `laodie-pwa-shell-` 前綴的本 App 快取，不再刪除同一網域其他網站／功能的 Cache Storage。
- 將離線首頁 fallback 限定在 navigation request；CSS、JavaScript、圖片等資源失敗時不再錯誤回傳 HTML 首頁。
- 僅處理同來源且位於 PWA scope 內的 GET 請求；不攔截 POST 或跨來源請求。
- 保留靜態外殼預先快取及離線首頁能力。

### 2. 手機與鍵盤操作提示
檔案：`app/pwa/styles.css`

- 補上按鈕、連結、輸入框及選單的 `:focus-visible` 金色外框，改善鍵盤／輔助操作時的焦點辨識。
- 補上停用按鈕的視覺提示。
- 修正主要金色按鈕的字型 shorthand，改用明確字型、字級與行高。

### 3. 品牌首頁錨點
檔案：`app/pwa/index.html`

- 為首頁 Hero 區塊補上 `id="home"`，使品牌標誌的 `#home` 連結有正確目標。

## 驗證狀態

- 已從 GitHub 分支重新讀取三個修改檔案，確認變更均已寫入。
- 最新分支 commit：`91f5052b4971e97cb3aa6f79ceef4eef560fc494`。
- GitHub Actions 的 Pure Node safety tests 已因程式更新觸發新執行；本報告建立時該執行仍在佇列，結果尚未確認。
- 尚未執行真實 iPhone Safari／Android Chrome 的瀏覽器手動測試；因此不宣稱離線安裝、更新提示或裝置端操作已完成驗收。

## 未變更的安全界線

- 沒有部署到正式官網或合併至 main。
- 沒有連接或修改正式 Supabase、會員個資、訂單、付款、物流或 Secrets。
- 正式結帳維持停用；示範訂單仍只使用合成資料。
- 本階段仍是 PWA 示範原型，不是已簽章的 iOS／Android 原生 App。

## 下一階段建議

在隔離預覽環境進行 iPhone Safari 與 Android Chrome 實機驗收：首次載入、加入主畫面、離線重新開啟、更新版本、返回首頁、購物車數量、示範訂單查詢、鍵盤焦點與小螢幕版面。通過後再規劃正式資料 API 與登入串接。
