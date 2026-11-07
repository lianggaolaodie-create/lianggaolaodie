/**
 * Phase 79 staging change approval gate.
 * Static gate only. Never connects to Supabase or executes changes.
 */
export const requiredEvidence = Object.freeze([
 'staging_project_identity_verified','production_staging_separation_verified',
 'prechange_schema_policy_grant_snapshot','backup_and_restore_test',
 'migration_and_rollback_reviewed','synthetic_role_test_matrix_passed',
 'application_regression_tests_passed','cost_and_billing_impact_approved',
 'named_technical_owner','explicit_change_approval'
]);
export function evaluateStagingGate(evidence={}) {
 const missing=requiredEvidence.filter(key=>evidence[key]!==true);
 return Object.freeze({
  decision:missing.length===0?'READY_FOR_SEPARATE_EXECUTION_APPROVAL':'NO_GO',
  missing,
  executionAllowed:false,
  note:'This evaluator never authorizes or executes database changes. A separate explicit approval and controlled execution process is required.'
 });
}
