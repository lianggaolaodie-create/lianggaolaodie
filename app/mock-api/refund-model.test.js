'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createRefundStore, reconcileSettlement, registerCapturedPayment,
  requestRefund, reservedRefundAmount, transitionRefund
} = require('./refund-model');

const base = { paymentId: 'pay-synthetic-1', orderId: 'order-synthetic-1',
  amountMinor: 10000, currency: 'TWD', capturedAt: 100 };
function setup() {
  const store = createRefundStore();
  assert.equal(registerCapturedPayment({ store, ...base }).ok, true);
  return store;
}
function ask(store, overrides = {}) {
  return requestRefund({ store, paymentId: base.paymentId, amountMinor: 3000,
    reason: '顧客取消部分商品', idempotencyKey: 'refund-key-000001',
    now: 200, ...overrides });
}
function complete(store, refundId) {
  assert.equal(transitionRefund({ store, refundId, action: 'approve', now: 210 }).ok, true);
  assert.equal(transitionRefund({ store, refundId, action: 'process', now: 220 }).ok, true);
  return transitionRefund({ store, refundId, action: 'succeed', now: 230, providerRefundId: 'provider-refund-1' });
}

test('registers captured payment snapshot', () => {
  const store = setup();
  assert.equal(store.payments.get(base.paymentId).amountMinor, 10000);
});
test('rejects invalid or duplicate captured payment', () => {
  const store = createRefundStore();
  assert.equal(registerCapturedPayment({ store, ...base, amountMinor: 0 }).reason, 'CAPTURE_AMOUNT_INVALID');
  registerCapturedPayment({ store, ...base });
  assert.equal(registerCapturedPayment({ store, ...base }).reason, 'PAYMENT_ALREADY_REGISTERED');
});
test('creates refund request in requested state', () => {
  const result = ask(setup());
  assert.equal(result.refund.status, 'requested');
  assert.equal(result.refund.amountMinor, 3000);
});
test('same refund key and payload is idempotent', () => {
  const store = setup();
  const first = ask(store);
  const second = ask(store);
  assert.equal(second.refund.refundId, first.refund.refundId);
  assert.equal(second.replayed, true);
});
test('same refund key with changed amount is a conflict', () => {
  const store = setup();
  ask(store);
  assert.equal(ask(store, { amountMinor: 4000 }).reason, 'REFUND_IDEMPOTENCY_CONFLICT');
});
test('invalid request fields fail closed', () => {
  const store = setup();
  assert.equal(ask(store, { amountMinor: 0 }).reason, 'REFUND_AMOUNT_INVALID');
  assert.equal(ask(store, { reason: '' }).reason, 'REFUND_REASON_REQUIRED');
  assert.equal(ask(store, { idempotencyKey: '' }).reason, 'REFUND_IDEMPOTENCY_KEY_INVALID');
  assert.equal(ask(store, { paymentId: 'missing' }).reason, 'PAYMENT_NOT_FOUND');
});
test('cumulative requested refunds cannot exceed captured payment', () => {
  const store = setup();
  ask(store, { amountMinor: 7000, idempotencyKey: 'refund-key-000001' });
  assert.equal(ask(store, { amountMinor: 4000, idempotencyKey: 'refund-key-000002' }).reason, 'REFUND_EXCEEDS_CAPTURED_AMOUNT');
});
test('rejected refund releases reserved refundable amount', () => {
  const store = setup();
  const r = ask(store, { amountMinor: 7000 });
  transitionRefund({ store, refundId: r.refund.refundId, action: 'reject', now: 210 });
  assert.equal(reservedRefundAmount(store, base.paymentId), 0);
  assert.equal(ask(store, { amountMinor: 10000, idempotencyKey: 'refund-key-000002' }).ok, true);
});
test('approval, processing and success transitions work', () => {
  const store = setup();
  const r = ask(store);
  assert.equal(complete(store, r.refund.refundId).refund.status, 'succeeded');
});
test('invalid refund state transitions are rejected', () => {
  const store = setup();
  const r = ask(store);
  assert.equal(transitionRefund({ store, refundId: r.refund.refundId, action: 'process', now: 210 }).reason,
    'REFUND_TRANSITION_NOT_ALLOWED');
});
test('failed provider refund is terminal and releases remaining reservation', () => {
  const store = setup();
  const r = ask(store, { amountMinor: 7000 });
  transitionRefund({ store, refundId: r.refund.refundId, action: 'approve', now: 210 });
  transitionRefund({ store, refundId: r.refund.refundId, action: 'process', now: 220 });
  transitionRefund({ store, refundId: r.refund.refundId, action: 'fail', now: 230, failureCode: 'DECLINED' });
  assert.equal(reservedRefundAmount(store, base.paymentId), 0);
});
test('reconciliation matches provider settlement records', () => {
  const store = setup();
  const r = ask(store);
  complete(store, r.refund.refundId);
  const result = reconcileSettlement({
    store,
    providerPayments: [{ paymentId: base.paymentId, amountMinor: 10000, currency: 'TWD' }],
    providerRefunds: [{ refundId: r.refund.refundId, amountMinor: 3000, currency: 'TWD' }]
  });
  assert.equal(result.matched, true);
  assert.equal(result.differenceCount, 0);
});
test('reconciliation detects amount differences and missing provider rows', () => {
  const store = setup();
  const result = reconcileSettlement({
    store,
    providerPayments: [{ paymentId: base.paymentId, amountMinor: 9000, currency: 'TWD' }],
    providerRefunds: []
  });
  assert.equal(result.matched, false);
  assert.equal(result.differenceCount, 1);
});
test('reconciliation detects provider-only payment and refund records', () => {
  const store = setup();
  const result = reconcileSettlement({
    store,
    providerPayments: [{ paymentId: 'external-only', amountMinor: 100, currency: 'TWD' }],
    providerRefunds: [{ refundId: 'external-refund', amountMinor: 50, currency: 'TWD' }]
  });
  assert.equal(result.differenceCount, 3);
});
test('duplicate or malformed settlement rows are rejected', () => {
  const store = setup();
  assert.equal(reconcileSettlement({ store,
    providerPayments: [{ paymentId: 'x', amountMinor: 1, currency: 'TWD' }, { paymentId: 'x', amountMinor: 1, currency: 'TWD' }],
    providerRefunds: [] }).reason, 'SETTLEMENT_ROW_INVALID_OR_DUPLICATE');
});
test('failed and pending refunds are not counted as provider-settled refunds', () => {
  const store = setup();
  ask(store);
  assert.equal(reconcileSettlement({ store,
    providerPayments: [{ paymentId: base.paymentId, amountMinor: 10000, currency: 'TWD' }],
    providerRefunds: [] }).matched, true);
});
