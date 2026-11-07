# Phase 29｜整批純函式測試整合與狀態語意一致性

日期：2026-11-08  
狀態：測試程式已建立；尚未在此提交中聲稱已執行。正式環境維持唯讀。

## 本階段目的

把 Phase 22 安全 helper、Phase 24 HMAC／付款證明 helper、狀態機草案及 Phase 28 驗收矩陣放在同一個可執行入口，先釐清「通用訂單付款語意」與「merch_orders 資料表實際 CHECK 值」不可混用的問題。

## 執行方式

在有 Node.js 22 的 repo 工作目錄執行：

```sh
node --test app/tests/phase22-security.test.js app/tests/phase24-crypto-and-proof.test.js app/tests/phase29-cross-module.test.js
```

只使用 Node 內建 test runner 與虛構資料，不連 Supabase、不呼叫 LINE、不讀取正式顧客資料。

## 本階段涵蓋

- 通用付款狀態 helper 與 merch_orders canonical 狀態 helper 的邊界。
- DB 付款狀態不接受 reviewing、cancelled、refunded 等通用流程狀態。
- 退款是獨立流程，不得直接寫入 merch_orders.payment_status。
- merch shipment 狀態只允許 DB 已知 CHECK 值。
- proof_submitted 不等於 confirmed。
- HMAC 綁定 method、path、timestamp、event、order、token。
- 訪客／會員隔離、四種物流、通知冪等列為後續 DB／API 整合驗收，不以純函式測試假裝已通過。

## 重要限制

本測試僅能證明 helper 的純函式行為。不能證明 SQL migration、RLS、RPC ACL、Storage policy、Edge Function runtime、LINE webhook、真實付款或 App 真機行為正確。這些仍須在隔離 Supabase stack 與測試裝置完成。

## 安全界線

本階段沒有任何正式 DB DDL/DML、GRANT、RLS、Storage、Secrets、Edge Function、LINE、官網或商店上架操作。