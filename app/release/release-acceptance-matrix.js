/**
 * Phase 81: cross-workflow release acceptance matrix.
 * Static readiness checks only; no production traffic, credentials or data.
 */
export const acceptanceGroups = Object.freeze([
 {id:'CUSTOMER',name:'顧客端與商品',checks:[
  ['CAT-01','商品列表可讀取且內容正確','商品目錄與官網資料一致'],
  ['CAT-02','商品口味、價格及停售狀態正確','價格依銷售情境顯示'],
  ['CAT-03','餐車價格可顯示、擺攤價格不公開','公開頁面不得洩漏擺攤價']
 ]},
 {id:'ORDER',name:'購物車與訂單',checks:[
  ['ORD-01','購物車數量與金額計算正確','小計、運費、總額一致'],
  ['ORD-02','線上與臨時下單分流正確','每位客人有唯一訂單編號'],
  ['ORD-03','重複送出不產生重複訂單','冪等鍵及重複請求測試通過'],
  ['ORD-04','訂單查詢只能看到本人訂單','顧客 A 不得讀取顧客 B']
 ]},
 {id:'PAYMENT',name:'付款與匯款證明',checks:[
  ['PAY-01','付款狀態以伺服器驗證結果為準','前端不得自行標記已付款'],
  ['PAY-02','匯款證明採私有儲存及授權讀取','匿名與跨會員讀取拒絕'],
  ['PAY-03','退款及付款異常有稽核流程','不得以測試流程觸發真實金流']
 ]},
 {id:'MEMBER',name:'會員與通知',checks:[
  ['MEM-01','登入、登出及權限到期正確','無效或過期 session 拒絕'],
  ['MEM-02','會員個資及訂單權限隔離','跨會員讀取／修改拒絕'],
  ['MEM-03','通知只送達授權對象','避免訊息 payload 洩漏個資']
 ]},
 {id:'ADMIN',name:'老闆後台',checks:[
  ['ADM-01','管理員角色與職責分離','非管理員不可進入管理操作'],
  ['ADM-02','商品、口味、每日菜單可正確管理','更新後網站與 App 資料一致'],
  ['ADM-03','訂單、付款、出貨及庫存狀態可追蹤','每次變更保留操作者與時間']
 ]},
 {id:'TRUCK',name:'餐車、擺攤與 PDA',checks:[
  ['OPS-01','餐車日期、地區、時間與口味正確','餐車價格可依設定顯示'],
  ['OPS-02','擺攤資訊可獨立管理','擺攤公開資訊不顯示價格'],
  ['OPS-03','訂單可產生 PDA 作業資料','掃碼與狀態更新不重複']
 ]},
 {id:'PLATFORM',name:'手機、網站與上線',checks:[
  ['UX-01','iPhone Safari 版面與操作正常','按鈕、表單、圖片及導覽可用'],
  ['UX-02','API 錯誤、離線及載入狀態清楚','不顯示假成功狀態'],
  ['REL-01','備份、監控、回復及隱私告知完成','正式上線核准與版本回復演練']
 ]}
]);
export function evaluateAcceptance(results={}) {
 const checks=acceptanceGroups.flatMap(group=>group.checks.map(([id,title,criterion])=>({
  id,group:group.id,title,criterion,status:results[id]===true?'PASS':results[id]===false?'FAIL':'NOT_TESTED'
 })));
 const failed=checks.filter(x=>x.status==='FAIL');
 const pending=checks.filter(x=>x.status==='NOT_TESTED');
 return Object.freeze({
  total:checks.length,passed:checks.length-failed.length-pending.length,
  failed:failed.length,pending:pending.length,
  decision:failed.length?'NO_GO':pending.length?'NOT_READY':'READY_FOR_MANUAL_RELEASE_REVIEW',
  checks
 });
}
