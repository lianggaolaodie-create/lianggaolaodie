import test from 'node:test';
import assert from 'node:assert/strict';
import { requiredEvidence, evaluateStagingGate } from './staging-approval-gate.js';

test('empty evidence fails closed',()=>{
 const result=evaluateStagingGate();
 assert.equal(result.decision,'NO_GO');
 assert.equal(result.executionAllowed,false);
 assert.equal(result.missing.length,requiredEvidence.length);
});
test('all evidence marks ready for a separate approval only',()=>{
 const evidence=Object.fromEntries(requiredEvidence.map(k=>[k,true]));
 const result=evaluateStagingGate(evidence);
 assert.equal(result.decision,'READY_FOR_SEPARATE_EXECUTION_APPROVAL');
 assert.equal(result.executionAllowed,false);
});
test('any missing or false evidence blocks the gate',()=>{
 const evidence=Object.fromEntries(requiredEvidence.map(k=>[k,true]));
 evidence.backup_and_restore_test=false;
 assert.equal(evaluateStagingGate(evidence).decision,'NO_GO');
});
test('truthy strings do not count as verified evidence',()=>{
 const evidence=Object.fromEntries(requiredEvidence.map(k=>[k,true]));
 evidence.explicit_change_approval='yes';
 assert.equal(evaluateStagingGate(evidence).decision,'NO_GO');
});
test('gate never claims to execute',()=>{
 const result=evaluateStagingGate(Object.fromEntries(requiredEvidence.map(k=>[k,true])));
 assert.equal(result.executionAllowed,false);
 assert.match(result.note,/never authorizes or executes/);
});
