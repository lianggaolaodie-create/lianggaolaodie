/**
 * Phase 80: generate review-only SQL package skeletons.
 * Output is intentionally non-executable until verified identifiers and predicates
 * are supplied by a database owner. This module never connects to a database.
 */
const tasks = [
 {id:'SEC-001',table:'public.merch_products',goal:'Replace broad authenticated ALL access with least-privilege product-admin writes.'},
 {id:'SEC-002',table:'public.merch_categories',goal:'Replace broad authenticated ALL access with least-privilege category-admin writes.'},
 {id:'SEC-003',table:'public.orders',goal:'Enforce verified customer ownership and separately scoped admin access.'},
 {id:'SEC-004',table:'public.transfer_proofs',goal:'Enforce private proof access by verified order ownership and payment-admin role.'}
];
const sqlQuote = value => String(value).replace(/'/g,"''");
export function generateReviewPackage(items=tasks) {
 return items.map(item=>{
  const header=[
   '-- REVIEW-ONLY DRAFT; NOT APPROVED FOR EXECUTION.',
   '-- Confirm staging project identity and schema snapshot before editing.',
   '-- Replace every <PLACEHOLDER> with reviewed, verified identifiers/predicates.',
   '-- Do not run this file as-is. No production execution is authorized.',
   '-- Target: '+item.table,
   '-- Objective: '+item.goal
  ].join('\n');
  const migration=[
   header,
   '-- 1) Capture current policy/grant definitions outside this draft.',
   '-- 2) Have the database owner identify exact policy names and validated admin predicate.',
   '-- 3) Draft explicit DROP POLICY statements only after exact-name review.',
   '-- DROP POLICY <VERIFIED_POLICY_NAME> ON '+item.table+';',
   '-- 4) Draft separate SELECT / INSERT / UPDATE / DELETE policies.',
   '-- CREATE POLICY <VERIFIED_POLICY_NAME> ON '+item.table+' FOR <COMMAND>',
   '--   TO <VERIFIED_ROLE> USING (<VERIFIED_ROW_PREDICATE>)',
   '--   WITH CHECK (<VERIFIED_WRITE_PREDICATE>);',
   '-- 5) Never use unconditional true for private rows or authenticated ALL.',
   '-- 6) Review GRANT / REVOKE separately; do not blanket revoke function privileges.'
  ].join('\n');
  const rollback=[
   header,
   '-- ROLLBACK PLAN ONLY; do not restore a permissive policy blindly.',
   '-- Restore only the exact pre-change definitions from a verified staging snapshot.',
   '-- CREATE POLICY <VERIFIED_PRIOR_POLICY_NAME> ON '+item.table,
   '--   FOR <VERIFIED_COMMAND> TO <VERIFIED_ROLE>',
   '--   USING (<VERIFIED_PRIOR_PREDICATE>)',
   '--   WITH CHECK (<VERIFIED_PRIOR_CHECK_PREDICATE>);',
   '-- Re-run anonymous, cross-customer, owner, admin, and public-read tests.',
   '-- Stop if rollback would reintroduce broad authenticated ALL or public private-data access.'
  ].join('\n');
  return Object.freeze({id:item.id,table:item.table,objective:item.goal,migrationDraft:migration,rollbackDraft:rollback,executable:false,requiresHumanReview:true});
 });
}
export function validateReviewPackage(pkg=generateReviewPackage()) {
 const errors=[];
 for(const item of pkg){
  if(item.executable!==false) errors.push(item.id+': package must remain non-executable');
  if(!item.requiresHumanReview) errors.push(item.id+': human review missing');
  if(!item.migrationDraft.includes('NOT APPROVED FOR EXECUTION')) errors.push(item.id+': migration warning missing');
  if(!item.rollbackDraft.includes('ROLLBACK PLAN ONLY')) errors.push(item.id+': rollback warning missing');
  if(!item.migrationDraft.includes('<VERIFIED_')&&!item.migrationDraft.includes('<PLACEHOLDER>')) errors.push(item.id+': verified placeholders missing');
  if(/\bCOMMIT\s*;/i.test(item.migrationDraft)) errors.push(item.id+': unexpected COMMIT');
 }
 return {valid:errors.length===0,errors};
}
