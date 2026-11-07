/** Phase 55 adapter allowlist, compatibility and negative security tests. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const adapters = require('./production-read-adapters');

test('flavor catalog emits only enabled allowlisted fields', () => {
  const [row] = adapters.mapFlavorCatalog([{
    id: 7, product_name: '涼糕', name: '黑糖', description: '介紹',
    price: '100', image_url: 'img', flavor_type: 'single', enabled: true,
    admin_note: 'secret', created_by: 'user-1'
  }]);
  assert.deepEqual(row, {
    id: 7, productName: '涼糕', name: '黑糖', description: '介紹',
    price: 100, imageUrl: 'img', flavorType: 'single', enabled: true
  });
  assert.equal(adapters.mapFlavorCatalog([{ enabled: false }]).length, 0);
});

test('daily menu uses daily snapshot price and excludes disabled, expired and private fields', () => {
  const result = adapters.mapDailyMenu({
    todayTaipei: '2026-11-08',
    setting: { order_date: '2026-11-09', ordering_enabled: true, notes: 'private' },
    regions: [{ order_date: '2026-11-09', region_name: '台北市', enabled: true, id: 1 }],
    items: [
      { id: 2, order_date: '2026-11-09', flavor_id: 7, product_name: '涼糕', flavor_name: '黑糖', price: 120, enabled: true, quantity: 3, admin_note: 'x' },
      { id: 3, order_date: '2026-11-09', flavor_id: 8, flavor_name: '停售', price: 80, enabled: false, quantity: 0 }
    ]
  });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].price, 120);
  assert.equal(result.items[0].available, true);
  assert.equal(Object.hasOwn(result, 'notes'), false);
  assert.equal(adapters.mapDailyMenu({
    todayTaipei: '2026-11-08',
    setting: { order_date: '2026-11-07', ordering_enabled: true }
  }), null);
});

test('stall schedule has no price keys under any circumstances', () => {
  const result = adapters.mapSchedule({
    schedule: { id: 4, schedule_date: '2026-11-09', schedule_type: 'stall', enabled: true, title: '市集', region: '台北', start_time: '10:00', end_time: '18:00', note: 'internal', address: 'private' },
    links: [{ schedule_id: 4, flavor_id: 7, price_per_box: 150, price: 999, unit_price: 888 }],
    flavorsById: { '7': { id: 7, name: '芋頭', enabled: true } }
  });
  assert.deepEqual(result.flavors, [{ flavorId: 7, name: '芋頭' }]);
  const serialized = JSON.stringify(result);
  for (const key of ['price', 'pricePerBox', 'unitPrice', 'address', 'note']) {
    assert.equal(serialized.includes(key), false, key);
  }
});

test('food truck schedule may expose only price_per_box, never legacy price columns', () => {
  const result = adapters.mapSchedule({
    schedule: { id: 5, schedule_date: '2026-11-09', schedule_type: 'food_truck', enabled: true, title: '餐車', region: '台北', start_time: '10:00', end_time: '18:00' },
    links: [{ schedule_id: 5, flavor_id: 7, price_per_box: 100, price: 999, unit_price: 888 }],
    flavorsById: { '7': { id: 7, name: '黑糖', enabled: true } }
  });
  assert.equal(result.flavors[0].pricePerBox, 100);
  assert.equal(Object.hasOwn(result.flavors[0], 'price'), false);
  assert.equal(Object.hasOwn(result.flavors[0], 'unitPrice'), false);
});

test('radish JSON adapter requires online flag and excludes internal JSON fields', () => {
  const result = adapters.mapRadishProducts({
    data: { products: [
      { id: 'r1', name: '蘿蔔糕', price: 200, spec: '盒', description: '介紹', image_url: 'img', enabled: true, online_enabled: true, sort: 1, secret: 'x' },
      { id: 'r2', name: '隱藏', price: 100, enabled: true, online_enabled: false }
    ] }
  });
  assert.equal(result.length, 1);
  assert.equal(Object.hasOwn(result[0], 'secret'), false);
  assert.equal(Object.hasOwn(result[0], 'sort'), false);
});

test('merchandise adapter requires enabled category and excludes inventory internals', () => {
  const result = adapters.mapMerchandise({
    categories: [{ id: 1, enabled: true }, { id: 2, enabled: false }],
    products: [
      { id: 1, category_id: 1, name: '帽子', price: 300, enabled: true, size_options: ['F'], product_code: 'H1', is_new: true, is_hot: false, stock: 10, low_stock_threshold: 2 },
      { id: 2, category_id: 2, name: '隱藏', price: 100, enabled: true }
    ]
  });
  assert.equal(result.length, 1);
  assert.equal(Object.hasOwn(result[0], 'stock'), false);
  assert.equal(Object.hasOwn(result[0], 'low_stock_threshold'), false);
});
