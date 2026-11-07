/**
 * Phase 73 remediation blueprint. Declarative metadata only; never executed.
 * No SQL, grants, policies, or production mutations are performed by this module.
 */
export const remediationPlan = Object.freeze([
  { table:'merch_products', risk:'authenticated permissive ALL may OR-bypass restrictive policies', target:'public read only for published rows; product_admin/super_admin write', operations:['select','insert','update','delete'], publicRead:true, broadAuthenticatedAll:false, requiresOwnerPredicate:true },
  { table:'merch_categories', risk:'authenticated permissive ALL may OR-bypass restrictive policies', target:'public read only for published rows; product_admin/super_admin write', operations:['select','insert','update','delete'], publicRead:true, broadAuthenticatedAll:false, requiresOwnerPredicate:false },
  { table:'orders', risk:'cross-customer disclosure or mutation', target:'customer owns row; order_admin/super_admin manage workflow', operations:['select','insert','update'], publicRead:false, broadAuthenticatedAll:false, requiresOwnerPredicate:true },
  { table:'transfer_proofs', risk:'private payment evidence exposure', target:'owner-scoped customer read; payment_admin/super_admin review', operations:['select','insert','update'], publicRead:false, broadAuthenticatedAll:false, requiresOwnerPredicate:true }
]);

export function validateRemediationPlan(plan=remediationPlan) {
  const errors=[];
  const seen=new Set();
  for (const item of plan) {
    if (!item.table || seen.has(item.table)) errors.push('missing or duplicate table');
    seen.add(item.table);
    if (item.broadAuthenticatedAll) errors.push(item.table+': broad authenticated ALL is prohibited');
    if (!Array.isArray(item.operations) || !item.operations.length) errors.push(item.table+': operations must be explicit');
    if (['orders','transfer_proofs'].includes(item.table) && !item.requiresOwnerPredicate) errors.push(item.table+': owner predicate required');
    if (!item.target || !item.risk) errors.push(item.table+': risk and target are required');
  }
  return { valid:errors.length===0, errors };
}
