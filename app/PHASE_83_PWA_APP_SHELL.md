# Phase 83｜老爹．涼糕黑金 PWA App 外殼

日期：2026-11-08  
分支：`app/phase-1-planning`

## 交付內容
- `app/pwa/index.html`：顧客首頁與導覽。
- `app/pwa/styles.css`：黑金品牌視覺，支援手機與桌面尺寸。
- `app/pwa/app.js`：首頁、商品、購物車、餐車／擺攤、會員及老闆入口導覽。
- `app/pwa/core.js`：可測試的路由與示範購物車純函式。
- `app/pwa/manifest.webmanifest`、`app/pwa/sw.js`：PWA 安裝描述與靜態外殼快取。
- `app/pwa/README.md`：預覽、使用與限制。
- `app/pwa/core.test.js`：5 項 Node 自動化測試。

## 視覺確認
本版先採黑金色系：深黑底、霧金線條、暖金按鈕與簡潔品牌字標。後續可依實際頁面檢視再調整，不視為最終定稿。

## 功能範圍
可操作的是前端示範導覽與記憶體購物車。商品卡為示範資料，不含正式售價；購物車不會建立訂單；正式結帳保持停用。會員與老闆入口只顯示尚未串接的安全提示。

## 未完成／不宣稱
- 非已簽章 IPA／APK，未完成 App Store／Google Play 上架。
- 未串接正式 Supabase Auth、商品／訂單 API、付款、物流、通知。
- 未執行 production DB、RLS、Secrets 或官網修改。
- 未部署，未合併至正式分支。

## 驗收方式
使用 Node.js 執行 `node --test app/pwa/core.test.js`，並由 GitHub Actions 的 Pure Node safety workflow 重複執行。
