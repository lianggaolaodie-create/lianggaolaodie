# Phase 25｜正式入口追查、周邊商品狀態修正 Diff 與隔離測試計畫

日期：2026-11-08
分支：`app/phase-1-planning`
範圍：唯讀盤點、修正草案、隔離測試規劃；不部署、不寫入正式環境。

## 1. 正式網站導覽與後台入口

### 已檢查的 active branch

- `index.html` 桌面導覽與手機選單包含首頁、活動、購買規則、涼糕專區、蘿蔔糕專區、周邊商品、線上訂購等公開頁面。
- 手機選單的周邊商品連結指向 `merch.html`。
- `merch.html` 是顧客周邊商品展示／下單頁，不是管理後台。
- 在已檢查的 `index.html` 導覽區塊中，沒有找到 `merch-admin.html` 或 `merch-admin-v2.html` 的公開導覽連結。
- `merch-admin.html` 與 `merch-admin-v2.html` 都是獨立 HTML 頁面，檔名可被直接請求不等於已證明它們是正式管理入口。

### 兩個後台不等價

| 頁面 | 目前程式碼可見功能 | 風險／差異 |
|---|---|---|
| merch-admin.html | 商品、訂單、付款／出貨狀態、個資管理；直接更新 merch_orders | 狀態下拉選單使用與 DB CHECK 不相容的舊值；可刪訂單 |
| merch-admin-v2.html | 商品與分類管理、商品訂單檢視、客戶個資檢視、商品圖片上傳 | 訂單區目前是檢視用途，沒有付款／出貨狀態更新；圖片上傳為商品圖 |

### 尚未能確認

- GitHub active branch 的程式碼不能單獨證明目前正式主機部署的是哪個 commit。
- 本次沒有可驗證的 hosting／CI 部署設定或管理者登入紀錄，故不能宣稱哪個後台正在被實際使用。
- 正式入口應由管理者在主機控制台、部署紀錄及實際登入流程確認；在確認前不移除、不改名、不合併兩個頁面。

## 2. merch-admin.html 狀態欄位問題

### 已知資料庫 canonical values（依先前唯讀 constraint 盤點）

付款 `merch_orders.payment_status`：
- `unpaid`
- `proof_submitted`
- `confirmed`
- `rejected`

出貨 `merch_orders.shipment_status`：
- `unprepared`
- `preparing`
- `shipped`
- `delivered`

目前 `merch-admin.html` 下拉選單卻使用：
- 付款：`pending`、`paid`、`refunded`
- 出貨：`pending`、`processing`、`shipped`、`completed`

而 `window.updateOrder(i, field, value)` 會將下拉值直接寫進資料庫。這會觸發 CHECK constraint 錯誤；目前程式也沒有先做 canonical mapping。

## 3. 建議修正 Diff（草案，不是已套用程式碼）

### A. 付款選單：改成直接使用 DB canonical values

將舊選項：
- `pending`（待付款）
- `paid`（已付款）
- `refunded`（已退款）

改成：
- `unpaid`（未付款）
- `proof_submitted`（已提交付款證明／待審核）
- `confirmed`（已確認收款）
- `rejected`（付款證明未通過）

範例：

```html
<select onchange="updateOrder(ORDER_INDEX,'payment_status',this.value)">
  <option value="unpaid">未付款</option>
  <option value="proof_submitted">付款證明待審核</option>
  <option value="confirmed">已確認收款</option>
  <option value="rejected">付款證明未通過</option>
</select>
```

注意：範例中的 `ORDER_INDEX` 是說明用佔位字，實作時沿用原本 renderOrders 的索引變數，不可原樣貼上。

### B. 出貨選單：改成直接使用 DB canonical values

```html
<select onchange="updateOrder(ORDER_INDEX,'shipment_status',this.value)">
  <option value="unprepared">未備貨</option>
  <option value="preparing">備貨中</option>
  <option value="shipped">已出貨</option>
  <option value="delivered">已送達</option>
</select>
```

