'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createOrderFlow, createOrderFlowStore, enqueueNotification,
  recordNotificationAttempt, transitionOrderFlow } = require('./order-flow-model');
function setup(overrides = {}) {
  const store = createOrderFlowStore();
  const result = createOrderFlow({ store, orderId: 'order-flow-1',
    fulfillmentType: 'lianggao_home_delivery', now: 100, ...overrides });
  assert.equal(result.ok, true);
  return store;
}
function move(store, dimension, nextStatus, overrides = {}) {
  const order = store.orders.get('order-flow-1');
  return transitionOrderFlow({ store, orderId: order.orderId, dimension, nextStatus,
    expectedVersion: order.version, now: 200 + order.version,
    eventId: 'event-' + dimension + '-' + nextStatus + '-0001', ...overrides });
}
test('creates separate order, payment and fulfillment states', () => {
  const order = setup().orders.get('order-flow-1');
  assert.equal(order.orderStatus, 'awaiting_payment');
  assert.equal(order.paymentStatus, 'unpaid');
  assert.equal(order.fulfillmentStatus, 'unprepared');
});
test('payment confirmation and shipment must follow valid order', () => {
  const store = setup();
  assert.equal(move(store, 'fulfillment', 'preparing').ok, true);
  assert.equal(move(store, 'fulfillment', 'prepared').ok, true);
  assert.equal(move(store, 'fulfillment', 'shipped').reason, 'PAYMENT_REQUIRED_BEFORE_SHIPMENT');
  assert.equal(move(store, 'payment', 'confirmed').ok, true);
  assert.equal(move(store, 'fulfillment', 'shipped').ok, true);
});
test('invalid status transitions are rejected', () => {
  assert.equal(move(setup(), 'payment', 'refunded').reason, 'STATUS_TRANSITION_NOT_ALLOWED');
});
test('optimistic version prevents stale concurrent updates', () => {
  const store = setup();
  const order = store.orders.get('order-flow-1');
  transitionOrderFlow({ store, orderId: order.orderId, dimension: 'payment',
    nextStatus: 'confirmed', expectedVersion: order.version, now: 110, eventId: 'event-first-000001' });
  assert.equal(transitionOrderFlow({ store, orderId: order.orderId, dimension: 'order',
    nextStatus: 'cancelled', expectedVersion: order.version, now: 111, eventId: 'event-stale-000001' }).reason,
  'ORDER_VERSION_CONFLICT');
});
test('event replay is idempotent and changed payload conflicts', () => {
  const store = setup();
  const first = move(store, 'payment', 'confirmed');
  const replay = transitionOrderFlow({ store, orderId: 'order-flow-1', dimension: 'payment',
    nextStatus: 'confirmed', expectedVersion: 1, now: 999, eventId: 'event-payment-confirmed-0001' });
  assert.equal(first.ok, true);
  assert.equal(replay.duplicate, true);
  assert.equal(transitionOrderFlow({ store, orderId: 'order-flow-1', dimension: 'payment',
    nextStatus: 'rejected', expectedVersion: 2, now: 1000, eventId: 'event-payment-confirmed-0001' }).reason,
  'EVENT_ID_CONFLICT');
});
test('cannot confirm payment after order cancellation', () => {
  const store = setup({ paymentStatus: 'proof_submitted' });
  assert.equal(move(store, 'order', 'cancelled').ok, true);
  assert.equal(move(store, 'payment', 'confirmed').reason, 'CANCELLED_ORDER_CANNOT_BE_PAID');
});
test('notification outbox is idempotent', () => {
  const store = setup();
  const args = { store, orderId: 'order-flow-1', eventType: 'order_confirmed',
    channel: 'line', recipientRef: 'synthetic-recipient', payload: { order: 'order-flow-1' },
    idempotencyKey: 'notify-key-0000001', now: 300 };
  const first = enqueueNotification(args);
  const second = enqueueNotification(args);
  assert.equal(first.ok, true);
  assert.equal(second.duplicate, true);
});
test('notification idempotency rejects changed payload', () => {
  const store = setup();
  enqueueNotification({ store, orderId: 'order-flow-1', eventType: 'order_confirmed',
    recipientRef: 'synthetic-recipient', payload: { a: 1 }, idempotencyKey: 'notify-key-0000001', now: 300 });
  assert.equal(enqueueNotification({ store, orderId: 'order-flow-1', eventType: 'order_confirmed',
    recipientRef: 'synthetic-recipient', payload: { a: 2 }, idempotencyKey: 'notify-key-0000001', now: 301 }).reason,
  'NOTIFICATION_IDEMPOTENCY_CONFLICT');
});
test('notification retry and terminal delivery states', () => {
  const store = setup();
  const n = enqueueNotification({ store, orderId: 'order-flow-1', eventType: 'shipment',
    recipientRef: 'synthetic-recipient', idempotencyKey: 'notify-key-0000001', now: 300 }).notification;
  assert.equal(recordNotificationAttempt({ store, notificationId: n.notificationId,
    outcome: 'retryable_failure', now: 310, errorCode: 'TEMP' }).notification.status, 'queued');
  assert.equal(recordNotificationAttempt({ store, notificationId: n.notificationId,
    outcome: 'sent', now: 320 }).notification.status, 'sent');
  assert.equal(recordNotificationAttempt({ store, notificationId: n.notificationId,
    outcome: 'retryable_failure', now: 330 }).reason, 'NOTIFICATION_ALREADY_TERMINAL');
});
test('invalid notification inputs fail closed', () => {
  const store = setup();
  assert.equal(enqueueNotification({ store, orderId: 'order-flow-1', eventType: 'x',
    recipientRef: 'x', idempotencyKey: '', now: 1 }).reason, 'NOTIFICATION_KEY_INVALID');
});
