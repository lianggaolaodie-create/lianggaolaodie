'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPublicReadApi } = require('./public-read-api');
const { createMockPublicRepository, createPublicRepository } = require('./public-repository');
const { ApiClientError } = require('./api-client');

const fixtures = {
  flavors: [
    { id: 'f1', name: '水果綜合', price: 100, enabled: true },
    { id: 'f2', name: '黑糖', price: 90, enabled: true }
  ],
  radishProducts: [
    { id: 'r1', name: '純米蘿蔔糕', price: 180, enabled: true, online_enabled: true }
  ],
  content: {
    home_banner: { title: '老爹．涼糕', content: '歡迎', image_url: '', published: true }
  },
  schedules: [
    { id: 't1', schedule_type: 'food_truck', schedule_date: '2026-11-10', title: '餐車', region: '台北', enabled: true },
    { id: 's1', schedule_type: 'stall', schedule_date: '2026-11-11', title: '擺攤', region: '新北', enabled: true }
  ],
  scheduleFlavors: [
    { schedule_id: 't1', flavor_id: 'f1', price_per_box: 120 },
    { schedule_id: 's1', flavor_id: 'f1', price_per_box: 120 }
  ]
};

test('mock repository exposes unified catalog/content/schedule read methods', async () => {
  const repository = createMockPublicRepository({ api: buildPublicReadApi(fixtures) });
  const catalog = await repository.listCatalog();
  const content = await repository.getPublishedContent();
  const schedules = await repository.listSchedules();

  assert.equal(catalog.data.items.length, 3);
  assert.equal(content.data.home_banner.title, '老爹．涼糕');
  assert.equal(schedules.data.items.length, 2);
  assert.equal(catalog.meta.api_version, 'v1');
  assert.ok(catalog.meta.request_id);
});

test('mock repository preserves truck price and omits stall price', async () => {
  const repository = createMockPublicRepository({ api: buildPublicReadApi(fixtures) });
  const truck = await repository.listSchedules({ type: 'food_truck' });
  const stall = await repository.listSchedules({ type: 'stall' });
  assert.equal(truck.data.items[0].flavors[0].price, 120);
  assert.equal('price' in stall.data.items[0].flavors[0], false);
  assert.equal('currency' in stall.data.items[0].flavors[0], false);
});

test('mock repository collects all catalog and schedule pages', async () => {
  const repository = createMockPublicRepository({ api: buildPublicReadApi(fixtures) });
  const catalog = await repository.listAllCatalog({ limit: 1 });
  const schedules = await repository.listAllSchedules({ limit: 1 });
  assert.equal(catalog.items.length, 3);
  assert.equal(catalog.pages, 3);
  assert.equal(schedules.items.length, 2);
  assert.equal(schedules.pages, 2);
});

test('mock repository enforces pagination safety limit', async () => {
  const repository = createMockPublicRepository({ api: buildPublicReadApi(fixtures) });
  await assert.rejects(
    repository.listAllCatalog({ limit: 1, maxPages: 1 }),
    error => error instanceof ApiClientError && error.code === 'PAGE_LIMIT_EXCEEDED'
  );
});

test('HTTP-backed repository delegates to client without adding write methods', async () => {
  const calls = [];
  const client = {
    async getCatalog(options) { calls.push(['catalog', options]); return { data: { items: [], next_cursor: null }, meta: { request_id: 'r1', api_version: 'v1' } }; },
    async getContent() { calls.push(['content']); return { data: {}, meta: { request_id: 'r2', api_version: 'v1' } }; },
    async getSchedules(options) { calls.push(['schedules', options]); return { data: { items: [], next_cursor: null }, meta: { request_id: 'r3', api_version: 'v1' } }; },
    async getAllCatalog(options) { return { items: [], pages: 0, meta: { request_id: 'r4', api_version: 'v1' } }; },
    async getAllSchedules(options) { return { items: [], pages: 0, meta: { request_id: 'r5', api_version: 'v1' } }; }
  };
  const repository = createPublicRepository({ client });
  await repository.listCatalog({ limit: 10 });
  await repository.getPublishedContent();
  await repository.listSchedules({ type: 'stall' });
  assert.deepEqual(calls, [
    ['catalog', { limit: 10 }],
    ['content'],
    ['schedules', { type: 'stall' }]
  ]);
  assert.equal('createOrder' in repository, false);
  assert.equal('updateOrder' in repository, false);
});

test('repository rejects malformed client and malformed response envelope', async () => {
  assert.throws(() => createPublicRepository({ client: {} }), TypeError);
  const repository = createPublicRepository({
    client: {
      async getCatalog() { return { data: { items: [] } }; },
      async getContent() { return { data: {}, meta: {} }; },
      async getSchedules() { return { data: { items: [] }, meta: {} }; }
    }
  });
  await assert.rejects(
    repository.listCatalog(),
    error => error instanceof ApiClientError && error.code === 'INVALID_ENVELOPE'
  );
});

test('mock repository requires a valid mock API adapter', () => {
  assert.throws(() => createMockPublicRepository({ api: {} }), TypeError);
});