同樣地，`ORDER_INDEX` 只為說明佔位字。

### C. updateOrder 必須加入欄位與值白名單

建議以固定字典驗證欄位和值；禁止任意 field 寫入，禁止 UI 將舊狀態傳到 DB。更新失敗時，重新載入該訂單狀態或還原 select 顯示值，不可先在本機 orders 陣列假裝更新成功。

參考邏輯：

```js
const ALLOWED_STATUS = {
  payment_status: new Set(['unpaid', 'proof_submitted', 'confirmed', 'rejected']),
  shipment_status: new Set(['unprepared', 'preparing', 'shipped', 'delivered'])
};

window.updateOrder = async (i, field, value) => {
  if (!Number.isInteger(i) || !orders[i]) {
    return note('orderMsg', '找不到這筆訂單，請重新整理。', true);
  }
  if (!Object.hasOwn(ALLOWED_STATUS, field) || !ALLOWED_STATUS[field].has(value)) {
    return note('orderMsg', '不支援的狀態，未更新資料。', true);
  }

  const order = orders[i];
  const previous = order[field];
  const result = await db.from('merch_orders')
    .update({ [field]: value, updated_at: new Date().toISOString() })
    .eq('id', order.id)
    .select('id,' + field)
    .maybeSingle();

  if (result.error || !result.data) {
    await loadOrders();
    return note('orderMsg', '更新失敗，已重新讀取訂單狀態。', true);
  }

  order[field] = result.data[field];
  renderOrders();
  renderStats();
  note('orderMsg', '訂單狀態已更新。');
};
```

備註：
- 此為參考 patch，不可直接視為已通過權限／RLS 驗收。
- 實作時要確認管理者更新權限、資料列回傳行為及錯誤處理。
- 不要在更新失敗時只修改前端陣列。
- `Object.hasOwn` 需確認目標瀏覽器支援；若需相容舊瀏覽器，可用 `Object.prototype.hasOwnProperty.call`。

### D. 舊資料與未知值處理

- 讀到 canonical value 時，依 DB 值選取對應選項。
- 讀到非 canonical／未知值時，不可默默轉成某個合法狀態；顯示「未知狀態，請人工核對」，暫停該欄位更新。
- 不可將 `refunded` 轉成 `rejected`、`confirmed` 或其他付款狀態。
- `refunded` 代表退款事件／財務結果，不等於付款證明審核未通過。退款應另設退款流程、退款紀錄及操作者／時間／金額稽核，待需求確認後設計。
- `pending` 也不可一律轉成 `unpaid`，除非先查明每筆資料原始語意及 DB 現況。

### E. 統計卡片也要同步改成 canonical values

目前統計邏輯用 `payment_status !== 'paid'`、`shipment_status === 'pending'`、`processing/shipped` 等舊值。修正選單後，統計條件也必須改成：
- 待付款／待審核：按 `unpaid`、`proof_submitted` 分開統計，避免混為一類。
- 已確認收款：`confirmed`。
- 備貨／出貨中：`preparing`、`shipped`。
- 未備貨：`unprepared`。
- 已送達：`delivered`。

不可只改 select 而保留舊統計條件。

## 4. 出貨通知 Token caller 追查狀態

已知：
- `orders.shipment_notify_token` 欄位 default 會在新增訂單時產生隨機 token。
- 已找到 `public.verify_shipment_notify_token(p_order_id, p_token)` 驗證函式；它只比對訂單 ID 與 token。
- `line-customer-notify` v5 會接收 request body 的 order_id、notify_token、recipient、order_number、pickup_type、pickup_store，再呼叫驗證 RPC。
- Function 通過 token 驗證後，通知收件人及部分訂單／取貨內容仍取自 request body；目前未見 token consume、expiry、event idempotency 或從 DB 派生完整訊息欄位。
- 在已檢查的 active branch 前端／資料庫函式範圍，尚未找到可信任的 token 讀取與傳遞 caller。

