# Phase 26｜本機隔離環境可用性檢查與啟動阻礙

日期：2026-11-08
分支：`app/phase-1-planning`

## 1. 本次實際環境檢查

在目前可用的工作容器執行版本與指令檢查：

| 工具 | 結果 | 判定 |
|---|---|---|
| Node.js | v22.16.0 | 可用 |
| Docker CLI | 找不到執行檔 | 不可用 |
| Supabase CLI | 找不到執行檔 | 不可用 |
| Deno | 找不到執行檔 | 不可用 |

這只代表目前 ChatGPT 工作容器未提供上述工具；不代表使用者自己的電腦沒有安裝。

## 2. Phase 26 目前不能宣稱完成的項目

- 尚未啟動本機 Supabase stack。
- 尚未建立本機 Postgres／Auth／Storage／Edge Functions runtime。
- 尚未套用或驗證任何 migration。
- 尚未執行 DB RPC 整合測試、RLS／GRANT 測試、併發 token consume 測試。
- 尚未執行 Deno Edge Function runtime 測試。
- 尚未測試真實本機 Storage 上傳／finalize／signed URL 流程。

既有 Node.js HMAC／state fixture 測試仍只是本機純函式測試，不可改稱 DB／Storage／LINE 整合測試。

## 3. 安全決策

- 不連接正式 Supabase 專案執行任何測試寫入。
- 不建立 Supabase 雲端專案或付費 Branch。
- 不複製正式客戶資料、正式 Secrets、LINE token 或付款證明。
- 不在沒有 Docker／Supabase CLI 的情況下假裝本機 stack 已啟動。
- 不以 mock 測試取代 DB／Storage／Edge Function 的整合驗收。

## 4. 本機環境啟動前置條件

需要在使用者自己的 Mac／Windows／Linux 開發電腦確認：

1. Docker Desktop／Docker Engine 已安裝並啟動。
2. Supabase CLI 已安裝並可執行。
3. Deno 已安裝（Edge Function 本機驗證所需）。
4. 專案分支已 clone 至開發電腦。
5. 先審閱 repo 中的 Supabase config、migration、functions；不可直接對正式 DB 執行 reset 或 migration。

工具版本與安裝方式應以官方文件當下支援的版本為準；不要在手機上安裝或執行 Docker。

## 5. 下一步安全操作順序

### A. 只在開發電腦做工具確認

```bash
docker --version
docker info
supabase --version
deno --version
node --version
```

若 Docker 未啟動，先處理 Docker，不執行 Supabase start。

### B. 取得專案後只檢查，不連正式環境

```bash
git status --short
git branch --show-current
supabase --help
```

接著人工審閱 `supabase/config.toml`、migration 及 Edge Function 原始碼；確認不含正式資料 dump、正式 Secrets 或自動連線正式 DB 的腳本。

### C. 確認隔離後才啟動本機 stack

在確認 Docker 已啟動、專案設定正確且無正式連線字串後，再使用 Supabase CLI 本機啟動流程。啟動後先檢查本機 URL／本機 anon key；所有測試只使用 synthetic fixtures 與本機專用假 Secrets。

### D. 整合驗收

- migration 可在空白本機資料庫重建。
- 假訂單可重複 seed／reset。
- payment proof 上傳、finalize、審核狀態轉換。
- shipment token 有效、過期、重複使用、撤銷及並行消耗。
- RPC 權限、RLS、GRANT、交易原子性。
- Edge Function 驗證與 LINE mock，不發出真實 LINE 訊息。
- Storage private bucket、signed URL 與物件清理。

## 6. 本階段結論

Phase 26 已完成目前工作容器的工具盤點並確認環境阻礙；隔離 Supabase stack 尚未建立。這不是程式或資料庫測試失敗，而是執行環境缺少必要工具。

要繼續真正整合測試，必須在有 Docker 的開發電腦上進行，或由使用者提供可用的開發環境。任何可能收費的雲端替代方案都必須先說明費用並取得明確同意。

正式環境仍維持唯讀：無正式 DB DDL／DML、無 Function deploy、無 Secrets／LINE／官網變更。
