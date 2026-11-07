/**
 * Phase 77: turn metadata comparison findings into an actionable report.
 * This consumes caller-supplied snapshot metadata; no DB connection or writes.
 */
const remediation = {
 RLS_DISABLED:{action:'在 staging 確認資料表用途與公開需求後啟用 RLS',acceptance:'RLS enabled；匿名與非授權 JWT 的負向測試均拒絕'},
 NO_POLICY:{action:'依資料分類設計明確 SELECT／INSERT／UPDATE／DELETE policies',acceptance:'每個角色正向與負向 JWT 測試符合最小權限'},
 TABLE_METADATA_MISSING:{action:'重新匯出該表 metadata，不得假設安全',acceptance:'完整取得 table、RLS、policy、grant metadata'},
 AUTHENTICATED_PERMISSIVE_ALL:{action:'逐條審查並替換寬鬆 authenticated ALL policy；確認 permissive OR 合併影響',acceptance:'一般 authenticated 無法寫入；指定管理角色可依職責操作'},
 PRIVATE_TABLE_UNCONDITIONAL_POLICY:{action:'改為 owner／授權角色條件，並檢查 USING 與 WITH CHECK',acceptance:'跨會員讀取／修改皆拒絕；本人合法操作通過'},
 PUBLIC_WRITE_GRANT:{action:'核對 PUBLIC／anon 寫入 grant 與必要功能，制定最小權限調整',acceptance:'匿名寫入被資料庫拒絕，必要公開讀取仍正常'},
 AUTHENTICATED_WRITE_GRANT_REVIEW:{action:'逐項核對 table grant 與 RLS；不要只看 grant 或只看 policy',acceptance:'非管理 JWT 寫入拒絕，授權管理 JWT 通過'},
 ADMIN_WRITE_PREDICATE_MISSING:{action:'確認可信 server-side role predicate 與欄位名稱',acceptance:'非指定角色寫入拒絕，管理角色限定操作通過'}
};

export function buildSecurityRiskReport(snapshot, {generatedAt='not-specified'}={}) {
 const comparison = (awaitlessCompare)(snapshot);
 const findings = comparison.findings.map((finding,index)=>({
  id:'RISK-'+String(index+1).padStart(3,'0'),
  severity:finding.severity,
  code:finding.code,
  table:finding.table,
  policy:finding.policy || null,
  title:finding.message,
  recommendedFix:remediation[finding.code]?.action || '人工檢視 metadata 並定義最小權限政策',
  acceptanceCriteria:remediation[finding.code]?.acceptance || '在獨立 staging 以真實 JWT 執行正反向測試'
 }));
 const counts = findings.reduce((a,f)=>(a[f.severity]=(a[f.severity]||0)+1,a),{critical:0,warning:0});
 return {
  generatedAt,
  status:comparison.status,
  summary:{total:findings.length,...counts},
  releaseGate:counts.critical>0?'NO-GO':findings.length?'REVIEW':'PASS',
  findings,
  caveat:'此報告只根據提供的 metadata snapshot；不是即時資料庫掃描，也不代表已修補。'
 };
}

// Kept local to avoid duplicating comparison logic or external dependencies.
function awaitlessCompare(snapshot) {
 const tables = new Map((snapshot.tables||[]).map(t=>[String(t.table||'').toLowerCase(),t]));
 const policies=snapshot.policies||[], grants=snapshot.grants||[];
 const privateTables=new Set(['orders','order_items','transfer_proofs']);
 const adminTables=new Set(['merch_products','merch_categories','flavors','daily_order_settings','daily_order_regions','daily_order_flavors','food_truck_schedules','food_truck_schedule_flavors']);
 const targets=[...adminTables,'orders','order_items','transfer_proofs'];
 const findings=[];
 for(const name of targets){
  const table=tables.get(name);
  if(!table){findings.push({severity:'warning',code:'TABLE_METADATA_MISSING',table:name,message:'未提供資料表 metadata，無法判定 RLS 狀態。'});continue;}
  if(table.rlsEnabled!==true)findings.push({severity:'critical',code:'RLS_DISABLED',table:name,message:'目標資料表未確認啟用 RLS。'});
  const ps=policies.filter(p=>String(p.table||'').toLowerCase()===name);
  if(!ps.length)findings.push({severity:'critical',code:'NO_POLICY',table:name,message:'未提供任何 RLS policy。'});
  for(const p of ps){
   const rs=(p.roles||[]).map(x=>String(x).toLowerCase()), cmd=String(p.command||'').toLowerCase();
   const pred=[p.using,p.withCheck].filter(Boolean).join(' ').trim().toLowerCase();
   if(p.permissive!==false&&rs.includes('authenticated')&&(cmd==='all'||cmd==='*'))findings.push({severity:'critical',code:'AUTHENTICATED_PERMISSIVE_ALL',table:name,policy:p.name,message:'authenticated permissive ALL 可能與其他 permissive policy 以 OR 合併。'});
   if(privateTables.has(name)&&p.permissive!==false&&(pred==='true'||pred==='(true)'))findings.push({severity:'critical',code:'PRIVATE_TABLE_UNCONDITIONAL_POLICY',table:name,policy:p.name,message:'私人資料 policy 使用無條件 true predicate。'});
   if(adminTables.has(name)&&rs.includes('authenticated')&&!['select','all'].includes(cmd)&&!pred)findings.push({severity:'warning',code:'ADMIN_WRITE_PREDICATE_MISSING',table:name,policy:p.name,message:'管理寫入 policy 缺少可檢視的 predicate。'});
  }
  for(const g of grants.filter(x=>String(x.table||'').toLowerCase()===name)){
   const grantee=String(g.grantee||'').toLowerCase(), privilege=String(g.privilege||'').toLowerCase();
   if(['anon','public'].includes(grantee)&&['insert','update','delete','truncate','all privileges'].includes(privilege))findings.push({severity:'critical',code:'PUBLIC_WRITE_GRANT',table:name,grantee,privilege,message:'匿名或 PUBLIC 角色具有寫入類 table grant。'});
   if(adminTables.has(name)&&grantee==='authenticated'&&['insert','update','delete','all privileges'].includes(privilege))findings.push({severity:'warning',code:'AUTHENTICATED_WRITE_GRANT_REVIEW',table:name,privilege,message:'authenticated 寫入 grant 需與 RLS policy 一併核對。'});
  }
 }
 return {status:findings.some(f=>f.severity==='critical')?'critical':findings.length?'review':'pass',findings};
}
