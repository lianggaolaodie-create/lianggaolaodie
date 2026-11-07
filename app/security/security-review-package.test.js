import test from 'node:test';
import assert from 'node:assert/strict';
import { generateReviewPackage, validateReviewPackage } from './security-review-package.js';

test('generates four separate review-only packages',()=>{
 const pkg=generateReviewPackage();
 assert.deepEqual(pkg.map(x=>x.id),['SEC-001','SEC-002','SEC-003','SEC-004']);
 assert.equal(validateReviewPackage(pkg).valid,true);
});
test('each target includes separate migration and rollback drafts',()=>{
 for(const item of generateReviewPackage()){
  assert.ok(item.migrationDraft.includes(item.table));
  assert.ok(item.rollbackDraft.includes(item.table));
  assert.notEqual(item.migrationDraft,item.rollbackDraft);
 }
});
test('drafts remain blocked and contain explicit placeholders',()=>{
 for(const item of generateReviewPackage()){
  assert.equal(item.executable,false);
  assert.equal(item.requiresHumanReview,true);
  assert.ok(item.migrationDraft.includes('<VERIFIED_')||item.migrationDraft.includes('<PLACEHOLDER>'));
 }
});
test('does not include unconditional true or commit statements',()=>{
 for(const item of generateReviewPackage()){
  assert.doesNotMatch(item.migrationDraft,/\bCOMMIT\s*;/i);
  assert.doesNotMatch(item.migrationDraft,/USING\s*\(\s*true\s*\)/i);
 }
});
test('rejects any package marked executable',()=>{
 const pkg=generateReviewPackage().map((x,i)=>i===0?{...x,executable:true}:x);
 assert.equal(validateReviewPackage(pkg).valid,false);
});
