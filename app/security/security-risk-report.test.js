import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSecurityRiskReport } from './security-risk-report.js';

const baseTables=['merch_products','merch_categories','flavors','daily_order_settings','daily_order_regions','daily_order_flavors','food_truck_schedules','food_truck_schedule_flavors','orders','order_items','transfer_proofs'];
function snapshot(){return {tables:baseTables.map(table=>({table,rlsEnabled:true})),policies:baseTables.map(table=>({table,name:'scoped',permissive:true,roles:['authenticated'],command:'select',using:'auth.uid() = owner_id'})),grants:[]};}

test('clean metadata returns PASS with zero risks',()=>{
 const r=buildSecurityRiskReport(snapshot(),{generatedAt:'test'});
 assert.equal(r.releaseGate,'PASS'); assert.deepEqual(r.summary,{total:0,critical:0,warning:0});
});
test('critical policy issue blocks release and contains remediation',()=>{
 const s=snapshot();s.policies.push({table:'merch_products',name:'old_all',permissive:true,roles:['authenticated'],command:'ALL',using:'true',withCheck:'true'});
 const r=buildSecurityRiskReport(s);
 assert.equal(r.releaseGate,'NO-GO');
 const f=r.findings.find(x=>x.code==='AUTHENTICATED_PERMISSIVE_ALL');
 assert.ok(f.id.startsWith('RISK-'));assert.ok(f.recommendedFix);assert.ok(f.acceptanceCriteria);
});
test('missing metadata is REVIEW and not silently passed',()=>{
 const s=snapshot();s.tables=s.tables.filter(x=>x.table!=='orders');
 const r=buildSecurityRiskReport(s);
 assert.equal(r.releaseGate,'REVIEW');
 assert.ok(r.findings.some(x=>x.code==='TABLE_METADATA_MISSING'&&x.table==='orders'));
});
test('report includes severity counts and caveat',()=>{
 const s=snapshot();s.tables[0].rlsEnabled=false;
 const r=buildSecurityRiskReport(s);
 assert.equal(r.summary.critical,1);assert.match(r.caveat,/不是即時資料庫掃描/);
});
