'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { issueQuote, validateQuoteForCheckout } = require('./quote-model');

const catalog = {
  lg: { category: 'lianggao', name: '黑糖芋頭涼糕', unitPriceMinor: 15000, enabled: true, onlineEnabled: true },
  rd: { category: 'radish_cake', name: '純米蘿蔔糕', unitPriceMinor: 18000, enabled: true, onlineEnabled: true },
  off: { category: 'lianggao', name: '停售涼糕', unitPriceMinor: 10000, enabled: false, onlineEnabled: true },
  offline: { category: 'radish_cake', name: '未開放網購蘿蔔糕', unitPriceMinor: 10000, enabled: true, onlineEnabled: false }
};
const rates = {
  lianggao_home_delivery: { enabled: true, feeMinor: 8000 },
  lianggao_store_cooling_pickup: { enabled: true, feeMinor: 3000 },
  radish_frozen_store_to_store: { enabled: true, feeMinor: 9900 },
  radish_frozen_home_delivery: { enabled: true, feeMinor: 25000 }
};
const home = { name: '王小明', phone: '0912345678', address: '台北市測試路1號' };
const store = { name: '王小明', phone: '0912345678', storeProvider: '全家', storeName: '測試門市', storeAddress: '台北市測試路2號' };
const base = {
  cart: { items: [{ productId: 'lg', variantId: '', quantity: 2, unitPriceMinor: 1, lineTotalMinor: 2 }] },
  fulfillmentMethod: 'lianggao_home_delivery',
  recipient: home,
  trustedCatalog: catalog,
  trustedRates: rates,
  quoteId: 'quote-test-001',
  quoteVersion: 3,
  issuedAt: 1000,
  expiresAt: 1600
};

test('quote uses trusted server product price, not client price fields', () => {
  const result = issueQuote(base);
  assert.equal(result.ok, true);
  assert.equal(result.quote.items[0].unitPriceMinor, 15000);
  assert.equal(result.quote.subtotalMinor, 30000);
  assert.equal(result.quote.totalMinor, 38000);
});

test('quote uses trusted shipping rate, not client-supplied fee', () => {
  const result = issueQuote({ ...base, shippingFeeMinor: 1, clientTotalMinor: 1 });
  assert.equal(result.quote.shippingFeeMinor, 8000);
  assert.equal(result.quote.totalMinor, 38000);
});

test('quote includes currency, version, expiry and cart fingerprint', () => {
  const quote = issueQuote(base).quote;
  assert.equal(quote.currency, 'TWD');
  assert.equal(quote.quoteVersion, 3);
  assert.equal(quote.expiresAt, 1600);
  assert.match(quote.cartFingerprint, /^[a-f0-9]{64}$/);
});

test('cooling pickup quote uses its own rate and store data', () => {
  const result = issueQuote({ ...base, fulfillmentMethod: 'lianggao_store_cooling_pickup', recipient: store });
  assert.equal(result.ok, true);
  assert.equal(result.quote.shippingFeeMinor, 3000);
});

test('radish frozen store-to-store quote is distinct from lianggao chilled pickup', () => {
  const result = issueQuote({ ...base, cart: { items: [{ productId: 'rd', quantity: 1 }] },
    fulfillmentMethod: 'radish_frozen_store_to_store', recipient: store });
  assert.equal(result.ok, true);
  assert.equal(result.quote.temperature, 'frozen');
  assert.equal(result.quote.shippingFeeMinor, 9900);
});

test('radish frozen home delivery quote uses frozen home rate', () => {
  const result = issueQuote({ ...base, cart: { items: [{ productId: 'rd', quantity: 1 }] },
    fulfillmentMethod: 'radish_frozen_home_delivery', recipient: home });
  assert.equal(result.ok, true);
  assert.equal(result.quote.shippingFeeMinor, 25000);
});

test('mixed product categories are rejected', () => {
  const result = issueQuote({ ...base, cart: { items: [{ productId: 'lg', quantity: 1 }, { productId: 'rd', quantity: 1 }] } });
  assert.equal(result.reason, 'MIXED_TEMPERATURE_FULFILLMENT');
});

