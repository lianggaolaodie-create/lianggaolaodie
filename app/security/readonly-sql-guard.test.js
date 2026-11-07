import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateReadOnlyInventorySql } from './readonly-sql-guard.js';

const sql=await readFile(new URL('./phase-75-staging-metadata-inventory.sql',import.meta.url),'utf8');

test('Phase 75 SQL is wrapped in READ ONLY transaction and rolled back',()=>assert.deepEqual(validateReadOnlyInventorySql(sql),{valid:true,errors:[]}));
test('guard rejects mutation statements',()=>{
 const unsafe='BEGIN TRANSACTION READ ONLY; SELECT 1; DROP TABLE public.orders; ROLLBACK;';
 assert.equal(validateReadOnlyInventorySql(unsafe).valid,false);
});
test('guard rejects missing read-only wrapper or rollback',()=>{
 assert.equal(validateReadOnlyInventorySql('SELECT 1;').valid,false);
});
test('inventory SQL reads metadata views/catalog only for business tables',()=>{
 assert.match(sql,/FROM pg_policies/);
 assert.match(sql,/information_schema\.columns/);
 assert.doesNotMatch(sql,/SELECT\s+\*\s+FROM\s+public\.(orders|order_items|transfer_proofs)/i);
});
