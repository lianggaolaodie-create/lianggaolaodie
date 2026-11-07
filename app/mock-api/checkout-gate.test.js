'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { issueQuote } = require('./quote-model');
const {
  authorizeCheckout, createCheckoutGateStore, recipientFingerprint, registerServerQuote
} = require('./checkout-gate');

const cart = { items: [{ productId: 'lg', variantId: 'classic', quantity: 2 }] };
const recipient = { name: '王小明', phone: '0912345678', address: '台北市測試路1號' };
const catalog = { lg: { category: 'lianggao', name: '黑糖芋頭涼糕', unitPriceMinor: 15000, enabled: true, onlineEnabled: true } };
const rates = { lianggao_home_delivery: { enabled: true, feeMinor: 8000 } };
const quote = issueQuote({
  cart, fulfillmentMethod: 'lianggao_home_delivery', recipient,
  trustedCatalog: catalog, trustedRates: rates, quoteId: 'q-48-001',
  issuedAt: 1000, expiresAt: 2000
}).quote;

function setup() {
  const store = createCheckoutGateStore();
  assert.equal(registerServerQuote(store, quote).ok, true);
  return store;
}
function request(overrides = {}) {
  return {
    store: setup(), quoteId: quote.quoteId, cart,
    fulfillmentMethod: 'lianggao_home_delivery', recipient,
    serverNow: 1500, sessionId: 'guest-session-001',
    idempotencyKey: 'checkout-key-000001', ...overrides
  };
}

test('valid server quote authorizes pre-creation gate only', () => {
  const result = authorizeCheckout(request());
  assert.equal(result.authorized, true);
  assert.equal(result.orderCreationEnabled, false);
  assert.equal(result.paymentExecutionEnabled, false);
});

test('missing server-held quote is rejected', () => {
  assert.equal(authorizeCheckout({ ...request(), quoteId: 'missing' }).reason, 'SERVER_QUOTE_NOT_FOUND');
});

test('expired quote is rejected', () => {
  assert.equal(authorizeCheckout(request({ serverNow: 2000 })).reason, 'QUOTE_EXPIRED');
});

test('quote with no valid idempotency key is rejected', () => {
  assert.equal(authorizeCheckout(request({ idempotencyKey: '' })).reason, 'IDEMPOTENCY_KEY_REQUIRED_OR_INVALID');
});

test('same session, key and payload returns the prior decision', () => {
  const args = request();
  const first = authorizeCheckout(args);
  const second = authorizeCheckout(args);
  assert.equal(first.authorized, true);
  assert.equal(second.authorized, true);
  assert.equal(second.replayed, true);
});

test('same idempotency key with changed payload is a conflict', () => {
  const args = request();
  authorizeCheckout(args);
  assert.equal(authorizeCheckout({ ...args, recipient: { ...recipient, address: '新地址' } }).reason,
    'IDEMPOTENCY_KEY_PAYLOAD_CONFLICT');
});

test('same idempotency key in another session has independent scope but quote reservation prevents replay', () => {
  const args = request();
  authorizeCheckout(args);
  assert.equal(authorizeCheckout({ ...args, sessionId: 'guest-session-002' }).reason, 'QUOTE_ALREADY_RESERVED');
});

test('different idempotency key cannot reuse reserved quote', () => {
  const args = request();
  authorizeCheckout(args);
  assert.equal(authorizeCheckout({ ...args, idempotencyKey: 'checkout-key-000002' }).reason, 'QUOTE_ALREADY_RESERVED');
});

test('changed cart is rejected', () => {
  assert.equal(authorizeCheckout(request({ cart: { items: [{ productId: 'lg', variantId: 'classic', quantity: 3 }] } })).reason,
    'QUOTE_CART_MISMATCH');
});

test('changed fulfillment method is rejected', () => {
  assert.equal(authorizeCheckout(request({ fulfillmentMethod: 'lianggao_store_cooling_pickup' })).reason,
    'QUOTE_METHOD_MISMATCH');
});

test('changed recipient data is rejected against server quote snapshot', () => {
  assert.equal(authorizeCheckout(request({ recipient: { ...recipient, phone: '0987654321' } })).reason,
    'QUOTE_RECIPIENT_MISMATCH');
});

test('missing quote recipient fingerprint fails closed', () => {
  const store = setup();
  const altered = { ...quote };
  delete altered.recipientFingerprint;
  store.quotes.set(quote.quoteId, altered);
  assert.equal(authorizeCheckout({ ...request(), store }).reason, 'QUOTE_RECIPIENT_MISMATCH');
});

test('unknown quote id cannot be used to bypass server quote storage', () => {
  const store = createCheckoutGateStore();
  assert.equal(authorizeCheckout({ ...request(), store }).reason, 'SERVER_QUOTE_NOT_FOUND');
});

test('duplicate quote registration is rejected', () => {
  const store = setup();
  assert.equal(registerServerQuote(store, quote).reason, 'QUOTE_ID_CONFLICT');
});

test('recipient fingerprint normalizes whitespace but binds all supplied delivery fields', () => {
  assert.equal(recipientFingerprint({ name: '王小明 ', phone: '0912345678', address: '台北市 測試路1號' }),
    recipientFingerprint({ name: '王小明', phone: '0912345678', address: '台北市 測試路1號' }));
  assert.notEqual(recipientFingerprint(recipient), recipientFingerprint({ ...recipient, address: '其他地址' }));
});
