import test from 'node:test';
import assert from 'node:assert/strict';
import { inventory, statusDefinitions, summarizeInventory } from './gap-inventory.js';

test('inventory has unique IDs and complete evidence/next steps',()=>{
 const ids=inventory.map(x=>x.id);
 assert.equal(new Set(ids).size,ids.length);
 assert.ok(inventory.every(x=>x.area&&x.priority&&x.evidence.length&&x.next));
});
test('prototype and mock are not mislabeled as production complete',()=>{
 assert.equal(inventory.find(x=>x.id==='GAP-002').status,'PROTOTYPE_ONLY');
 assert.equal(inventory.find(x=>x.id==='GAP-007').status,'MOCK_ONLY');
 assert.equal(inventory.find(x=>x.id==='GAP-016').status,'NOT_INTEGRATED');
});
test('native app and store delivery evidence are explicit gaps',()=>{
 assert.equal(inventory.find(x=>x.id==='GAP-001').status,'MISSING_EVIDENCE');
 assert.equal(inventory.find(x=>x.id==='GAP-018').status,'MISSING_EVIDENCE');
});
test('inventory summary keeps release blocked',()=>{
 const result=summarizeInventory();
 assert.equal(result.total,20);
 assert.equal(result.releaseDecision,'NOT_READY');
 assert.ok(result.p0.length>0);
});
test('all status labels have definitions',()=>{
 assert.ok(inventory.every(x=>statusDefinitions[x.status]));
});
