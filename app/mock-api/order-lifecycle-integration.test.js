/**
 * Phase 58 order lifecycle integration contract.
 * Synthetic in-memory flow only. No real order creation, payment capture or notification delivery.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { issueQuote } = require('./quote-model');
const { authorizeCheckout, createCheckoutGateStore, registerServerQuote } = require('./checkout-gate');
const {
  createOrderFlow, createOrderFlowStore, enqueueNotification,
  recordNotificationAttempt, transitionOrderFlow
} = require('./order-flow-model');

const cart = { items: [{ productId: 'lg-001', variantId: 'flavor-a', quantity: 1 }] };
const recipient = {
  name: '測試顧客', phone: '0900000000', address: '測試地址',
  storeProvider: '', storeName: '', storeAddress: ''
};
const catalog = {
  'lg-001': { name: '測試涼糕', category: 'lianggao', enabled: true,
    onlineEnabled: true, unitPriceMinor: 12000 }
};
const rates = {
  lianggao_home_delivery: { enabled: true, feeMinor: 6000 }
};

function authorizeOnly() {
  const issued = issueQuote({
    cart, fulfillmentMethod: 'lianggao_home_delivery', recipient,
    trustedCatalog: catalog, trustedRates: rates,
    quoteId: 'phase58-quote', issuedAt: 100, expiresAt: 500
  });
  assert.equal(issued.ok, true);
  const store = createCheckoutGateStore();
  registerServerQuote(store, issued.quote);
  return authorizeCheckout({
    store, quoteId: issued.quote.quoteId, cart,
    fulfillmentMethod: 'lianggao_home_delivery', recipient,
    serverNow: 200, sessionId: 'phase58-session',
    idempotencyKey: 'phase58-checkout-key-001'
  });
}

test('Phase 58: checkout authorization does not falsely create a production order', () => {
  const authorization = authorizeOnly();
  assert.equal(authorization.ok, true);
  assert.equal(authorization.orderCreationEnabled, false);
  assert.equal(authorization.paymentExecutionEnabled, false);
});

test('Phase 58: lifecycle starts only from a separately supplied synthetic order ID', () => {
  const authorization = authorizeOnly();
  const store = createOrderFlowStore();
  assert.equal(store.orders.size, 0);
  assert.equal(authorization.orderCreationEnabled, false);
  const created = createOrderFlow({
    store, orderId: 'SYNTHETIC-ORDER-00058',
    fulfillmentType: 'lianggao_home_delivery', now: 210
  });
  assert.equal(created.ok, true);
  assert.equal(created.order.orderStatus, 'awaiting_payment');
  assert.equal(created.order.paymentStatus, 'unpaid');
  assert.equal(created.order.fulfillmentStatus, 'unprepared');
});

test('Phase 58: payment confirmation precedes preparation and shipment', () => {
  const store = createOrderFlowStore();
  createOrderFlow({ store, orderId: 'SYNTHETIC-ORDER-00059',
    fulfillmentType: 'lianggao_home_delivery', now: 100 });
  let order = store.orders.get('SYNTHETIC-ORDER-00059');
  const paid = transitionOrderFlow({
    store, orderId: order.orderId, dimension: 'payment', nextStatus: 'confirmed',
    expectedVersion: order.version, now: 110, eventId: 'phase58-paid-event-0001'
  });
  assert.equal(paid.ok, true);
  order = paid.order;
  const preparing = transitionOrderFlow({
    store, orderId: order.orderId, dimension: 'fulfillment', nextStatus: 'preparing',
    expectedVersion: order.version, now: 120, eventId: 'phase58-prep-event-0001'
  });
  assert.equal(preparing.ok, true);
  order = preparing.order;
  const prepared = transitionOrderFlow({
    store, orderId: order.orderId, dimension: 'fulfillment', nextStatus: 'prepared',
    expectedVersion: order.version, now: 130, eventId: 'phase58-ready-event-0001'
  });
  assert.equal(prepared.ok, true);
  order = prepared.order;
  const shipped = transitionOrderFlow({
    store, orderId: order.orderId, dimension: 'fulfillment', nextStatus: 'shipped',
    expectedVersion: order.version, now: 140, eventId: 'phase58-ship-event-0001'
  });
  assert.equal(shipped.ok, true);
});

test('Phase 58: order notification is queued once and delivery is recorded separately', () => {
  const store = createOrderFlowStore();
  createOrderFlow({ store, orderId: 'SYNTHETIC-ORDER-00060',
    fulfillmentType: 'lianggao_home_delivery', now: 100 });
  const args = {
    store, orderId: 'SYNTHETIC-ORDER-00060', eventType: 'order_created',
    channel: 'push', recipientRef: 'synthetic-member-ref',
    payload: { displayOrderId: 'SYNTHETIC-ORDER-00060' },
    idempotencyKey: 'phase58-notify-key-001', now: 120
  };
  const first = enqueueNotification(args);
  const replay = enqueueNotification(args);
  assert.equal(first.ok, true);
  assert.equal(replay.duplicate, true);
  assert.equal(store.outbox.size, 1);
  const sent = recordNotificationAttempt({
    store, notificationId: first.notification.notificationId,
    outcome: 'sent', now: 130
  });
  assert.equal(sent.notification.status, 'sent');
});

test('Phase 58: stale lifecycle update cannot overwrite a newer order version', () => {
  const store = createOrderFlowStore();
  createOrderFlow({ store, orderId: 'SYNTHETIC-ORDER-00061',
    fulfillmentType: 'lianggao_home_delivery', now: 100 });
  const initial = store.orders.get('SYNTHETIC-ORDER-00061');
  const paid = transitionOrderFlow({
    store, orderId: initial.orderId, dimension: 'payment', nextStatus: 'confirmed',
    expectedVersion: initial.version, now: 110, eventId: 'phase58-version-paid-001'
  });
  const stale = transitionOrderFlow({
    store, orderId: initial.orderId, dimension: 'order', nextStatus: 'cancelled',
    expectedVersion: initial.version, now: 120, eventId: 'phase58-version-cancel-001'
  });
  assert.equal(paid.ok, true);
  assert.equal(stale.reason, 'ORDER_VERSION_CONFLICT');
});
