#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPublicReadHttpServer } = require('./http-server');

const fixtures = {
  flavors: [
    { id: 'f1', name: '水果綜合', price: 100, enabled: true },
    { id: 'f2', name: '停用口味', price: 80, enabled: false }
  ],
  radishProducts: [
    { id: 'r1', name: '純米蘿蔔糕', price: 180, enabled: true, online_enabled: true }
  ],
  content: {
    home_banner: { title: '老爹．涼糕', content: '歡迎光臨', published: true, internal_note: 'do-not-leak' },
    announcement: { title: '未發布公告', content: '不可公開', published: false }
  },
  schedules: [
    { id: 's1', schedule_type: 'food_truck', schedule_date: '2026-11-10', title: '餐車', region: '台北', enabled: true },
    { id: 's2', schedule_type: 'stall', schedule_date: '2026-11-11', title: '擺攤', region: '新北', enabled: true }
  ],
  scheduleFlavors: [
    { schedule_id: 's1', flavor_id: 'f1', price_per_box: 120 },
    { schedule_id: 's2', flavor_id: 'f1', price_per_box: 120 }
  ]
};

let server;
let baseUrl;

test.before(async () => {
  server = createPublicReadHttpServer({ fixtures });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
});

async function get(path, options) {
  const response = await fetch(baseUrl + path, options);
  const body = await response.json();
  return { response, body };
}

test('GET catalog returns standard envelope and request id', async () => {
  const { response, body } = await get('/api/v1/catalog');
  assert.equal(response.status, 200);
  assert.equal(body.meta.api_version, 'v1');
  assert.ok(body.meta.request_id);
  assert.equal(response.headers.get('x-request-id'), body.meta.request_id);
  assert.equal(body.data.items.length, 2);
});

test('GET content exposes only published allowlisted fields', async () => {
  const { response, body } = await get('/api/v1/content');
  assert.equal(response.status, 200);
  assert.equal(body.data.home_banner.title, '老爹．涼糕');
  assert.equal(body.data.announcement, undefined);
  assert.equal(body.data.home_banner.internal_note, undefined);
});

test('GET schedules keeps stall price fields absent', async () => {
  const { body } = await get('/api/v1/schedules?type=stall');
  assert.equal(body.data.items.length, 1);
  assert.equal('price' in body.data.items[0].flavors[0], false);
  assert.equal('currency' in body.data.items[0].flavors[0], false);
});

test('GET schedules includes food truck price', async () => {
  const { body } = await get('/api/v1/schedules?type=food_truck');
  assert.equal(body.data.items[0].flavors[0].price, 120);
});

test('catalog cursor pagination works over HTTP', async () => {
  const first = await get('/api/v1/catalog?limit=1');
  assert.equal(first.body.data.items.length, 1);
  assert.ok(first.body.data.next_cursor);
  const second = await get('/api/v1/catalog?limit=1&cursor=' + encodeURIComponent(first.body.data.next_cursor));
  assert.equal(second.body.data.items.length, 1);
  assert.equal(second.body.data.next_cursor, null);
});

test('invalid query values use structured error envelope', async () => {
  const { response, body } = await get('/api/v1/catalog?limit=999');
  assert.equal(response.status, 400);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
  assert.ok(body.meta.request_id);
  assert.equal(body.error.retryable, false);
});

test('unknown and duplicate query parameters are rejected', async () => {
  const unknown = await get('/api/v1/content?include_private=true');
  assert.equal(unknown.response.status, 400);
  const duplicate = await get('/api/v1/catalog?limit=1&limit=2');
  assert.equal(duplicate.response.status, 400);
});

test('unknown route returns 404 envelope', async () => {
  const { response, body } = await get('/api/v1/admin/orders');
  assert.equal(response.status, 404);
  assert.equal(body.error.code, 'NOT_FOUND');
});

test('write methods are not available', async () => {
  const { response, body } = await get('/api/v1/catalog', { method: 'POST' });
  assert.equal(response.status, 405);
  assert.equal(body.error.code, 'METHOD_NOT_ALLOWED');
});

test('every request receives a unique request id', async () => {
  const a = await get('/api/v1/content');
  const b = await get('/api/v1/content');
  assert.notEqual(a.body.meta.request_id, b.body.meta.request_id);
});
