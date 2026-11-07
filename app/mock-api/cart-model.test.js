'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MAX_QUANTITY, addCartItem, buildCartView, createCart,
  removeCartItem, setCartItemQuantity
} = require('./cart-model');

const lianggao = { id: 'lg-1', name: '黑糖芋頭涼糕', spec: '一盒', priceLabel: 'NT$ 150', available: true };
const radish = { id: 'rd-1', name: '純米蘿蔔糕', spec: '一包', priceLabel: 'NT$ 180', available: true };

test('new cart starts empty', () => {
  assert.deepEqual(buildCartView(createCart()).items, []);
  assert.equal(buildCartView(createCart()).checkoutEnabled, false);
});

test('add an available product with confirmed price', () => {
  const result = addCartItem(createCart(), lianggao);
  assert.equal(result.ok, true);
  assert.equal(result.cart.items.length, 1);
  assert.equal(result.cart.items[0].quantity, 1);
});

test('adding same product and variant merges quantity', () => {
  let cart = addCartItem(createCart(), lianggao, 1).cart;
  cart = addCartItem(cart, lianggao, 2).cart;
  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0].quantity, 3);
});

test('different variants remain separate lines', () => {
  let cart = addCartItem(createCart(), lianggao, 1, '伯爵').cart;
  cart = addCartItem(cart, lianggao, 1, '布丁').cart;
  assert.equal(cart.items.length, 2);
});

test('different products remain separate lines', () => {
  let cart = addCartItem(createCart(), lianggao).cart;
  cart = addCartItem(cart, radish).cart;
  assert.equal(cart.items.length, 2);
});

test('missing price blocks add', () => {
  const result = addCartItem(createCart(), { ...lianggao, priceLabel: '' });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'PRODUCT_NOT_ORDERABLE');
  assert.equal(result.cart.items.length, 0);
});

test('placeholder price blocks add', () => {
  const result = addCartItem(createCart(), { ...lianggao, priceLabel: '價格待確認' });
  assert.equal(result.ok, false);
});

test('unavailable product blocks add', () => {
  const result = addCartItem(createCart(), { ...lianggao, available: false });
  assert.equal(result.ok, false);
});

test('invalid quantity is rejected', () => {
  assert.equal(addCartItem(createCart(), lianggao, 0).reason, 'INVALID_QUANTITY');
  assert.equal(addCartItem(createCart(), lianggao, 1.5).reason, 'INVALID_QUANTITY');
  assert.equal(addCartItem(createCart(), lianggao, MAX_QUANTITY + 1).reason, 'INVALID_QUANTITY');
});

test('merge cannot exceed maximum quantity', () => {
  const cart = addCartItem(createCart(), lianggao, MAX_QUANTITY).cart;
  const result = addCartItem(cart, lianggao, 1);
  assert.equal(result.reason, 'QUANTITY_LIMIT_EXCEEDED');
  assert.equal(result.cart.items[0].quantity, MAX_QUANTITY);
});

test('remove item by product and variant', () => {
  let cart = addCartItem(createCart(), lianggao, 1, 'A').cart;
  cart = addCartItem(cart, lianggao, 1, 'B').cart;
  cart = removeCartItem(cart, 'lg-1', 'A');
  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0].variantId, 'B');
});

test('set quantity updates existing line', () => {
  const cart = addCartItem(createCart(), lianggao, 1).cart;
  const result = setCartItemQuantity(cart, 'lg-1', 4);
  assert.equal(result.ok, true);
  assert.equal(result.cart.items[0].quantity, 4);
});

test('set quantity zero removes line', () => {
  const cart = addCartItem(createCart(), lianggao).cart;
  const result = setCartItemQuantity(cart, 'lg-1', 0);
  assert.equal(result.ok, true);
  assert.equal(result.cart.items.length, 0);
});

test('quantity update rejects invalid values and unknown lines', () => {
  const cart = addCartItem(createCart(), lianggao).cart;
  assert.equal(setCartItemQuantity(cart, 'lg-1', -1).reason, 'INVALID_QUANTITY');
  assert.equal(setCartItemQuantity(cart, 'missing', 2).reason, 'CART_ITEM_NOT_FOUND');
});

test('cart stores price and product details as display snapshots', () => {
  const cart = addCartItem(createCart(), lianggao).cart;
  const view = buildCartView(cart);
  assert.equal(view.items[0].priceLabel, 'NT$ 150');
  assert.equal(view.items[0].name, '黑糖芋頭涼糕');
  assert.equal(view.totalLabel, '結帳時以伺服器確認價格與金額');
});

test('cart view summarizes item counts without calculating payable total', () => {
  let cart = addCartItem(createCart(), lianggao, 2).cart;
  cart = addCartItem(cart, radish, 3).cart;
  const view = buildCartView(cart);
  assert.equal(view.itemCount, 5);
  assert.equal(view.distinctItemCount, 2);
  assert.equal(view.checkoutEnabled, false);
});

test('cart operations preserve prior immutable state', () => {
  const original = createCart();
  const changed = addCartItem(original, lianggao).cart;
  assert.equal(original.items.length, 0);
  assert.equal(changed.items.length, 1);
});
