#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPublicReadApi } = require('./public-read-api');
const {
  DTO_SCHEMA,
  validateCatalogItem,
  validateContent,
  validateErrorEnvelope,
  validatePaginatedData,
  validateSchedule,
  validateSuccessEnvelope
} = require('./api-contract');

const fixtures = {
  flavors: [{ id: 'f1', name: '水果綜合', price: 100, enabled: true }],
  radishProducts: [{ id: 'r1', name: '純米蘿蔔糕', price: 180, enabled: true, online_enabled: true }],
  content: {
    home_banner: { title: '老爹．涼糕', content: '歡迎光臨', published: true, secret_note: 'must-not-leak' },
    announcement: { title: '未發布', content: '隱藏', published: false }
  },
  schedules: [
    { id: 'truck1', schedule_type: 'food_truck', schedule_date: '2026-11-10', title: '餐車', region: '台北', enabled: true },
    { id: 'stall1', schedule_type: 'stall', schedule_date: '2026-11-11', title: '擺攤', region: '新北', enabled: true }
  ],
  scheduleFlavors: [
    { schedule_id: 'truck1', flavor_id: 'f1', price_per_box: 120 },
    { schedule_id: 'stall1', flavor_id: 'f1', price_per_box: 120 }
  ]
};

const api = buildPublicReadApi(fixtures);
const meta = { request_id: 'req-contract-test', api_version: 'v1' };

test('catalog DTOs match contract for lianggao and radish products', () => {
  const data = api.getCatalog({ limit: 100 });
  assert.deepEqual(validatePaginatedData(data, validateCatalogItem), []);
  assert.equal(data.items[0].category, 'lianggao');
  assert.equal(data.items[1].category, 'radish_cake');
  assert.equal(data.items[0].currency, 'TWD');
});

test('published content DTOs match contract and unpublished sections are omitted', () => {
  const data = api.getContent();
  assert.deepEqual(validateContent(data), []);
  assert.equal(data.announcement, undefined);
  assert.equal(data.home_banner.secret_note, undefined);
});

test('food truck schedule DTO includes optional price and currency', () => {
  const data = api.getSchedules({ type: 'food_truck' });
  assert.deepEqual(validatePaginatedData(data, validateSchedule), []);
  assert.equal(data.items[0].flavors[0].price, 120);
  assert.equal(data.items[0].flavors[0].currency, 'TWD');
});

test('stall schedule DTO has no price or currency keys', () => {
  const data = api.getSchedules({ type: 'stall' });
  assert.deepEqual(validatePaginatedData(data, validateSchedule), []);
  assert.equal('price' in data.items[0].flavors[0], false);
  assert.equal('currency' in data.items[0].flavors[0], false);
});

test('success envelopes validate catalog and content response shapes', () => {
  const catalog = { data: api.getCatalog(), meta };
  const content = { data: api.getContent(), meta };
  assert.deepEqual(validateSuccessEnvelope(catalog, data => validatePaginatedData(data, validateCatalogItem)), []);
  assert.deepEqual(validateSuccessEnvelope(content, validateContent), []);
});

test('error envelope contract accepts standard structured error', () => {
  const envelope = {
    error: { code: 'VALIDATION_ERROR', message: '參數錯誤', field_errors: [], retryable: false },
    meta
  };
  assert.deepEqual(validateErrorEnvelope(envelope), []);
});

test('invalid DTOs are reported with field paths', () => {
  const badCatalog = { product_id: 1, name: '商品', category: 'unknown', price: -1, currency: 'TWD', available: 'yes' };
  const errors = validateCatalogItem(badCatalog);
  assert.ok(errors.some(x => x.includes('product_id')));
  assert.ok(errors.some(x => x.includes('category')));
  assert.ok(errors.some(x => x.includes('price')));
  assert.ok(errors.some(x => x.includes('available')));
});

test('stall DTO rejects price leakage', () => {
  const bad = {
    schedule_id: 's', type: 'stall', service_date: '2026-11-11', title: '擺攤',
    region: '新北', start_time: '', end_time: '',
    flavors: [{ flavor_id: 'f1', name: '水果綜合', price: 120 }]
  };
  assert.ok(validateSchedule(bad).some(x => x.includes('不得包含 price')));
});

test('invalid error envelope and API version are rejected', () => {
  assert.ok(validateErrorEnvelope({ error: {}, meta: {} }).length > 0);
  const result = validateSuccessEnvelope(
    { data: {}, meta: { request_id: 'r', api_version: 'v2' } },
    () => []
  );
  assert.ok(result.some(x => x.includes('api_version')));
});

test('schema declarations expose required and optional field inventory', () => {
  assert.ok(DTO_SCHEMA.catalogItem.required.includes('product_id'));
  assert.ok(DTO_SCHEMA.schedule.stallFlavorForbidden.includes('price'));
  assert.ok(DTO_SCHEMA.schedule.foodTruckFlavorOptional.includes('price'));
});
test('strict DTO allowlists reject unexpected fields', () => {
  const catalogErrors = validateCatalogItem({
    product_id: 'p1', name: '商品', category: 'lianggao',
    price: 100, currency: 'TWD', available: true, private_note: 'leak'
  });
  assert.ok(catalogErrors.some(x => x.includes('不支援欄位 private_note')));

  const contentErrors = validateContent({
    home_banner: { title: '', content: '', image_url: '', published: true, secret: 'leak' }
  });
  assert.ok(contentErrors.some(x => x.includes('不支援欄位 secret')));
});
