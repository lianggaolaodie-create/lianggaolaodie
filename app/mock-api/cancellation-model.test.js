'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { attachRefund, confirmCancellationRefund, createCancellationStore,
  registerOrder, requestOrderCancellation, setInventory } = require('./cancellation-model');

function setup({ paid = false, status = 'awaiting_payment' } = {}) {
  const store = createCancellationStore();
  setInventory({ store, sku: 'cake-a', available: 4, reserved: 3 });
  registerOrder({ store, orderId: 'order-a', paymentStatus: paid ? 'succeeded' : 'unpaid',
    orderStatus: status, paymentId: paid ? 'payment-a' : null,
    lines: [{ sku: 'cake-a', quantity: 2 }] });
  return store;
}
function cancel(store, overrides = {}) {
  return requestOrderCancellation({ store, orderId: 'order-a', reason: '顧客取消訂單',
    idempotencyKey: 'cancel-key-000001', now: 100, ...overrides });
}
test('unpaid cancellation immediately cancels and releases reserved stock once', () => {
  const store = setup();
  const r = cancel(store);
  assert.equal(r.cancellation.status, 'cancelled');
  assert.equal(store.orders.get('order-a').orderStatus, 'cancelled');
  assert.equal(store.inventory.get('cake-a').available, 6);
  assert.equal(store.inventory.get('cake-a').reserved, 1);
});
test('repeated cancellation request is idempotent and does not release stock twice', () => {
  const store = setup();
  const first = cancel(store);
  const second = cancel(store);
  assert.equal(second.replayed, true);
  assert.equal(store.inventory.get('cake-a').available, 6);
  assert.equal(store.inventory.get('cake-a').reserved, 1);
});
test('same cancellation key with changed request conflicts', () => {
  const store = setup();
  cancel(store);
  assert.equal(cancel(store, { reason: '其他原因' }).reason, 'CANCELLATION_IDEMPOTENCY_CONFLICT');
});
test('paid cancellation waits for confirmed refund before stock release', () => {
  const store = setup({ paid: true });
  const r = cancel(store);
  assert.equal(r.cancellation.status, 'refund_pending');
  assert.equal(store.inventory.get('cake-a').available, 4);
  assert.equal(store.orders.get('order-a').orderStatus, 'awaiting_payment');
});
test('refund must be linked and confirmed before cancellation completes', () => {
  const store = setup({ paid: true });
  const c = cancel(store).cancellation;
  assert.equal(confirmCancellationRefund({ store, cancellationId: c.cancellationId,
    refundId: 'refund-a', succeeded: true, now: 200 }).reason, 'REFUND_CONFIRMATION_MISMATCH');
  attachRefund({ store, cancellationId: c.cancellationId, refundId: 'refund-a' });
  assert.equal(confirmCancellationRefund({ store, cancellationId: c.cancellationId,
    refundId: 'refund-a', succeeded: false, now: 200 }).reason, 'REFUND_NOT_CONFIRMED');
  const result = confirmCancellationRefund({ store, cancellationId: c.cancellationId,
    refundId: 'refund-a', succeeded: true, now: 210 });
  assert.equal(result.ok, true);
  assert.equal(store.orders.get('order-a').paymentStatus, 'refunded');
  assert.equal(store.inventory.get('cake-a').available, 6);
});
test('refund success replay cannot restock twice', () => {
  const store = setup({ paid: true });
  const c = cancel(store).cancellation;
  attachRefund({ store, cancellationId: c.cancellationId, refundId: 'refund-a' });
  confirmCancellationRefund({ store, cancellationId: c.cancellationId, refundId: 'refund-a', succeeded: true, now: 210 });
  assert.equal(confirmCancellationRefund({ store, cancellationId: c.cancellationId,
    refundId: 'refund-a', succeeded: true, now: 220 }).reason, 'REFUND_CONFIRMATION_MISMATCH');
  assert.equal(store.inventory.get('cake-a').available, 6);
});
test('partial or full shipment blocks cancellation', () => {
  assert.equal(cancel(setup({ status: 'partially_shipped' })).reason, 'ORDER_ALREADY_SHIPPED_OR_PARTIAL');
  assert.equal(cancel(setup({ status: 'shipped' })).reason, 'ORDER_ALREADY_SHIPPED_OR_PARTIAL');
});
test('processing order requires manual review', () => {
  assert.equal(cancel(setup({ status: 'processing' })).reason, 'ORDER_PROCESSING_REVIEW_REQUIRED');
});
test('invalid order registration and missing reserved stock fail', () => {
  const store = createCancellationStore();
  setInventory({ store, sku: 'cake-a', available: 0, reserved: 0 });
  assert.equal(registerOrder({ store, orderId: 'x', lines: [{ sku: 'cake-a', quantity: 1 }] }).reason,
    'RESERVED_STOCK_INSUFFICIENT');
});
test('unknown order and malformed cancellation input fail closed', () => {
  const store = setup();
  assert.equal(cancel(store, { orderId: 'missing' }).reason, 'ORDER_NOT_FOUND');
  assert.equal(cancel(store, { idempotencyKey: '' }).reason, 'CANCELLATION_IDEMPOTENCY_KEY_INVALID');
  assert.equal(cancel(store, { reason: '' }).reason, 'CANCELLATION_REASON_REQUIRED');
});
test('paid cancellation never marks refunded before provider confirmation', () => {
  const store = setup({ paid: true });
  cancel(store);
  assert.equal(store.orders.get('order-a').paymentStatus, 'succeeded');
  assert.equal(store.orders.get('order-a').stockReleasedAt, null);
});
