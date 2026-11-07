# Phase 77｜資料庫安全風險報告產生器

## 功能
將 Phase 76 metadata snapshot 比對結果整理成可交辦風險報告：
- 唯一風險編號、嚴重度、資料表、policy 名稱。
- 問題說明、建議修補方向、修補後驗收標準。
- critical／warning 數量與 release gate：NO-GO／REVIEW／PASS。

## 風險分級
- Critical：RLS 關閉、policy 缺漏、authenticated permissive ALL、私人資料無條件政策、PUBLIC／anon 寫入 grant。
- Warning：metadata 缺漏、管理寫入 predicate 不明、authenticated grant 需逐項審查。
- PASS 僅代表輸入快照未觸發本工具規則，不等於完整安全認證。

## 使用
```js
import { buildSecurityRiskReport } from './security-risk-report.js';
const report = buildSecurityRiskReport(snapshot, { generatedAt: new Date().toISOString() });
console.log(JSON.stringify(report, null, 2));
```

## 限制
只處理匯入的 metadata；不連線 Supabase、不執行 SQL、不處理會員／訂單資料列、不自動修補 policy。修補需 staging、真實 JWT、完整人工審核與回復方案。
