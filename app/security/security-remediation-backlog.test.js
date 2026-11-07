import test from 'node:test';
import assert from 'node:assert/strict';
import { backlog, validateBacklog } from './security-remediation-backlog.js';

test('backlog entries include owner, dependencies, acceptance and rollback',()=>assert.deepEqual(validateBacklog(),{valid:true,errors:[]}));
test('P0 merchandise policies are first and explicitly blocked pending staging',()=>{
 assert.deepEqual(backlog.slice(0,2).map(x=>x.priority),['P0','P0']);
 assert.ok(backlog.slice(0,2).every(x=>x.status==='blocked_staging'));
});
test('orders and transfer proof tasks require ownership-specific negative tests',()=>{
 assert.ok(backlog.find(x=>x.id==='SEC-003').acceptance.some(x=>x.includes('customer A')));
 assert.ok(backlog.find(x=>x.id==='SEC-004').acceptance.some(x=>x.includes('anonymous')));
});
test('no task is marked executable without separate approval',()=>{
 assert.ok(backlog.every(x=>x.status!=='ready_to_execute'));
 const bad=[{...backlog[0],status:'ready_to_execute'}];
 assert.equal(validateBacklog(bad).valid,false);
});
test('all priorities and rollback plans are defined',()=>{
 assert.ok(backlog.every(x=>['P0','P1','P2'].includes(x.priority)&&x.rollback.length>0));
});