test('disabled and not-online products are rejected', () => {
  assert.equal(issueQuote({ ...base, cart: { items: [{ productId: 'off', quantity: 1 }] } }).reason, 'PRODUCT_NOT_ORDERABLE');
  assert.equal(issueQuote({ ...base, cart: { items: [{ productId: 'offline', quantity: 1 }] } }).reason, 'PRODUCT_NOT_ORDERABLE');
});

test('missing trusted product price is rejected', () => {
  const result = issueQuote({ ...base, trustedCatalog: { lg: { category: 'lianggao', enabled: true, onlineEnabled: true } } });
  assert.equal(result.reason, 'SERVER_PRICE_INVALID');
});

test('missing or disabled trusted rate fails closed', () => {
  assert.equal(issueQuote({ ...base, trustedRates: {} }).reason, 'SERVER_SHIPPING_RATE_UNAVAILABLE');
  assert.equal(issueQuote({ ...base, trustedRates: { lianggao_home_delivery: { enabled: false, feeMinor: 1 } } }).reason, 'SERVER_SHIPPING_RATE_UNAVAILABLE');
});

test('unknown fulfillment method is rejected', () => {
  assert.equal(issueQuote({ ...base, fulfillmentMethod: 'unknown' }).reason, 'FULFILLMENT_METHOD_NOT_ALLOWED');
});

test('missing recipient address or store selection is rejected', () => {
  assert.equal(issueQuote({ ...base, recipient: {} }).reason, 'RECIPIENT_DETAILS_INVALID');
  assert.equal(issueQuote({ ...base, fulfillmentMethod: 'lianggao_store_cooling_pickup', recipient: home }).reason, 'RECIPIENT_DETAILS_INVALID');
});

test('invalid quantity and empty cart are rejected', () => {
  assert.equal(issueQuote({ ...base, cart: { items: [] } }).reason, 'CART_EMPTY');
  assert.equal(issueQuote({ ...base, cart: { items: [{ productId: 'lg', quantity: 100 }] } }).reason, 'INVALID_CART_ITEM');
});

test('invalid quote expiry and quote identity are rejected', () => {
  assert.equal(issueQuote({ ...base, expiresAt: 1000 }).reason, 'QUOTE_EXPIRY_INVALID');
  assert.equal(issueQuote({ ...base, quoteId: '' }).reason, 'QUOTE_ID_REQUIRED');
});

test('valid quote is accepted only before expiry and for same cart', () => {
  const quote = issueQuote(base).quote;
  assert.equal(validateQuoteForCheckout({ quote, cart: base.cart, fulfillmentMethod: base.fulfillmentMethod, serverNow: 1500 }).ok, true);
  assert.equal(validateQuoteForCheckout({ quote, cart: base.cart, fulfillmentMethod: base.fulfillmentMethod, serverNow: 1600 }).reason, 'QUOTE_EXPIRED');
  assert.equal(validateQuoteForCheckout({ quote, cart: { items: [{ productId: 'lg', quantity: 3 }] }, fulfillmentMethod: base.fulfillmentMethod, serverNow: 1500 }).reason, 'QUOTE_CART_MISMATCH');
});

test('quote cannot be reused with another fulfillment method', () => {
  const quote = issueQuote(base).quote;
  assert.equal(validateQuoteForCheckout({ quote, cart: base.cart, fulfillmentMethod: 'lianggao_store_cooling_pickup', serverNow: 1200 }).reason, 'QUOTE_METHOD_MISMATCH');
});

test('quote does not create an order or accept client total as authority', () => {
  const result = issueQuote({ ...base, clientTotalMinor: 0 });
  assert.equal(result.quote.orderCreationEnabled, false);
  assert.equal(result.quote.totalMinor, 38000);
});

test('unknown product id fails closed', () => {
  assert.equal(issueQuote({ ...base, cart: { items: [{ productId: 'not-real', quantity: 1 }] } }).reason, 'PRODUCT_NOT_ORDERABLE');
});
