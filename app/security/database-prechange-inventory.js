/**
 * Phase 74 database pre-change inventory.
 * Known table names are based on prior read-only schema notes.
 * Unknown columns/policies are intentionally not guessed.
 */
export const inventory = Object.freeze([
 {table:'flavors',priority:'P1',purpose:'涼糕口味主檔',known:'36 rows observed in prior read-only audit',verify:['columns and constraints','RLS enabled','all policies and policy roles','table grants','indexes','foreign keys'],writeRoles:['product_admin','super_admin']},
 {table:'daily_order_settings',priority:'P1',purpose:'每日線上開單設定',known:'daily order settings family',verify:['columns and constraints','RLS enabled','all policies and policy roles','table grants','indexes','foreign keys'],writeRoles:['product_admin','super_admin']},
 {table:'daily_order_regions',priority:'P1',purpose:'每日開單服務區域',known:'daily order settings family',verify:['columns and constraints','RLS enabled','all policies and policy roles','table grants','indexes','foreign keys'],writeRoles:['product_admin','super_admin']},
 {table:'daily_order_flavors',priority:'P1',purpose:'每日開單口味與價格快照',known:'daily flavor price snapshots observed',verify:['columns and constraints','RLS enabled','all policies and policy roles','table grants','indexes','foreign keys'],writeRoles:['product_admin','super_admin']},
 {table:'food_truck_schedules',priority:'P1',purpose:'餐車排程',known:'schedule table observed; no address/lat/long fields seen in prior audit',verify:['columns and constraints','RLS enabled','all policies and policy roles','table grants','indexes','foreign keys'],writeRoles:['product_admin','super_admin']},
 {table:'food_truck_schedule_flavors',priority:'P1',purpose:'餐車排程口味與價格',known:'schedule flavor table observed',verify:['columns and constraints','RLS enabled','all policies and policy roles','table grants','indexes','foreign keys'],writeRoles:['product_admin','super_admin']},
 {table:'merch_products',priority:'P0',purpose:'周邊商品',known:'prior audit found permissive authenticated ALL policy risk',verify:['every permissive/restrictive policy','USING and WITH CHECK','table grants','RLS enabled','published visibility predicate','frontend compatibility'],writeRoles:['product_admin','super_admin']},
 {table:'merch_categories',priority:'P0',purpose:'周邊分類',known:'prior audit found permissive authenticated ALL policy risk',verify:['every permissive/restrictive policy','USING and WITH CHECK','table grants','RLS enabled','published visibility predicate','frontend compatibility'],writeRoles:['product_admin','super_admin']},
 {table:'orders',priority:'P1',purpose:'訂單主檔',known:'exact current policy/columns not reconfirmed in this phase',verify:['owner key and guest claim linkage','all policies','table grants','RLS enabled','status transition writers','indexes and foreign keys'],writeRoles:['order_admin','super_admin']},
 {table:'order_items',priority:'P1',purpose:'訂單明細',known:'exact current policy/columns not reconfirmed in this phase',verify:['parent order ownership propagation','all policies','table grants','RLS enabled','snapshot fields'],writeRoles:['order_admin','super_admin']},
 {table:'transfer_proofs',priority:'P1',purpose:'匯款證明',known:'private storage bucket also exists',verify:['all policies','table grants','RLS enabled','owner/order linkage','storage object path policy','payment review audit trail'],writeRoles:['payment_admin','super_admin']}
]);

export function validateInventory(rows=inventory) {
 const errors=[];
 const names=new Set();
 for (const row of rows) {
  if (!row.table || names.has(row.table)) errors.push('missing or duplicate table');
  names.add(row.table);
  if (!row.purpose || !row.priority || !Array.isArray(row.verify) || row.verify.length===0) errors.push(row.table+': incomplete inventory');
  if (row.priority==='P0' && !row.known.includes('risk')) errors.push(row.table+': P0 risk note missing');
  if (row.verify.some(x=>/execute|apply|deploy|write production/i.test(x))) errors.push(row.table+': inventory must remain read-only');
 }
 return {valid:errors.length===0,errors};
}
