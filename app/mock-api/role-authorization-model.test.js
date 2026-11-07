import test from 'node:test';
import assert from 'node:assert/strict';
import { authorize, listPermissions } from './role-authorization-model.js';

test('unknown role and unknown action fail closed', () => {
  assert.equal(authorize('root', 'catalog.manage').reason, 'UNKNOWN_ROLE');
  assert.equal(authorize('super_admin', 'delete.everything').reason, 'UNKNOWN_ACTION');
});

test('customer can read public catalog and own order only', () => {
  assert.equal(authorize('customer', 'public.catalog.read').allowed, true);
  assert.equal(authorize('customer', 'customer.order.read.self', { subjectId:'a', ownerId:'a' }).allowed, true);
  assert.equal(authorize('customer', 'customer.order.read.self', { subjectId:'a', ownerId:'b' }).reason, 'OWNER_MISMATCH');
  assert.equal(authorize('customer', 'customer.order.read.other', { subjectId:'a', ownerId:'b' }).reason, 'SELF_ONLY');
});

test('guest order requires a valid claim', () => {
  assert.equal(authorize('customer', 'guest.order.claim.read', { validGuestClaim:false }).reason, 'INVALID_GUEST_CLAIM');
  assert.equal(authorize('customer', 'guest.order.claim.read', { validGuestClaim:true }).allowed, true);
});

test('product admin can manage catalog but cannot manage orders or payments', () => {
  assert.equal(authorize('product_admin', 'catalog.manage').allowed, true);
  assert.equal(authorize('product_admin', 'daily_menu.manage').allowed, true);
  assert.equal(authorize('product_admin', 'order.manage').allowed, false);
  assert.equal(authorize('product_admin', 'payment.review').allowed, false);
});

test('order admin can manage fulfillment but cannot review payments or read personal data', () => {
  assert.equal(authorize('order_admin', 'order.manage').allowed, true);
  assert.equal(authorize('order_admin', 'fulfillment.manage').allowed, true);
  assert.equal(authorize('order_admin', 'payment.review').allowed, false);
  assert.equal(authorize('order_admin', 'personal_data.read').allowed, false);
});

test('payment admin can review payment but cannot fulfill orders', () => {
  assert.equal(authorize('payment_admin', 'payment.review').allowed, true);
  assert.equal(authorize('payment_admin', 'fulfillment.manage').allowed, false);
});

test('personal data admin cannot alter catalog, payment or fulfillment', () => {
  assert.equal(authorize('personal_data_admin', 'personal_data.read').allowed, true);
  assert.equal(authorize('personal_data_admin', 'catalog.manage').allowed, false);
  assert.equal(authorize('personal_data_admin', 'payment.review').allowed, false);
  assert.equal(authorize('personal_data_admin', 'fulfillment.manage').allowed, false);
});

test('only super admin can manage security roles', () => {
  assert.equal(authorize('super_admin', 'security.roles.manage').allowed, true);
  for (const role of ['customer','product_admin','order_admin','payment_admin','personal_data_admin']) {
    assert.equal(authorize(role, 'security.roles.manage').allowed, false);
  }
});

test('permission list is deterministic and unknown role returns empty list', () => {
  assert.deepEqual(listPermissions('product_admin'), ['catalog.manage','daily_menu.manage','public.catalog.read']);
  assert.deepEqual(listPermissions('not-a-role'), []);
});
