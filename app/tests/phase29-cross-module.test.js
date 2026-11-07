'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const phase22 = require('./phase22-security');
const phase24 = require('./phase24-crypto-and-proof');

test('通用付款狀態與 merch_orders 資料表狀態是不同邊界', () => {
  assert.equal(phase22.canTransitionPayment('proof_submitted', 'reviewing'), true);
  assert.equal(phase24.canTransitionMerchPayment('proof_submitted', 'reviewing'), false);
  assert.equal(phase22.canTransitionPayment('confirmed', 'refunded'), true);
  assert.equal(phase24.canTransitionMerchPayment('confirmed', 'refunded'), false);
});

test('merch_orders 只接受資料表 canonical payment states', () => {
  for (const state of ['unpaid', 'proof_submitted', 'confirmed', 'rejected']) {
    assert.notEqual(phase24.normalizeLegacyMerchAdminPayment(state).status, 'unknown');
  }
  for (const state of ['reviewing', 'cancelled', 'refunded', 'pending_review']) {
    assert.equal(phase24.normalizeLegacyMerchAdminPayment(state).needsReview, true);
  }
});

test('退款不可偽裝成付款審核狀態', () => {
  const result = phase24.normalizeLegacyMerchAdminPayment('refunded');
  assert.deepEqual(result, { status: 'unsupported_refund', needsReview: true, source: 'refunded' });
  assert.equal(phase24.canTransitionMerchPayment('confirmed', 'refunded'), false);
});

test('merch shipment 狀態與已知 DB CHECK 值一致', () => {
  for (const state of ['unprepared', 'preparing', 'shipped', 'delivered']) {
    assert.equal(phase24.isAllowedMerchShipmentStatus(state), true);
  }
  for (const state of ['pending', 'processing', 'completed', 'cancelled']) {
    assert.equal(phase24.isAllowedMerchShipmentStatus(state), false);
  }
});

test('付款證明提交不等於付款核准', () => {
  const result = phase24.finalizeProof({
    objectExists: true, capabilityValid: true, orderMatches: true,
    nowMs: 100, expiresAtMs: 200, consumedAtMs: null,
    mimeType: 'image/jpeg', sizeBytes: 100, maxBytes: 1000,
    eventId: 'synthetic-proof-event-0001', processedEventIds: new Set(),
    paymentStatus: 'unpaid'
  });
  assert.equal(result.ok, true);
  assert.equal(result.paymentStatus, 'proof_submitted');
  assert.equal(phase24.canTransitionMerchPayment(result.paymentStatus, 'confirmed'), true);
  assert.equal(phase24.canTransitionMerchPayment('unpaid', 'confirmed'), false);
});

test('通用付款 helper 仍不可取代 merch_orders adapter', () => {
  assert.equal(phase22.normalizeLegacyMerchPayment('paid').status, 'confirmed');
  assert.equal(phase24.normalizeLegacyMerchAdminPayment('paid').status, 'confirmed');
  assert.equal(phase22.normalizeLegacyMerchPayment('refunded').status, 'refunded');
  assert.equal(phase24.normalizeLegacyMerchAdminPayment('refunded').status, 'unsupported_refund');
});

test('shipment 通知 payload 必須以已驗證訂單資料為準', () => {
  const result = phase22.buildShipmentNotification({
    verifiedOrder: {
      tokenAuthorized: true,
      eventId: 'synthetic-event-0000001',
      recipient: 'fake-line-recipient',
      order: { order_number: 'FAKE-ORDER-001', pickup_type: 'cold_store', pickup_store: '虛構門市' }
    },
    requestBody: { recipient: 'attacker', order_number: 'FORGED', pickup_store: '假門市' }
  });
  assert.equal(result.ok, true);
  assert.equal(result.recipient, 'fake-line-recipient');
  assert.equal(result.orderNumber, 'FAKE-ORDER-001');
  assert.equal(result.pickupStore, '虛構門市');
});

test('HMAC 驗證需要可信 secret 且簽章綁定訂單與事件', () => {
  const fields = {
    method: 'POST',
    path: '/functions/v1/synthetic-notify',
    timestamp: '2026-11-08T02:00:00.000Z',
    eventId: 'synthetic-event-0000001',
    orderId: 'synthetic-order-001',
    token: 'synthetic-one-time-token'
  };
  const secret = 'synthetic-local-only-secret-with-at-least-32-bytes';
  const signature = phase24.signShipmentEnvelope(fields, secret);
  assert.equal(phase24.verifyShipmentEnvelope({
    fields, signature, secret, nowMs: Date.parse(fields.timestamp)
  }).ok, true);
  assert.equal(phase24.verifyShipmentEnvelope({
    fields: { ...fields, orderId: 'synthetic-order-002' },
    signature, secret, nowMs: Date.parse(fields.timestamp)
  }).reason, 'invalid_signature');
});
