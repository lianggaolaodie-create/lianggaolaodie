# Phase 76｜資料庫 Metadata 快照自動比對

## 交付
- `app/security/metadata-snapshot-comparator.js`：比較匯出的 table／policy／grant metadata。
- `app/security/metadata-snapshot-comparator.test.js`：合成快照測試。
- 嚴重問題分級：critical／warning；缺 metadata 不會默認安全。

## 偵測項目
- 目標資料表 RLS 未啟用或 metadata 缺漏。
- 缺少 policy。
- authenticated permissive ALL policy。
- 私人訂單／匯款資料無條件 true policy。
- anon／PUBLIC 寫入 grants。
- authenticated 對管理資料表的寫入 grants，標示需進一步核對。
- 管理寫入 policy 缺少可見 predicate。

## 使用方式
先在已確認的 staging 環境執行 Phase75 metadata-only SQL，將結果整理為 JSON：
```js
import { compareMetadataSnapshot } from './metadata-snapshot-comparator.js';
const report = compareMetadataSnapshot(snapshotJson);
console.log(JSON.stringify(report, null, 2));
```
輸入格式：
- `tables`: `{ table, rlsEnabled }`
- `policies`: `{ table, name, permissive, roles, command, using, withCheck }`
- `grants`: `{ table, grantee, privilege }`

## 重要限制
這是 metadata 快照規則比對器，不是完整 PostgreSQL parser，不解析任意 SQL predicate 的實際語意，也不能證明整個資料庫沒有漏洞。角色 predicate 是否可信、function／Storage 權限是否安全，仍需人工逐項審查並用真實 JWT staging 測試。未提供的資料會標示缺漏，不會假裝通過。

Phase76 沒有連線 Supabase、沒有查詢 production、沒有執行 SQL／GRANT／policy 變更，也沒有新增費用。
