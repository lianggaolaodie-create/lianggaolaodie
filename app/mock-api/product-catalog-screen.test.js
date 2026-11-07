'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CATEGORIES, buildCatalogScreen, buildProductCard, buildProductDetail,
  hasConfirmedPrice, matchesSearch, resolveProductAction
} = require('./product-catalog-screen');

const products = [
  { id: 'lg-1', category: 'lianggao', name: '黑糖芋頭涼糕', description: '黑糖外皮與芋頭餡', spec: '一盒', priceLabel: 'NT$ 150', available: true, imageUrl: 'https://example.com/a.jpg' },
  { id: 'lg-2', category: 'lianggao', name: '草莓涼糕', priceLabel: 'NT$ 100', available: false },
  { id: 'rd-1', category: 'radish_cake', name: '純米蘿蔔糕', description: '冷凍商品', spec: '一包', priceLabel: '價格待確認', available: true },
  { id: 'rd-2', category: 'radish_cake', name: '香煎蘿蔔糕', priceLabel: 'NT$ 180', available: true }
];

test('category metadata separates lianggao and radish products', () => {
  assert.equal(CATEGORIES.lianggao.productCategory, 'lianggao');
  assert.equal(CATEGORIES.radish.productCategory, 'radish_cake');
});

test('catalog filters to selected category only', () => {
  const screen = buildCatalogScreen({ category: 'lianggao', products });
  assert.equal(screen.count, 2);
  assert.ok(screen.products.every(item => item.category === '涼糕'));
});

test('radish catalog does not include lianggao products', () => {
  const screen = buildCatalogScreen({ category: 'radish', products });
  assert.deepEqual(screen.products.map(item => item.id), ['rd-1', 'rd-2']);
});

test('search matches product name case-insensitively', () => {
  assert.equal(matchesSearch(products[0], '黑糖'), true);
  assert.equal(matchesSearch(products[0], '不存在'), false);
});

test('search includes description and specification', () => {
  assert.equal(matchesSearch(products[0], '芋頭餡'), true);
  assert.equal(matchesSearch(products[0], '一盒'), true);
});

test('empty search keeps all items in category', () => {
  assert.equal(buildCatalogScreen({ category: 'lianggao', products, query: '  ' }).count, 2);
});

test('no search results has a clear message', () => {
  const screen = buildCatalogScreen({ category: 'lianggao', products, query: '鳳梨' });
  assert.equal(screen.count, 0);
  assert.equal(screen.emptyMessage, '找不到符合的商品。');
});

test('empty category has an on-sale empty message', () => {
  const screen = buildCatalogScreen({ category: 'radish', products: [] });
  assert.equal(screen.emptyMessage, '目前沒有上架商品。');
});

test('unknown category fails closed', () => {
  const screen = buildCatalogScreen({ category: 'staff', products });
  assert.equal(screen.ok, false);
  assert.equal(screen.count, 0);
});

test('valid price label is accepted without calculating a price', () => {
  assert.equal(hasConfirmedPrice(products[0]), true);
  assert.equal(buildProductCard(products[0]).priceLabel, 'NT$ 150');
});

test('missing or placeholder price blocks ordering', () => {
  const card = buildProductCard({ id: 'x', available: true, priceLabel: '價格待確認' });
  assert.equal(card.available, false);
  assert.equal(card.addToCartEnabled, false);
  assert.equal(card.priceLabel, '價格待確認');
});

test('unavailable product remains visible but cannot be ordered', () => {
  const card = buildProductCard(products[1]);
  assert.equal(card.availabilityLabel, '暫不可訂購');
  assert.equal(card.addToCartEnabled, false);
});

test('missing image uses a safe fallback label', () => {
  const card = buildProductCard({ id: 'x', name: '測試商品' });
  assert.equal(card.imageUrl, null);
  assert.equal(card.imageFallbackLabel, '商品圖片準備中');
});

test('detail view exposes description, spec, price and availability', () => {
  const detail = buildProductDetail(products[0]);
  assert.deepEqual(detail.detailFields.map(field => field.key), ['description', 'spec', 'price', 'availability']);
  assert.equal(detail.addToCartEnabled, true);
});

test('missing detail fields use explicit placeholders', () => {
  const detail = buildProductDetail({ id: 'x' });
  assert.equal(detail.detailFields[0].value, '商品介紹待更新');
  assert.equal(detail.detailFields[1].value, '規格待確認');
});

test('cart action is enabled only for available products with a confirmed price', () => {
  assert.deepEqual(resolveProductAction(products[0], 'cart'), { enabled: true, route: 'cart', productId: 'lg-1' });
  assert.equal(resolveProductAction(products[2], 'cart').reason, 'PRODUCT_NOT_ORDERABLE');
  assert.equal(resolveProductAction(products[1], 'cart').enabled, false);
});

test('detail action navigates to detail without creating an order', () => {
  assert.equal(resolveProductAction(products[0], 'detail').route, 'productDetail');
});

test('unknown action is disabled', () => {
  assert.equal(resolveProductAction(products[0], 'checkout').reason, 'UNKNOWN_ACTION');
});
