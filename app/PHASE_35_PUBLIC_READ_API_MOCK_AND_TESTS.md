# Phase 35｜公開讀取 API Mock 原型與自動測試

日期：2026-11-08  
分支：`app/phase-1-planning`  
狀態：純 Node.js mock adapter 與測試已提交；GitHub Actions workflow 已設定，**尚未取得本次 CI 執行結果**。不是正式 API 或資料庫串接。

## 1. 本階段交付

新增：
- `app/mock-api/public-read-api.js`：純函式公開資料 adapter。
- `app/mock-api/public-read-api.test.js`：Node.js 內建 test runner 合成資料測試。
- `.github/workflows/app-public-read-api.yml`：Node.js 22 GitHub Actions 測試工作流程。

目前程式不使用 Supabase client、不連網、不讀正式資料、不需要環境變數或 secrets。

## 2. 已實作的 mock adapter

### 商品目錄
- 涼糕口味：只接受 `enabled === true`。
- 蘿蔔糕商品：官網顯示開關 `enabled` 與線上訂購開關 `online_enabled` 分開。
- 不公開停用商品。
- 價格只接受非負整數；無效或未定價商品標示不可售，不自行補價。
- 輸出使用欄位白名單，不複製內部管理欄位。

### 公開內容
- 僅允許固定 section allowlist。
- 僅回傳 `published === true` 的內容；未明確發布者 fail closed。
- 僅輸出 title、content、image_url、published，不回傳內部備註或其他管理欄位。

### 餐車／擺攤行程
- 僅處理 enabled 行程。
- 只接受 mock enum `food_truck`／`stall`；正式 schedule_type 值仍須 schema 核實。
- 餐車可輸出價格。
- 擺攤回應在物件結構上完全沒有 `price`、`currency` 欄位。
- 只輸出公開 DTO，不洩露 created_by、internal_note 等內部欄位。
- 不生成地址或座標；待真實欄位確認後再擴充。

### 分頁與錯誤處理
- 以 opaque base64url cursor 包裝 offset 的 mock pagination。
- limit 限制 1–100。
- 無效 cursor、limit、type、資料型別會回傳結構化 ApiError。
- 此 offset cursor 僅供 mock 原型；正式 API 應使用穩定排序鍵與資料版本，避免大量資料插入造成頁面漂移。

## 3. 自動測試範圍

測試使用合成資料，覆蓋：
1. 啟用／停用涼糕口味。
2. 蘿蔔糕官網顯示與線上訂購開關分離。
3. DTO 欄位白名單。
4. 公開內容 section allowlist 與內部欄位排除。
5. 未發布內容 fail closed。
6. 餐車價格欄位。
7. 擺攤不回傳價格欄位。
8. 停用／未知類型行程排除。
9. 行程類型篩選。
10. cursor 分頁。
11. 無效 cursor／limit／type。
12. 停用口味不出現在行程。
13. 非預期資料陣列 fail closed。
14. 行程內部欄位不外洩。

執行指令（在 Node.js 22 環境）：

```bash
node --test app/mock-api/public-read-api.test.js
```

GitHub Actions workflow 會在該分支相關檔案 push 或 pull request 時執行相同測試。本階段尚未取得 workflow run 結果，因此**不能宣稱測試已通過**。

## 4. 重要限制與待修正事項

- 目前是 pure mock adapter，沒有 HTTP server、Supabase client、資料庫讀取或 Auth。
- `schedule_type` 的 `food_truck`／`stall` 是 prototype enum，正式值必須先查 schema。
- 商品與口味價格欄位 mapping 尚待完整資料字典核實。
- 公開內容只接受明確 `published=true`；若舊資料沒有此旗標，正式 adapter 需由已核准發布來源轉成明確 DTO，不可自動把未標示內容公開。
- radish_products JSON 與正規化 products table 的最終來源尚待決策。
- 圖片 URL 尚未驗證來源網域與 Storage policy；正式實作應限制允許的 bucket／host。
- 分頁 cursor 尚未簽章或綁定查詢條件；正式服務不得直接沿用此簡化 cursor。
- 價格只做格式檢查，不代表可信報價；購物車與建單仍須獨立 quote service server-side recalculation。

## 5. 本階段未做事項

- 未連線正式 Supabase。
- 未查詢正式資料或顧客個資。
- 未建立或部署 Edge Function／HTTP endpoint。
- 未修改正式資料庫、RPC、RLS、GRANT、Storage、Secrets。
- 未修改官網或正式 App。
- 未執行 iOS／Android build 或真機測試。
- 未取得 GitHub Actions 本次 workflow 執行結果。

**Phase 35 交付判定：公開讀取 API 的可執行 mock 原型、合成測試及 CI workflow 已建立；測試結果待 CI 執行，正式 API／資料庫串接未完成。**

## 6. 下一階段（Phase 36）

補齊 mock API 的 HTTP transport 與 request／response envelope，建立不連外的本機測試 server（只使用 Node.js built-in modules），讓 App 前端可以先對接固定路徑；加入 request_id、錯誤 envelope、query validation、公開 DTO integration tests。保持 mock fixtures，禁止連正式 Supabase。
