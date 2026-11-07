import test from 'node:test';
import assert from 'node:assert/strict';
import { remediationPlan, validateRemediationPlan } from './rls-remediation-plan.js';

test('remediation plan is valid and explicitly scoped', () => {
  assert.deepEqual(validateRemediationPlan(), {valid:true,errors:[]});
  assert.equal(remediationPlan.length,4);
});

test('merchandise remediation prohibits broad authenticated ALL', () => {
  for (const row of remediationPlan.filter(x=>x.table.startsWith('merch_'))) {
    assert.equal(row.broadAuthenticatedAll,false);
    assert.equal(row.publicRead,true);
    assert.ok(row.operations.includes('insert') && row.operations.includes('update') && row.operations.includes('delete'));
  }
});

test('private rows require owner scoping', () => {
  for (const row of remediationPlan.filter(x=>['orders','transfer_proofs'].includes(x.table))) {
    assert.equal(row.requiresOwnerPredicate,true);
    assert.equal(row.publicRead,false);
  }
});

test('validator rejects unsafe broad policy and missing owner predicate', () => {
  const unsafe=[
    {table:'merch_products',risk:'x',target:'x',operations:['all'],publicRead:true,broadAuthenticatedAll:true,requiresOwnerPredicate:false},
    {table:'orders',risk:'x',target:'x',operations:['select'],publicRead:false,broadAuthenticatedAll:false,requiresOwnerPredicate:false}
  ];
  const result=validateRemediationPlan(unsafe);
  assert.equal(result.valid,false);
  assert.equal(result.errors.length,2);
});
