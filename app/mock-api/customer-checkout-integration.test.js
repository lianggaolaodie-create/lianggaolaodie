/**
 * Phase 57 customer checkout cross-module integration contract.
 * Synthetic fixtures only. No network, database, payment, order creation or production writes.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { issueQuote } = require('./quote-model');
const {
  authorizeCheckout, createCheckoutGateStore, registerServerQuote
} = require('./checkout-gate');
const { mapSchedule } = require('./production-read-adapters');

const recipient = Object.freeze({
  name: '測試顧客', phone: '0900000000',
  address: '台北市測試路 1 號', storeProvider: '', storeName: '', storeAddress: ''
});
const cart = Object.freeze({ items: Object.freeze([
  Object.freeze({ productId: 'lg-001', variantId: 'flavor-a', quantity: 2 })
]) });
const catalog = Object.freeze({
  'lg-001': Object.freeze({
    name: '測試涼糕', category: 'lianggao', enabled: true,
    onlineEnabled: true, unitPriceMinor: 15000
  })
});
const rates = Object.freeze({
  lianggao_home_delivery: Object.freeze({ enabled: true, feeMinor: 8000 })
});

function createAuthorizedFlow(overrides = {}) {
  const issued = issueQuote({
    cart, fulfillmentMethod: 'lianggao_home_delivery', recipient,
    trustedCatalog: catalog, trustedRates: rates,
    quoteId: 'quote-test-001', issuedAt: 1000, expiresAt: 1600
  });
  assert.equal(issued.ok, true);
  const store = createCheckoutGateStore();
  assert.equal(registerServerQuote(store, issued.quote).ok, true);
  const result = authorizeCheckout({
    store, quoteId: issued.quote.quoteId, cart,
    fulfillmentMethod: 'lianggao_home_delivery', recipient,
    serverNow: 1200, sessionId: 'session-test',
    idempotencyKey: 'checkout-key-00000001',
    ...overrides
  });
  return { issued: issued.quote, store, result };
}

test('Phase 57: trusted quote amount reaches checkout gate without client price authority', () => {
  const { issued, result } = createAuthorizedFlow();
  assert.equal(issued.subtotalMinor, 30000);
  assert.equal(issued.shippingFeeMinor, 8000);
  assert.equal(issued.totalMinor, 38000);
  assert.equal(result.ok, true);
  assert.equal(result.totalMinor, 38000);
  assert.equal(result.orderCreationEnabled, false);
  assert.equal(result.paymentExecutionEnabled, false);
});

test('Phase 57: identical retry is idempotent and does not reserve twice', () => {
  const { issued, store, result } = createAuthorizedFlow();
  const retry = authorizeCheckout({
    store, quoteId: issued.quoteId, cart,
    fulfillmentMethod: 'lianggao_home_delivery', recipient,
    serverNow: 1250, sessionId: 'session-test',
    idempotencyKey: 'checkout-key-00000001'
  });
  assert.equal(result.ok, true);
  assert.equal(retry.ok, true);
  assert.equal(retry.replayed, true);
  assert.equal(store.quoteReservations.size, 1);
});

test('Phase 57: same idempotency key with changed cart is rejected', () => {
  const { issued, store } = createAuthorizedFlow();
  const changedCart = { items: [{ productId: 'lg-001', variantId: 'flavor-a', quantity: 3 }] };
  const retry = authorizeCheckout({
    store, quoteId: issued.quoteId, cart: changedCart,
    fulfillmentMethod: 'lianggao_home_delivery', recipient,
    serverNow: 1250, sessionId: 'session-test',
    idempotencyKey: 'checkout-key-00000001'
  });
  assert.equal(retry.ok, false);
  assert.equal(retry.reason, 'IDEMPOTENCY_KEY_PAYLOAD_CONFLICT');
});

test('Phase 57: quote cannot be consumed after expiry', () => {
  const issued = issueQuote({
    cart, fulfillmentMethod: 'lianggao_home_delivery', recipient,
    trustedCatalog: catalog, trustedRates: rates,
    quoteId: 'quote-expired', issuedAt: 1000, expiresAt: 1100
  });
  const store = createCheckoutGateStore();
  registerServerQuote(store, issued.quote);
  const result = authorizeCheckout({
    store, quoteId: 'quote-expired', cart,
    fulfillmentMethod: 'lianggao_home_delivery', recipient,
    serverNow: 1100, sessionId: 'session-expired',
    idempotencyKey: 'checkout-key-expired-001'
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'QUOTE_EXPIRED');
});

test('Phase 57: product price and shipping fee come only from trusted snapshots', () => {
  const clientCart = { items: [{ productId: 'lg-001', variantId: 'flavor-a', quantity: 2, price: 1, total: 1 }] };
  const issued = issueQuote({
    cart: clientCart, fulfillmentMethod: 'lianggao_home_delivery', recipient,
    trustedCatalog: catalog, trustedRates: rates,
    quoteId: 'quote-trusted-price', issuedAt: 1000, expiresAt: 1600
  });
  assert.equal(issued.ok, true);
  assert.equal(issued.quote.totalMinor, 38000);
});

test('Phase 57: public stall schedule never exposes a price field', () => {
  const result = mapSchedule({
    schedule: {
      id: 'stall-1', schedule_date: '2026-11-09', schedule_type: 'stall',
      enabled: true, title: '測試擺攤', region: '台北', start_time: '10:00', end_time: '16:00'
    },
    links: [{ schedule_id: 'stall-1', flavor_id: 'flavor-1', price_per_box: null, price: 999 }],
    flavorsById: { 'flavor-1': { id: 'flavor-1', name: '黑糖', enabled: true } }
  });
  assert.equal(result.flavors[0].name, '黑糖');
  assert.equal(Object.hasOwn(result.flavors[0], 'pricePerBox'), false);
  assert.equal(Object.hasOwn(result.flavors[0], 'price'), false);
});
