/** Phase 56 transaction, concurrency, rollback and authorization tests. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('./admin-transaction-mock-service');

const owner = { id: 'owner-1', role: 'owner' };
const productAdmin = { id: 'pa-1', role: 'product_admin' };
const orderAdmin = { id: 'oa-1', role: 'order_admin' };
const guest = { id: 'guest-1', role: 'customer' };
const dailyPayload = {
  orderDate: '2026-11-12',
  orderingEnabled: true,
  notes: '管理備註',
  regions: [{ regionName: '台北市', enabled: true }, { regionName: '新北市', enabled: true }],
  items: [
    { flavorId: 'f-1', productName: '涼糕', flavorName: '黑糖', price: 100, enabled: true, quantity: 10 },
    { flavorId: 'f-2', productName: '涼糕', flavorName: '芋頭', price: 150, enabled: true, quantity: 5 }
  ]
};
const radishData = { products: [
  { id: 'r-1', name: '原味蘿蔔糕', price: 200, enabled: true, online_enabled: true }
] };

test('daily order creates version 1 and stores daily price snapshot', () => {
  const store = service.createStore();
  const result = service.saveDailyOrder({ store, actor: owner, payload: dailyPayload, expectedVersion: 0, now: 1 });
  assert.equal(result.ok, true);
  assert.equal(result.record.version, 1);
  assert.equal(service.readDailyOrder(store, dailyPayload.orderDate).items[1].price, 150);
  assert.equal(store.audit.length, 1);
});

test('stale concurrent daily order update is rejected without overwriting newer data', () => {
  const store = service.createStore();
  service.saveDailyOrder({ store, actor: owner, payload: dailyPayload, expectedVersion: 0, now: 1 });
  const firstWriter = { ...dailyPayload, notes: '第一位管理員修改' };
  const secondWriter = { ...dailyPayload, notes: '第二位管理員修改' };
  assert.equal(service.saveDailyOrder({ store, actor: owner, payload: firstWriter, expectedVersion: 1, now: 2 }).ok, true);
  const conflict = service.saveDailyOrder({ store, actor: productAdmin, payload: secondWriter, expectedVersion: 1, now: 3 });
  assert.equal(conflict.reason, 'VERSION_CONFLICT');
  assert.equal(service.readDailyOrder(store, dailyPayload.orderDate).notes, '第一位管理員修改');
  assert.equal(store.audit.length, 2);
});

test('daily order injected transaction failure rolls back all data and audit writes', () => {
  const store = service.createStore();
  const before = JSON.stringify({
    rows: [...store.dailyOrders], audit: store.audit, idem: [...store.idempotency]
  });
  const result = service.saveDailyOrder({
    store, actor: owner, payload: dailyPayload, expectedVersion: 0, now: 1,
    idempotencyKey: 'daily-1', failAt: 'before_commit'
  });
  assert.equal(result.reason, 'TRANSACTION_ABORTED');
  assert.equal(JSON.stringify({
    rows: [...store.dailyOrders], audit: store.audit, idem: [...store.idempotency]
  }), before);
});

test('daily order rejects duplicate flavor IDs, malformed date and negative price', () => {
  const store = service.createStore();
  const duplicate = { ...dailyPayload, items: [dailyPayload.items[0], dailyPayload.items[0]] };
  assert.equal(service.saveDailyOrder({ store, actor: owner, payload: duplicate, expectedVersion: 0, now: 1 }).reason, 'DAILY_ORDER_INVALID');
  const badPrice = { ...dailyPayload, items: [{ ...dailyPayload.items[0], price: -1 }] };
  assert.equal(service.saveDailyOrder({ store, actor: owner, payload: badPrice, expectedVersion: 0, now: 1 }).reason, 'DAILY_ORDER_INVALID');
  const badDate = { ...dailyPayload, orderDate: '2026-02-30' };
  assert.equal(service.saveDailyOrder({ store, actor: owner, payload: badDate, expectedVersion: 0, now: 1 }).reason, 'DAILY_ORDER_INVALID');
});

test('only product managers may change daily order settings', () => {
  const store = service.createStore();
  assert.equal(service.saveDailyOrder({ store, actor: guest, payload: dailyPayload, expectedVersion: 0, now: 1 }).reason, 'ADMIN_FORBIDDEN');
  assert.equal(service.saveDailyOrder({ store, actor: orderAdmin, payload: dailyPayload, expectedVersion: 0, now: 1 }).reason, 'ADMIN_FORBIDDEN');
  assert.equal(service.saveDailyOrder({ store, actor: productAdmin, payload: dailyPayload, expectedVersion: 0, now: 1 }).ok, true);
});

test('daily order idempotency replays same payload and rejects key reuse with different payload', () => {
  const store = service.createStore();
  const first = service.saveDailyOrder({ store, actor: owner, payload: dailyPayload, expectedVersion: 0, now: 1, idempotencyKey: 'same-key' });
  const replay = service.saveDailyOrder({ store, actor: owner, payload: dailyPayload, expectedVersion: 0, now: 2, idempotencyKey: 'same-key' });
  assert.equal(first.ok, true);
  assert.equal(replay.replayed, true);
  assert.equal(store.audit.length, 1);
  const changed = { ...dailyPayload, notes: '不同內容' };
  assert.equal(service.saveDailyOrder({ store, actor: owner, payload: changed, expectedVersion: 0, now: 3, idempotencyKey: 'same-key' }).reason, 'IDEMPOTENCY_CONFLICT');
});

test('radish section requires seed, exact section and current version', () => {
  const store = service.createStore();
  assert.equal(service.updateRadishSection({ store, actor: owner, data: radishData, expectedVersion: 1, now: 1 }).reason, 'SECTION_NOT_FOUND');
  service.seedRadishSection(store, 'radish_products', radishData, 4);
  assert.equal(service.updateRadishSection({ store, actor: owner, sectionId: 'radish_order_settings', data: radishData, expectedVersion: 4, now: 2 }).reason, 'SECTION_FORBIDDEN');
  assert.equal(service.updateRadishSection({ store, actor: owner, data: radishData, expectedVersion: 3, now: 2 }).reason, 'VERSION_CONFLICT');
});

test('radish optimistic update increments version and preserves unrelated section data', () => {
  const store = service.createStore();
  service.seedRadishSection(store, 'radish_products', radishData, 1);
  service.seedRadishSection(store, 'radish_order_settings', { enabled: true }, 8);
  const result = service.updateRadishSection({
    store, actor: owner, data: { products: [...radishData.products, { id: 'r-2', name: '辣味', price: 220, enabled: true, online_enabled: true }] },
    expectedVersion: 1, now: 2
  });
  assert.equal(result.ok, true);
  assert.equal(result.version, 2);
  assert.deepEqual(service.readRadishSection(store, 'radish_order_settings').data, { enabled: true });
});

test('radish update failure rolls back section and audit atomically', () => {
  const store = service.createStore();
  service.seedRadishSection(store, 'radish_products', radishData, 1);
  const before = JSON.stringify({ row: service.readRadishSection(store), audit: store.audit });
  const result = service.updateRadishSection({
    store, actor: owner, data: radishData, expectedVersion: 1, now: 2, failAt: 'after_validation'
  });
  assert.equal(result.reason, 'TRANSACTION_ABORTED');
  assert.equal(JSON.stringify({ row: service.readRadishSection(store), audit: store.audit }), before);
});

test('radish rejects duplicate IDs and non-product admin roles', () => {
  const store = service.createStore();
  service.seedRadishSection(store, 'radish_products', radishData, 1);
  const duplicate = { products: [...radishData.products, radishData.products[0]] };
  assert.equal(service.updateRadishSection({ store, actor: owner, data: duplicate, expectedVersion: 1, now: 2 }).reason, 'RADISH_DATA_INVALID');
  assert.equal(service.updateRadishSection({ store, actor: orderAdmin, data: radishData, expectedVersion: 1, now: 2 }).reason, 'ADMIN_FORBIDDEN');
});

test('failed validation never mutates existing daily order record', () => {
  const store = service.createStore();
  service.saveDailyOrder({ store, actor: owner, payload: dailyPayload, expectedVersion: 0, now: 1 });
  const before = JSON.stringify(service.readDailyOrder(store, dailyPayload.orderDate));
  const bad = { ...dailyPayload, items: [{ ...dailyPayload.items[0], quantity: -4 }] };
  assert.equal(service.saveDailyOrder({ store, actor: owner, payload: bad, expectedVersion: 1, now: 2 }).reason, 'DAILY_ORDER_INVALID');
  assert.equal(JSON.stringify(service.readDailyOrder(store, dailyPayload.orderDate)), before);
});
