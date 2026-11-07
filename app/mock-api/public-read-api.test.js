#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ApiError,
  buildPublicReadApi,
  mapCatalog,
  mapPublicContent,
  mapSchedule,
  paginate
} = require('./public-read-api');

const fixtures = {
  flavors: [
    { id: 'f1', name: '水果綜合', price: 100, enabled: true },
    { id: 'f2', name: '已停用口味', price: 80, enabled: false },
    { id: 'f3', name: '未定價口味', price: null, enabled: true }
  ],
  radishProducts: [
    { id: 'r1', name: '純米蘿蔔糕', price: 180, enabled: true, online_enabled: true, spec: '一份' },
    { id: 'r2', name: '僅官網展示', price: 200, enabled: true, online_enabled: false },
    { id: 'r3', name: '已下架', price: 220, enabled: false, online_enabled: true }
  ],
  content: {
    home_banner: { title: '老爹．涼糕', content: '歡迎光臨', published: true, internal_note: 'secret' },
    radish_products: { title: '蘿蔔糕', content: '商品資訊' },
    admin_only: { title: '不應公開', content: '內部資料' }
  },
  schedules: [
    { id: 's1', schedule_type: 'food_truck', schedule_date: '2026-11-10', title: '餐車', region: '台北', enabled: true },
    { id: 's2', schedule_type: 'stall', schedule_date: '2026-11-11', title: '擺攤', region: '新北', enabled: true },
    { id: 's3', schedule_type: 'stall', schedule_date: '2026-11-12', title: '停用行程', enabled: false },
    { id: 's4', schedule_type: 'unknown', schedule_date: '2026-11-13', enabled: true }
  ],
  scheduleFlavors: [
    { schedule_id: 's1', flavor_id: 'f1', price_per_box: 120 },
    { schedule_id: 's2', flavor_id: 'f1', price_per_box: 120 }
  ]
};

test('catalog returns enabled flavors and separates radish online switch', () => {
  const items = mapCatalog(fixtures);
  assert.equal(items.length, 4);
  assert.equal(items.find(x => x.product_id === 'f2'), undefined);
  assert.equal(items.find(x => x.product_id === 'r2').available, false);
  assert.equal(items.find(x => x.product_id === 'r3'), undefined);
  assert.equal(items.find(x => x.product_id === 'f3').available, false);
});

test('catalog only emits safe, documented fields', () => {
  const item = mapCatalog(fixtures)[0];
  assert.deepEqual(Object.keys(item).sort(), ['available', 'category', 'currency', 'name', 'price', 'product_id'].sort());
});

test('content allowlist drops private sections and unknown fields', () => {
  const content = mapPublicContent(fixtures.content);
  assert.equal(content.admin_only, undefined);
  assert.equal(content.home_banner.internal_note, undefined);
  assert.equal(content.home_banner.title, '老爹．涼糕');
});

test('content rejects non-object input', () => {
  assert.throws(() => mapPublicContent([]), ApiError);
});

test('food truck schedule may include server-selected price', () => {
  const item = mapSchedule(fixtures.schedules[0], fixtures.scheduleFlavors, fixtures.flavors);
  assert.equal(item.flavors[0].price, 120);
});

test('stall schedule never contains price fields', () => {
  const item = mapSchedule(fixtures.schedules[1], fixtures.scheduleFlavors, fixtures.flavors);
  assert.equal(item.flavors.length, 1);
  assert.equal('price' in item.flavors[0], false);
  assert.equal('currency' in item.flavors[0], false);
});

test('disabled and unknown schedule types are omitted', () => {
  assert.equal(mapSchedule(fixtures.schedules[2]), null);
  assert.equal(mapSchedule(fixtures.schedules[3]), null);
});

test('schedule list supports filtering by type', () => {
  const api = buildPublicReadApi(fixtures);
  assert.equal(api.getSchedules({ type: 'stall' }).items.length, 1);
  assert.equal(api.getSchedules({ type: 'food_truck' }).items.length, 1);
});

test('schedule type validation rejects unknown values', () => {
  const api = buildPublicReadApi(fixtures);
  assert.throws(() => api.getSchedules({ type: 'secret' }), ApiError);
});

test('cursor pagination returns next cursor and final page', () => {
  const first = paginate([1, 2, 3], { limit: 2 });
  assert.deepEqual(first.items, [1, 2]);
  assert.ok(first.next_cursor);
  const second = paginate([1, 2, 3], { limit: 2, cursor: first.next_cursor });
  assert.deepEqual(second.items, [3]);
  assert.equal(second.next_cursor, null);
});

test('invalid cursor and limit are rejected', () => {
  assert.throws(() => paginate([1], { cursor: 'not-a-cursor' }), ApiError);
  assert.throws(() => paginate([1], { limit: 101 }), ApiError);
});

test('disabled flavors are never exposed in schedules', () => {
  const schedule = { id: 's', schedule_type: 'food_truck', enabled: true };
  const links = [{ schedule_id: 's', flavor_id: 'off' }];
  const mapped = mapSchedule(schedule, links, [{ id: 'off', name: '停用', enabled: false }]);
  assert.equal(mapped.flavors.length, 0);
});

test('API instance returns catalog and public content only', () => {
  const api = buildPublicReadApi(fixtures);
  assert.equal(api.getCatalog().items.length, 4);
  assert.equal(api.getContent().admin_only, undefined);
});

test('malformed source arrays fail closed', () => {
  assert.throws(() => mapCatalog({ flavors: {}, radishProducts: [] }), ApiError);
});

test('schedule output never leaks internal database row fields', () => {
  const row = { ...fixtures.schedules[1], internal_note: 'private', created_by: 'admin-id' };
  const mapped = mapSchedule(row, fixtures.scheduleFlavors, fixtures.flavors);
  assert.equal('internal_note' in mapped, false);
  assert.equal('created_by' in mapped, false);
});
