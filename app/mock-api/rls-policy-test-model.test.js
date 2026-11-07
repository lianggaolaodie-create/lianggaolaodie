import test from 'node:test';
import assert from 'node:assert/strict';
import { canSelect, canWrite, expectedPolicyMatrix } from './rls-policy-test-model.js';

test('customer can only select own order and order items', () => {
  assert.equal(canSelect({table:'orders',role:'customer',subjectId:'a',ownerId:'a'}), true);
  assert.equal(canSelect({table:'order_items',role:'customer',subjectId:'a',ownerId:'b'}), false);
});

test('anonymous cannot select private payment proofs', () => {
  assert.equal(canSelect({table:'transfer_proofs',role:'anon'}), false);
});

test('customer cannot insert or update merchandise rows', () => {
  for (const operation of ['insert','update','delete']) {
    assert.equal(canWrite({table:'merch_products',role:'customer',operation}), false);
    assert.equal(canWrite({table:'merch_categories',role:'customer',operation}), false);
  }
});

test('product admin can manage catalog but not orders or payment proofs', () => {
  assert.equal(canWrite({table:'flavors',role:'product_admin'}), true);
  assert.equal(canWrite({table:'merch_products',role:'product_admin'}), true);
  assert.equal(canWrite({table:'orders',role:'product_admin'}), false);
  assert.equal(canWrite({table:'transfer_proofs',role:'product_admin'}), false);
});

test('order admin can manage orders but not catalog or payment proofs', () => {
  assert.equal(canWrite({table:'orders',role:'order_admin'}), true);
  assert.equal(canWrite({table:'merch_products',role:'order_admin'}), false);
  assert.equal(canWrite({table:'transfer_proofs',role:'order_admin'}), false);
});

test('payment admin can review proofs but cannot manage catalog or fulfillment', () => {
  assert.equal(canWrite({table:'transfer_proofs',role:'payment_admin'}), true);
  assert.equal(canWrite({table:'flavors',role:'payment_admin'}), false);
  assert.equal(canWrite({table:'orders',role:'payment_admin'}), false);
});

test('personal data admin may read permitted order records but cannot write them', () => {
  assert.equal(canSelect({table:'orders',role:'personal_data_admin'}), true);
  assert.equal(canWrite({table:'orders',role:'personal_data_admin'}), false);
});

test('public reads do not grant writes', () => {
  assert.equal(canSelect({table:'merch_products',role:'anon',isPublic:true}), true);
  assert.equal(canWrite({table:'merch_products',role:'anon'}), false);
});

test('unknown table and role fail closed', () => {
  assert.equal(canSelect({table:'secret_table',role:'super_admin'}), false);
  assert.equal(canWrite({table:'secret_table',role:'super_admin'}), false);
  assert.equal(canWrite({table:'flavors',role:'unknown'}), false);
});

test('expected policy matrix is fully satisfied', () => {
  assert.deepEqual(Object.values(expectedPolicyMatrix()), Array(9).fill(true));
});
