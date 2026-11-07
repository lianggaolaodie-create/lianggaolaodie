'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { addCartItem, createCart } = require('./cart-model');
const {
  buildCheckoutDraft, buildFulfillmentOptions, validateFulfillmentSelection
} = require('./fulfillment-model');

const lianggao = { id: 'lg-1', category: 'lianggao', name: '黑糖芋頭涼糕', priceLabel: 'NT$ 150', available: true };
const radish = { id: 'rd-1', category: 'radish_cake', name: '純米蘿蔔糕', priceLabel: 'NT$ 180', available: true };
const homeDetails = { recipientName: '王小明', phone: '0912345678', address: '台北市中正區測試路1號' };
const storeDetails = { recipientName: '王小明', phone: '0912345678', storeProvider: '全家', storeName: '測試門市', storeAddress: '台北市測試路2號' };

function cartWith(product) { return addCartItem(createCart(), product).cart; }

test('lianggao offers home delivery and convenience-store chilled pickup', () => {
  const result = buildFulfillmentOptions(cartWith(lianggao));
  assert.deepEqual(result.options.map(option => option.id), ['lianggao_home_delivery', 'lianggao_store_cooling_pickup']);
  assert.match(result.note, /不是冷藏宅配/);
});

test('radish offers frozen store-to-store and frozen home delivery', () => {
  const result = buildFulfillmentOptions(cartWith(radish));
  assert.deepEqual(result.options.map(option => option.id), ['radish_frozen_store_to_store', 'radish_frozen_home_delivery']);
  assert.equal(result.options[0].temperature, 'frozen');
});

test('empty cart cannot select fulfillment', () => {
  assert.equal(buildFulfillmentOptions(createCart()).reason, 'CART_EMPTY_OR_CATEGORY_UNKNOWN');
});

test('mixed lianggao and radish cart requires separate orders', () => {
  let cart = cartWith(lianggao);
  cart = addCartItem(cart, radish).cart;
  const result = buildFulfillmentOptions(cart);
  assert.equal(result.ok, false);
  assert.equal(result.requiresSeparateOrders, true);
  assert.equal(result.reason, 'MIXED_TEMPERATURE_FULFILLMENT');
});

test('unknown product category is not treated as a valid fulfillment category', () => {
  const cart = cartWith({ ...lianggao, category: 'other' });
  assert.equal(buildFulfillmentOptions(cart).ok, false);
});

test('lianggao home delivery requires recipient, phone and address', () => {
  const result = validateFulfillmentSelection(cartWith(lianggao), 'lianggao_home_delivery', {});
  assert.deepEqual(result.fields, ['recipientName', 'phone', 'address']);
});

test('lianggao convenience cooling pickup requires store details', () => {
  const result = validateFulfillmentSelection(cartWith(lianggao), 'lianggao_store_cooling_pickup', {});
  assert.deepEqual(result.fields, ['recipientName', 'phone', 'storeProvider', 'storeName', 'storeAddress']);
});

test('radish frozen home delivery requires address', () => {
  const result = validateFulfillmentSelection(cartWith(radish), 'radish_frozen_home_delivery', homeDetails);
  assert.equal(result.ok, true);
  assert.equal(result.temperature, 'frozen');
});

test('radish frozen store-to-store requires store details', () => {
  const result = validateFulfillmentSelection(cartWith(radish), 'radish_frozen_store_to_store', storeDetails);
  assert.equal(result.ok, true);
});

test('fulfillment method from another category is rejected', () => {
  const result = validateFulfillmentSelection(cartWith(lianggao), 'radish_frozen_home_delivery', homeDetails);
  assert.equal(result.reason, 'FULFILLMENT_METHOD_NOT_ALLOWED');
});

test('checkout draft records chilled home delivery without inventing fees', () => {
  const draft = buildCheckoutDraft(cartWith(lianggao), 'lianggao_home_delivery', homeDetails);
  assert.equal(draft.ok, true);
  assert.equal(draft.temperature, 'chilled');
  assert.equal(draft.shippingFee, null);
  assert.equal(draft.payableTotal, null);
  assert.equal(draft.submitEnabled, false);
});

test('cooling pickup draft explicitly stores selected convenience store', () => {
  const draft = buildCheckoutDraft(cartWith(lianggao), 'lianggao_store_cooling_pickup', storeDetails);
  assert.equal(draft.ok, true);
  assert.equal(draft.store.provider, '全家');
  assert.equal(draft.store.name, '測試門市');
  assert.equal(draft.submitEnabled, false);
});

test('frozen delivery draft never gets confused with chilled pickup', () => {
  const draft = buildCheckoutDraft(cartWith(radish), 'radish_frozen_store_to_store', storeDetails);
  assert.equal(draft.temperature, 'frozen');
  assert.equal(draft.fulfillmentMethod, 'radish_frozen_store_to_store');
});

test('all drafts require server quote and cannot submit an order', () => {
  const draft = buildCheckoutDraft(cartWith(radish), 'radish_frozen_home_delivery', homeDetails);
  assert.equal(draft.quoteRequired, true);
  assert.equal(draft.submitEnabled, false);
});

test('invalid selection produces no checkout draft', () => {
  const result = buildCheckoutDraft(cartWith(radish), 'radish_frozen_home_delivery', {});
  assert.equal(result.ok, false);
  assert.ok(result.validation.fields.includes('address'));
});
