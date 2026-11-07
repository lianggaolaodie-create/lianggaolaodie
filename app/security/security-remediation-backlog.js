/**
 * Phase 78 prioritized security remediation backlog.
 * Declarative planning only; no SQL or production changes.
 */
export const backlog = Object.freeze([
 {id:'SEC-001',priority:'P0',title:'Remove/replace permissive authenticated ALL on merch_products',owner:'database_security_owner',dependencies:['staging project verified','current policies and grants snapshot'],acceptance:['customer JWT cannot insert/update/delete','product_admin JWT can perform approved catalog writes','anonymous published catalog read still works'],rollback:'restore reviewed staging snapshot only after verifying it does not reintroduce broad ALL',status:'blocked_staging'},
 {id:'SEC-002',priority:'P0',title:'Remove/replace permissive authenticated ALL on merch_categories',owner:'database_security_owner',dependencies:['staging project verified','current policies and grants snapshot'],acceptance:['customer JWT cannot mutate categories','product_admin JWT can manage categories','public category reads match website needs'],rollback:'restore reviewed staging snapshot only after verifying it does not reintroduce broad ALL',status:'blocked_staging'},
 {id:'SEC-003',priority:'P1',title:'Verify order and order_items ownership isolation',owner:'auth_and_database_owner',dependencies:['owner key and guest claim model verified'],acceptance:['customer A cannot read/update customer B order','guest claim requires valid unexpired non-revoked token','authorized order_admin workflow succeeds'],rollback:'revert staging migration and rerun cross-customer denial tests',status:'blocked_staging'},
 {id:'SEC-004',priority:'P1',title:'Verify transfer proof table and private Storage policies',owner:'payment_security_owner',dependencies:['storage bucket and object path convention verified'],acceptance:['anonymous cannot list/read proof objects','customer can access only own proof','payment_admin can review only authorized proof'],rollback:'restore staging policy snapshot and rerun anonymous/foreign-owner denial tests',status:'blocked_staging'},
 {id:'SEC-005',priority:'P1',title:'Review SECURITY DEFINER functions and search_path',owner:'database_security_owner',dependencies:['function inventory and business owner review'],acceptance:['each function has documented caller and purpose','search_path is safely pinned where required','execute grants are least privilege'],rollback:'restore per-function prior definition and grants after review',status:'blocked_review'},
 {id:'SEC-006',priority:'P2',title:'Review unused tables and missing RLS policies',owner:'database_security_owner',dependencies:['table inventory and data classification'],acceptance:['each table has owner, classification and explicit access decision','unused tables are not exposed to client roles'],rollback:'restore staging policy snapshot if application regression occurs',status:'blocked_review'},
 {id:'SEC-007',priority:'P2',title:'Verify administrator role separation and audit trail',owner:'application_security_owner',dependencies:['final role matrix and JWT claim source verified'],acceptance:['each admin role limited to assigned operations','role changes auditable and super_admin only'],rollback:'restore previous staging role mapping and retest denial matrix',status:'blocked_review'}
]);

export function validateBacklog(items=backlog) {
 const errors=[], ids=new Set();
 for(const item of items){
  if(!item.id||ids.has(item.id))errors.push('missing or duplicate id');
  ids.add(item.id);
  if(!['P0','P1','P2'].includes(item.priority))errors.push(item.id+': invalid priority');
  if(!item.owner||!item.dependencies?.length||!item.acceptance?.length||!item.rollback)errors.push(item.id+': incomplete execution controls');
  if(item.status==='ready_to_execute')errors.push(item.id+': execution requires a separate explicit approval gate');
 }
 return {valid:errors.length===0,errors};
}
