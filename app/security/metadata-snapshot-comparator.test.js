import test from 'node:test';
import assert from 'node:assert/strict';
import { compareMetadataSnapshot } from './metadata-snapshot-comparator.js';

const allTables=['merch_products','merch_categories','flavors','daily_order_settings','daily_order_regions','daily_order_flavors','food_truck_schedules','food_truck_schedule_flavors','orders','order_items','transfer_proofs'];
function safeSnapshot() {
 return {
  tables:allTables.map(table=>({table,rlsEnabled:true})),
  policies:allTables.map(table=>({table,name:'scoped_select',permissive:true,roles:['authenticated'],command:'select',using:'(auth.uid() = owner_id)',withCheck:null})),
  grants:[]
 };
}

test('complete scoped metadata snapshot passes without findings',()=>{
 assert.deepEqual(compareMetadataSnapshot(safeSnapshot()),{status:'pass',findings:[]});
});
test('flags disabled RLS and missing policies as critical',()=>{
 const s=safeSnapshot(); s.tables[0].rlsEnabled=false; s.policies=s.policies.filter(p=>p.table!=='orders');
 const result=compareMetadataSnapshot(s);
 assert.ok(result.findings.some(f=>f.code==='RLS_DISABLED'&&f.table==='merch_products'));
 assert.ok(result.findings.some(f=>f.code==='NO_POLICY'&&f.table==='orders'));
 assert.equal(result.status,'critical');
});
test('detects authenticated permissive ALL on merchandise tables',()=>{
 const s=safeSnapshot(); s.policies.push({table:'merch_products',name:'legacy_all',permissive:true,roles:['authenticated'],command:'ALL',using:'true',withCheck:'true'});
 assert.ok(compareMetadataSnapshot(s).findings.some(f=>f.code==='AUTHENTICATED_PERMISSIVE_ALL'));
});
test('detects unconditional private-data policy and public write grants',()=>{
 const s=safeSnapshot();
 s.policies.push({table:'transfer_proofs',name:'open',permissive:true,roles:['authenticated'],command:'select',using:'true'});
 s.grants.push({table:'orders',grantee:'anon',privilege:'INSERT'});
 const codes=compareMetadataSnapshot(s).findings.map(f=>f.code);
 assert.ok(codes.includes('PRIVATE_TABLE_UNCONDITIONAL_POLICY'));
 assert.ok(codes.includes('PUBLIC_WRITE_GRANT'));
});
test('missing table metadata is review warning, not silently assumed safe',()=>{
 const s=safeSnapshot(); s.tables=s.tables.filter(t=>t.table!=='orders');
 const result=compareMetadataSnapshot(s);
 assert.equal(result.status,'review');
 assert.ok(result.findings.some(f=>f.code==='TABLE_METADATA_MISSING'&&f.table==='orders'));
});