結論：**token 發出端 caller 仍未知**。DB default 產生 token 不等於已找到安全的通知呼叫端。此結論不代表外部 caller 一定不存在；仍需管理者檢查 Supabase Dashboard、CI／主機環境變數、LINE Developers 相關服務及第三方自動化。不得讀取或列出客戶訂單資料來追查。

## 5. 隔離 Supabase 整合測試環境（免費優先）

不建立付費 Supabase Branch；不複製正式客戶資料。

### 建議方案

1. 先在開發電腦確認 Docker 與 Supabase CLI 可用；使用本機 Supabase stack 作為第一選擇。若本機資源不足，再討論其他免費隔離方案，任何可能收費的服務先取得同意。
2. 由 Git branch 取得 schema／migration 與 Edge Function 程式碼；先審核所有 migration，不直接套用未知或含正式資料的 dump。
3. 使用 synthetic fixtures 建立假會員、假商品、假訂單、假付款證明物件與假 shipment token。禁止複製正式姓名、電話、地址、Email、LINE ID、匯款後五碼或付款證明。
4. 使用本機專用假 Secrets；不得複製正式 service role key、LINE channel secret／access token 或正式 webhook secret。
5. LINE 通知使用 mock endpoint／測試 stub；不得推播到真實客戶。
6. Storage 使用本機 private bucket；測試訂單綁定、檔案 MIME／大小、有效期、單次使用、簽名 URL 與刪除流程。
7. 在本機 Deno／Supabase Function runtime 驗證 Edge Function，並對 DB RPC 做整合測試，涵蓋交易原子性、重複 event、並行 consume、權限與 RLS。
8. 只有在本機測試通過後，才整理正式環境變更包；仍需另行取得明確核准才可部署。

### 隔離驗收清單

- [ ] 本機 Supabase stack 可啟動與重建。
- [ ] schema／migration 已人工審查，無正式資料。
- [ ] 假資料可重複 seed／reset。
- [ ] 假 Secrets 與正式 Secrets 完全分離。
- [ ] 測試 LINE 通知不可能送達正式客戶。
- [ ] merch payment proof upload／finalize／admin review 整合測試通過。
- [ ] shipment token create／verify／expire／consume／replay／revoke 整合測試通過。
- [ ] DB 併發、idempotency、RLS／GRANT 測試通過。
- [ ] 備份／回復／清空測試環境流程已演練。
- [ ] 記錄 CLI、Docker、Deno、Postgres 版本與測試輸出。

## 6. 檔案級 patch／審核清單

| 檔案／元件 | 預定修改 | 本階段狀態 |
|---|---|---|
| `merch-admin.html` | canonical payment/shipment selects、白名單 updateOrder、未知值處理、統計卡片 | Diff 草案，未套用 |
| `merch-admin-v2.html` | 先確認正式入口與管理者需求，再決定是否保留／補功能 | 不修改 |
| `index.html` | 不新增公開後台入口；管理後台不應放入公開導覽 | 不修改 |
| `line-customer-notify` | 驗證後從 DB 派生通知欄位、token lifecycle、event idempotency | 待隔離測試 patch |
| shipment token DB schema／RPC | hash、expiry、consume、revoke、event idempotency 與原子驗證 | 待隔離測試 migration |
| merch payment proof Storage／Function | private bucket、order-bound capability、finalize、審核與稽核 | 待隔離測試 patch |
| CI／主機／LINE／第三方 caller | 管理者盤點並提供 caller 名稱、用途、觸發條件（不可提供 Secrets） | 未確認 |

## 7. 本階段安全界線與結論

- 本階段只讀取程式碼及既有盤點結果，並建立修正與測試計畫。
- 未執行正式 DB DDL／DML、RLS／GRANT 變更。
- 未部署、停用或替換正式 Edge Function。
- 未更改 Secrets、LINE 設定或正式官網。
- 未讀取客戶訂單明細作為 caller 追查手段。
- Phase 25 不代表付款、出貨通知或後台已修復；正式修正必須等隔離整合測試及管理者核准。
