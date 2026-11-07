# Phase 71｜角色權限自動測試

## 交付
- `app/mock-api/role-authorization-model.js`：純 JS 權限決策參考模型，採 fail-closed。
- `app/mock-api/role-authorization-model.test.js`：9 個 Node 原生測試。
- `app/PHASE_71_ROLE_AUTHORIZATION_TESTS.md`：角色權限邊界與驗收限制。
- CI：加入 Pure Node safety workflow。

## 權限草案
| 角色 | 允許範圍 | 明確禁止 |
|---|---|---|
| customer | 公開商品、本人資料／訂單、有效訪客 claim | 他人資料、管理操作 |
| product_admin | 商品、口味、每日開單 | 訂單履約、付款核對、個資 |
| order_admin | 訂單管理、履約 | 付款核對、個資管理、角色管理 |
| payment_admin | 付款審核 | 履約、商品管理、角色管理 |
| personal_data_admin | 經授權的個資檢視 | 商品、付款、履約及角色管理 |
| super_admin | 全部管理權限 | 仍須保留稽核與重新驗證 |

## 安全限制
- 此模型只用於合成測試，並非正式 Supabase Auth、RLS 或 API middleware。
- 正式授權必須在 server-side 與資料庫層同時實作；不可只依賴前端角色或此 JS 模型。
- 真實 RLS 驗收仍須在獨立 staging project，以不同 JWT 角色執行允許／拒絕測試。
- 不執行 production SQL、不變更正式角色、不讀取正式個資。
