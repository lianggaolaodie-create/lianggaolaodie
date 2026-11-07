/**
 * Phase 76: compare exported PostgreSQL metadata snapshots against target controls.
 * Pure function over caller-supplied metadata; no database connectivity or writes.
 */
const PRIVATE_TABLES = new Set(['orders','order_items','transfer_proofs']);
const ADMIN_ONLY_TABLES = new Set(['merch_products','merch_categories','flavors','daily_order_settings','daily_order_regions','daily_order_flavors','food_truck_schedules','food_truck_schedule_flavors']);
const TARGET_TABLES = [...ADMIN_ONLY_TABLES,'orders','order_items','transfer_proofs'];

function norm(value) { return String(value ?? '').trim().toLowerCase(); }
function roles(policy) { return (policy.roles || []).map(norm); }

export function compareMetadataSnapshot(snapshot) {
  const findings=[];
  const tables=new Map((snapshot.tables || []).map(t=>[norm(t.table),t]));
  const policies=snapshot.policies || [];
  const grants=snapshot.grants || [];

  for (const name of TARGET_TABLES) {
    const table=tables.get(name);
    if (!table) {
      findings.push({severity:'warning',code:'TABLE_METADATA_MISSING',table:name,message:'未提供資料表 metadata，無法判定 RLS 狀態。'});
      continue;
    }
    if (table.rlsEnabled !== true) findings.push({severity:'critical',code:'RLS_DISABLED',table:name,message:'目標資料表未確認啟用 RLS。'});
    const tablePolicies=policies.filter(p=>norm(p.table)===name);
    if (tablePolicies.length===0) findings.push({severity:'critical',code:'NO_POLICY',table:name,message:'未提供任何 RLS policy。'});
    for (const p of tablePolicies) {
      const pRoles=roles(p);
      const command=norm(p.command);
      const predicate=norm([p.using,p.withCheck].filter(Boolean).join(' '));
      if (p.permissive !== false && pRoles.includes('authenticated') && (command==='all' || command==='*')) {
        findings.push({severity:'critical',code:'AUTHENTICATED_PERMISSIVE_ALL',table:name,policy:p.name || 'unnamed',message:'authenticated permissive ALL 可能與其他 permissive policy 以 OR 合併。'});
      }
      if (PRIVATE_TABLES.has(name) && p.permissive !== false && (predicate==='true' || predicate==='(true)')) {
        findings.push({severity:'critical',code:'PRIVATE_TABLE_UNCONDITIONAL_POLICY',table:name,policy:p.name || 'unnamed',message:'私人資料 policy 使用無條件 true predicate。'});
      }
      if (ADMIN_ONLY_TABLES.has(name) && pRoles.includes('authenticated') && command!=='select' && command!=='all' && !predicate) {
        findings.push({severity:'warning',code:'ADMIN_WRITE_PREDICATE_MISSING',table:name,policy:p.name || 'unnamed',message:'管理寫入 policy 缺少可檢視的 predicate。'});
      }
    }
    for (const g of grants.filter(x=>norm(x.table)===name)) {
      const grantee=norm(g.grantee), privilege=norm(g.privilege);
      if (['anon','public'].includes(grantee) && ['insert','update','delete','truncate','all privileges'].includes(privilege)) {
        findings.push({severity:'critical',code:'PUBLIC_WRITE_GRANT',table:name,grantee,privilege,message:'匿名或 PUBLIC 角色具有寫入類 table grant。'});
      }
      if (ADMIN_ONLY_TABLES.has(name) && grantee==='authenticated' && ['insert','update','delete','all privileges'].includes(privilege)) {
        findings.push({severity:'warning',code:'AUTHENTICATED_WRITE_GRANT_REVIEW',table:name,privilege,message:'authenticated 寫入 grant 需與 RLS policy 一併核對。'});
      }
    }
  }
  return {
    status: findings.some(f=>f.severity==='critical')?'critical':findings.length?'review':'pass',
    findings
  };
}
