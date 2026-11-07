import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptanceGroups, evaluateAcceptance } from './release-acceptance-matrix.js';

test('matrix covers seven core business and platform groups',()=>{
 assert.deepEqual(acceptanceGroups.map(x=>x.id),['CUSTOMER','ORDER','PAYMENT','MEMBER','ADMIN','TRUCK','PLATFORM']);
});
test('all checks start untested and release is not ready',()=>{
 const result=evaluateAcceptance();
 assert.ok(result.total>=20);
 assert.equal(result.passed,0);
 assert.equal(result.pending,result.total);
 assert.equal(result.decision,'NOT_READY');
});
test('any failed check forces NO_GO',()=>{
 const result=evaluateAcceptance({'CAT-01':true,'ORD-01':false});
 assert.equal(result.decision,'NO_GO');
 assert.equal(result.failed,1);
});
test('all passed only means manual release review, not automatic deployment',()=>{
 const results={};
 for(const group of acceptanceGroups) for(const [id] of group.checks) results[id]=true;
 const result=evaluateAcceptance(results);
 assert.equal(result.pending,0);
 assert.equal(result.failed,0);
 assert.equal(result.decision,'READY_FOR_MANUAL_RELEASE_REVIEW');
});
test('public stall price and cross-member isolation are explicitly tested',()=>{
 const all=acceptanceGroups.flatMap(x=>x.checks.map(c=>c.join(' '))).join('\n');
 assert.match(all,/擺攤價格不公開/);
 assert.match(all,/顧客 A 不得讀取顧客 B/);
});
