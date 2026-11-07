import test from 'node:test';
import assert from 'node:assert/strict';
import { inventory, validateInventory } from './database-prechange-inventory.js';

test('inventory is complete and contains no duplicate table names',()=>assert.deepEqual(validateInventory(),{valid:true,errors:[]}));
test('known P0 merchandise policy risks are explicitly recorded',()=>{
 for (const name of ['merch_products','merch_categories']) {
  const row=inventory.find(x=>x.table===name);
  assert.equal(row.priority,'P0');
  assert.match(row.known,/permissive authenticated ALL/);
  assert.ok(row.verify.includes('USING and WITH CHECK'));
 }
});
test('private order and payment evidence require ownership and storage review',()=>{
 assert.ok(inventory.find(x=>x.table==='orders').verify.includes('owner key and guest claim linkage'));
 assert.ok(inventory.find(x=>x.table==='transfer_proofs').verify.includes('storage object path policy'));
});
test('all rows define explicit write-role targets',()=>{
 for (const row of inventory) assert.ok(Array.isArray(row.writeRoles)&&row.writeRoles.length>0);
});
