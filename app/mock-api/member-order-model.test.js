'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createMemberOrderStore, lookupCustomerOrder, issueGuestOrderClaim,
  registerSyntheticOrder, revokeGuestOrderClaim, syncVerifiedMember
} = require('./member-order-model');

function fixture() {
  const store = createMemberOrderStore();
  const order = registerSyntheticOrder({ store, now: 100, order: {
    orderId: 'LG-SYN-1001', ownerSubject: 'auth-user-1', status: 'confirmed',
    paymentStatus: 'confirmed', fulfillmentType: 'truck_pickup',
    itemSummary: [{ name: '水果綜合涼糕', quantity: 2 }]
  } });
  assert.equal(order.ok, true);
  return store;
}

test('member profile sync requires verified external identity', () => {
  const store = fixture();
  assert.equal(syncVerifiedMember({ store, verifiedIdentity: { subject: 'x', verified: false }, now: 1 }).reason, 'IDENTITY_NOT_VERIFIED');
  const result = syncVerifiedMember({ store, verifiedIdentity: {
    subject: 'auth-user-1', verified: true, phoneVerified: true, phoneMasked: '09**123',
    emailVerified: false, emailMasked: ''
  }, profile: { displayName: '老爹會員', ignoredAdmin: true }, now: 200 });
  assert.equal(result.ok, true);
  assert.equal(result.member.displayName, '老爹會員');
  assert.equal(Object.hasOwn(result.member, 'ignoredAdmin'), false);
});

test('member can lookup only own order with verified principal', () => {
  const store = fixture();
  const allowed = lookupCustomerOrder({ store, orderId: 'LG-SYN-1001',
    principal: { verified: true, subject: 'auth-user-1' }, now: 300 });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.order.paymentStatus, 'confirmed');
  assert.equal(lookupCustomerOrder({ store, orderId: 'LG-SYN-1001',
    principal: { verified: false, subject: 'auth-user-1' }, now: 300 }).reason, 'ORDER_ACCESS_DENIED');
  assert.equal(lookupCustomerOrder({ store, orderId: 'LG-SYN-1001',
    principal: { verified: true, subject: 'other-user' }, now: 300 }).reason, 'ORDER_ACCESS_DENIED');
});

test('order response excludes recipient personal data and internal fields', () => {
  const store = fixture();
  const order = store.orders.get('LG-SYN-1001');
  store.orders.set(order.orderId, Object.freeze({ ...order, recipientPhone: '0912345678',
    address: 'private address', internalNote: 'staff only' }));
  const result = lookupCustomerOrder({ store, orderId: order.orderId,
    principal: { verified: true, subject: 'auth-user-1' }, now: 300 });
  for (const field of ['recipientPhone', 'address', 'internalNote', 'ownerSubject']) {
    assert.equal(Object.hasOwn(result.order, field), false);
  }
});

test('guest claim permits order lookup without exposing a password or phone number', () => {
  const store = createMemberOrderStore();
  registerSyntheticOrder({ store, now: 100, order: {
    orderId: 'LG-GUEST-1', status: 'awaiting_payment', paymentStatus: 'unpaid',
    fulfillmentType: 'lianggao_store_cooling_pickup'
  } });
  const claim = issueGuestOrderClaim({ store, orderId: 'LG-GUEST-1', now: 100 });
  assert.equal(claim.ok, true);
  assert.equal(lookupCustomerOrder({ store, orderId: 'LG-GUEST-1',
    guestClaimToken: claim.token, now: 101 }).ok, true);
  assert.equal(lookupCustomerOrder({ store, orderId: 'LG-GUEST-1',
    guestClaimToken: '0'.repeat(64), now: 101 }).reason, 'ORDER_ACCESS_DENIED');
});

test('guest claim expires and can be revoked', () => {
  const store = createMemberOrderStore();
  registerSyntheticOrder({ store, now: 100, order: { orderId: 'LG-GUEST-2',
    status: 'confirmed', paymentStatus: 'confirmed', fulfillmentType: 'truck_pickup' } });
  const claim = issueGuestOrderClaim({ store, orderId: 'LG-GUEST-2', now: 100, ttlMs: 60000 });
  assert.equal(lookupCustomerOrder({ store, orderId: 'LG-GUEST-2', guestClaimToken: claim.token, now: 60100 }).reason, 'ORDER_ACCESS_DENIED');
  const second = issueGuestOrderClaim({ store, orderId: 'LG-GUEST-2', now: 100 });
  assert.equal(revokeGuestOrderClaim({ store, token: second.token, now: 101 }).ok, true);
  assert.equal(lookupCustomerOrder({ store, orderId: 'LG-GUEST-2', guestClaimToken: second.token, now: 102 }).reason, 'ORDER_ACCESS_DENIED');
});

test('guest claim TTL and order registration fail closed', () => {
  const store = createMemberOrderStore();
  assert.equal(issueGuestOrderClaim({ store, orderId: 'missing', now: 1 }).reason, 'ORDER_NOT_FOUND');
  assert.equal(issueGuestOrderClaim({ store, orderId: 'missing', now: 1, ttlMs: 1 }).reason, 'ORDER_NOT_FOUND');
  assert.equal(registerSyntheticOrder({ store, order: { orderId: 'x', status: 'bogus' }, now: 1 }).reason, 'ORDER_INVALID');
});
