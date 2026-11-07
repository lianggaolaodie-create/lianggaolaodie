# Phase 27｜iPhone-only 開發限制與免電腦前置工作計畫

日期：2026-11-08  
分支：`app/phase-1-planning`

## 1. 使用者目前可用設備

使用者確認目前只有 iPhone，沒有 Windows／Mac／Linux 開發電腦。

因此，本階段不要求使用者在 iPhone 安裝或執行 Docker、Supabase CLI、Deno，也不把手機瀏覽器或 GitHub 網頁編輯器當成本機 Supabase runtime。

## 2. 本階段目標

在沒有電腦、沒有新增付費服務的前提下，先完成可透過現有 GitHub 專案審閱的文件與靜態準備，讓未來取得開發電腦時可直接進入隔離測試，而不必重新盤點。

## 3. 可先進行的免電腦工作

| 工作 | 本階段處理方式 | 可宣稱的完成狀態 |
|---|---|---|
| 測試範圍整理 | 依 Phase 23–26 已知風險列出測試矩陣 | 文件已建立 |
| 合成資料規格 | 定義虛構訂單、商品、會員、物流與付款資料欄位；不放入真實個資 | 規格已建立 |
| 狀態轉換案例 | 列出合法／非法付款、訂單、物流狀態轉換 | 文件已建立 |
| Caller 人工核對表 | 整理需由專案管理者在 Supabase／LINE／主機控制台核對的項目 | 清單已建立；尚未核對 |
| 本機啟動操作稿 | 記錄未來電腦端工具檢查、隔離確認及啟動順序 | 操作稿已建立 |
| 正式環境安全界線 | 維持正式 DB、Storage、Functions、Secrets、LINE、官網唯讀 | 持續遵守 |

## 4. 本階段不得執行或宣稱的事項

- 不在 iPhone 上執行 Docker／Supabase 本機 stack。
- 不使用正式 Supabase 專案充當測試環境。
- 不建立任何 Supabase 雲端專案或付費 Branch。
- 不複製正式會員、顧客、訂單、付款證明或 Secrets 作為測試資料。
- 不對正式資料庫執行 DDL／DML、migration、GRANT、RLS 或 RPC 變更。
- 不部署、替換或停用正式 Edge Functions。
- 不更改正式 Secrets、LINE 設定、官網檔案或主機部署。
- 不把靜態檢查、文件整理或 mock 規格宣稱為整合測試通過。

## 5. 未來取得電腦後的最短安全路徑

1. 取得 repo 的 `app/phase-1-planning` 分支。
2. 檢查 Git working tree、分支與 commit。
3. 檢查 `supabase/config.toml`、所有 migration、seed、Edge Functions 與 package scripts。
4. 搜尋並排除任何自動連線正式 Supabase 的設定或腳本。
5. 確認 Docker、Supabase CLI、Deno、Node.js 版本與可用性。
6. 僅在本機啟動 Supabase stack，確認 URL 指向 localhost。
7. 使用全新合成資料與假 Secrets，禁止使用正式資料。
8. 驗證 migration 可由空白本機資料庫重建，再執行 RLS／GRANT／RPC／Storage／Edge Function 測試。
9. LINE 僅使用 mock，不發送真實通知。
10. 測試結果逐項記錄，未執行項目保持「未執行」。

## 6. 本階段交付與限制

本文件是開發路線與安全操作規格，不是 App、後端或本機測試環境的實作成果。Phase 26 所記錄的 Docker／Supabase CLI／Deno 缺失狀態仍然有效；目前沒有新的整合測試證據。

## 7. 下一個免電腦工作項目

建立合成測試資料字典與測試案例清單，涵蓋：
- 涼糕送到府與超商冷藏寄放。
- 蘿蔔糕冷凍店到店與冷凍宅配。
- 訪客／會員訂單隔離。
- 付款證明提交、核款、退件、退款與 COD。
- 出貨 token 有效、過期、重複使用、撤銷與併發消耗。
- 物流狀態更新、通知冪等與 LINE mock。
- 商品停售、庫存不足、運費與寄放費快照。

任何測試資料均使用虛構姓名、電話、地址、訂單編號及付款資訊。
