/**
 * Phase 53 catalog, flavor, schedule publishing and shared snapshot tests.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('./product-admin-model');
const owner = { id: 'owner-1', role: 'owner' };
const staff = { id: 'staff-1', role: 'staff' };
const baseProduct = { id: 'lg-1', type: 'lianggao', name: '綜合水果涼糕', spec: '一盒', priceMinor: 10000, onlineEnabled: true };
function setup() {
  const store = model.createAdminCatalogStore();
  const flavor = model.saveFlavor({ store, actor: owner, flavor: { id: 'f-1', productType: 'lianggao', name: '黑糖' }, now: 1 });
  assert.equal(flavor.ok, true);
  return store;
}
test('only owner/admin can manage product catalog', () => {
  const store = setup();
  assert.equal(model.saveProduct({ store, actor: staff, product: baseProduct, now: 2 }).reason, 'ADMIN_FORBIDDEN');
  assert.equal(model.saveProduct({ store, actor: owner, product: baseProduct, now: 2 }).ok, true);
});
test('lianggao and radish cake remain distinct product types', () => {
  const store = setup();
  assert.equal(model.saveProduct({ store, actor: owner, product: { ...baseProduct, id: 'r-1', type: 'radish_cake' }, now: 2 }).ok, true);
  assert.equal(store.products.get('lg-1').type, 'lianggao');
  assert.equal(store.products.get('r-1').type, 'radish_cake');
});
test('draft products stay private; published online products enter shared snapshot', () => {
  const store = setup();
  const saved = model.saveProduct({ store, actor: owner, product: baseProduct, now: 2 });
  assert.equal(model.buildPublicSnapshot(store).website.products.length, 0);
  const published = model.setProductState({ store, actor: owner, productId: 'lg-1', state: 'published', expectedVersion: saved.product.version, now: 3 });
  assert.equal(published.ok, true);
  const snapshot = model.buildPublicSnapshot(store);
  assert.equal(snapshot.website, snapshot.app);
  assert.equal(snapshot.website.products[0].name, '綜合水果涼糕');
});
test('product publish requires online switch and valid price; stale version is rejected', () => {
  const store = setup();
  const saved = model.saveProduct({ store, actor: owner, product: { ...baseProduct, onlineEnabled: false }, now: 2 });
  assert.equal(model.setProductState({ store, actor: owner, productId: 'lg-1', state: 'published', expectedVersion: saved.product.version, now: 3 }).reason, 'PRODUCT_NOT_READY_TO_PUBLISH');
  assert.equal(model.setProductState({ store, actor: owner, productId: 'lg-1', state: 'paused', expectedVersion: 99, now: 3 }).reason, 'VERSION_CONFLICT');
});
test('flavors are linked to a product type and cannot be mixed into radish cake', () => {
  const store = setup();
  const radish = model.saveFlavor({ store, actor: owner, flavor: { id: 'rf-1', productType: 'radish_cake', name: '原味' }, now: 2 });
  assert.equal(radish.ok, true);
  const result = model.saveSchedule({ store, actor: owner, schedule: { id: 's-1', type: 'food_truck', serviceDate: '2026-11-09', region: '台北市', location: '測試地點', startTime: '10:00', endTime: '12:00', flavorIds: ['rf-1'] }, now: 3 });
  assert.equal(result.reason, 'SCHEDULE_INVALID');
});
test('food truck may publish menu prices; stall never exposes price', () => {
  const store = setup();
  const truck = model.saveSchedule({ store, actor: owner, schedule: { id: 'truck-1', type: 'food_truck', serviceDate: '2026-11-09', region: '台北市', location: '測試地點', startTime: '10:00', endTime: '12:00', flavorIds: ['f-1'], prices: { 'f-1': 10000 } }, now: 2 });
  const stall = model.saveSchedule({ store, actor: owner, schedule: { id: 'stall-1', type: 'stall', serviceDate: '2026-11-09', region: '台北市', location: '測試市集', startTime: '13:00', endTime: '15:00', flavorIds: ['f-1'], prices: { 'f-1': 10000 } }, now: 2 });
  assert.equal(truck.ok, true);
  assert.deepEqual(stall.schedule.prices, {});
  model.setScheduleState({ store, actor: owner, scheduleId: 'truck-1', state: 'published', expectedVersion: truck.schedule.version, now: 3 });
  model.setScheduleState({ store, actor: owner, scheduleId: 'stall-1', state: 'published', expectedVersion: stall.schedule.version, now: 3 });
  const snapshot = model.buildPublicSnapshot(store);
  const truckMenu = snapshot.app.schedules.find(item => item.id === 'truck-1').flavors[0];
  const stallMenu = snapshot.app.schedules.find(item => item.id === 'stall-1').flavors[0];
  assert.equal(truckMenu.priceMinor, 10000);
  assert.equal(Object.hasOwn(stallMenu, 'priceMinor'), false);
});
test('cancelled and draft schedules are excluded from public app and website', () => {
  const store = setup();
  const draft = model.saveSchedule({ store, actor: owner, schedule: { id: 's-draft', type: 'stall', serviceDate: '2026-11-09', region: '台北市', location: '市集', startTime: '10:00', endTime: '12:00', flavorIds: ['f-1'] }, now: 2 });
  assert.equal(draft.ok, true);
  const snapshot = model.buildPublicSnapshot(store);
  assert.equal(snapshot.app.schedules.length, 0);
});
test('public snapshots are read-only and versioned; invalid client is rejected', () => {
  const store = setup();
  const first = model.buildPublicSnapshot(store);
  const second = model.buildPublicSnapshot(store);
  assert.equal(second.revision, first.revision + 1);
  assert.equal(model.getPublicSnapshot(store, 'app').snapshot, model.getPublicSnapshot(store, 'website').snapshot);
  assert.equal(model.getPublicSnapshot(store, 'pda').reason, 'CLIENT_INVALID');
});
test('audit trail records admin mutations without exposing it in public data', () => {
  const store = setup();
  model.saveProduct({ store, actor: owner, product: baseProduct, now: 2 });
  const snapshot = model.buildPublicSnapshot(store);
  assert.equal(store.audit.length, 2);
  assert.equal(Object.hasOwn(snapshot.app, 'audit'), false);
});
