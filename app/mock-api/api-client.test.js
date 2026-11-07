#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPublicReadHttpServer } = require('./http-server');
const { ApiClientError, buildQuery, createPublicApiClient } = require('./api-client');

const fixtures = {
  flavors: [
    { id: 'f1', name: '水果綜合', price: 100, enabled: true },
    { id: 'f2', name: '黑糖', price: 90, enabled: true },
    { id: 'f3', name: '停用口味', price: 80, enabled: false }
  ],
  radishProducts: [{ id: 'r1', name: '純米蘿蔔糕', price: 180, enabled: true, online_enabled: true }],
  content: { home_banner: { title: '老爹．涼糕', content: '歡迎光臨', published: true } },
  schedules: [
    { id: 's1', schedule_type: 'food_truck', schedule_date: '2026-11-10', title: '餐車', enabled: true },
    { id: 's2', schedule_type: 'stall', schedule_date: '2026-11-11', title: '擺攤', enabled: true }
  ],
  scheduleFlavors: [
    { schedule_id: 's1', flavor_id: 'f1', price_per_box: 120 },
    { schedule_id: 's2', flavor_id: 'f1', price_per_box: 120 }
  ]
};

let server;
let baseUrl;
let client;

test.before(async () => {
  server = createPublicReadHttpServer({ fixtures });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  client = createPublicApiClient({ baseUrl, timeoutMs: 1000 });
});

test.after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
});

test('buildQuery encodes values and omits empty values', () => {
  assert.equal(buildQuery({ limit: 20, cursor: 'a+b/c=', type: '', unused: null }), '?limit=20&cursor=a%2Bb%2Fc%3D');
});

test('client reads catalog and validates response data', async () => {
  const result = await client.getCatalog({ limit: 1 });
  assert.equal(result.data.items.length, 1);
  assert.ok(result.meta.request_id);
});

test('client reads content', async () => {
  const result = await client.getContent();
  assert.equal(result.data.home_banner.title, '老爹．涼糕');
});

test('client reads schedules and passes filter', async () => {
  const result = await client.getSchedules({ type: 'stall' });
  assert.equal(result.data.items.length, 1);
  assert.equal('price' in result.data.items[0].flavors[0], false);
});

test('client fetches every catalog page', async () => {
  const result = await client.getAllCatalog({ limit: 1 });
  assert.equal(result.items.length, 3);
  assert.equal(result.pages, 3);
});

test('client fetches every schedule page with type filter', async () => {
  const result = await client.getAllSchedules({ type: 'food_truck', limit: 1 });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].type, 'food_truck');
});

test('HTTP validation errors become ApiClientError with request id', async () => {
  await assert.rejects(
    client.getCatalog({ limit: 999 }),
    error => error instanceof ApiClientError &&
      error.status === 400 &&
      error.code === 'VALIDATION_ERROR' &&
      Boolean(error.requestId) &&
      error.retryable === false
  );
});

test('unknown schedule type becomes a structured client error', async () => {
  await assert.rejects(
    client.getSchedules({ type: 'unknown' }),
    error => error instanceof ApiClientError && error.code === 'VALIDATION_ERROR'
  );
});

test('non-JSON and malformed success envelopes are rejected', async () => {
  const htmlClient = createPublicApiClient({
    baseUrl: 'http://mock.invalid',
    fetchImpl: async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => { throw new Error('bad json'); } })
  });
  await assert.rejects(htmlClient.getContent(), error => error.code === 'INVALID_JSON');

  const envelopeClient = createPublicApiClient({
    baseUrl: 'http://mock.invalid',
    fetchImpl: async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ nope: true }) })
  });
  await assert.rejects(envelopeClient.getContent(), error => error.code === 'INVALID_ENVELOPE');
});

test('network errors are normalized and marked retryable', async () => {
  const offline = createPublicApiClient({
    baseUrl: 'http://mock.invalid',
    fetchImpl: async () => { throw new Error('offline'); }
  });
  await assert.rejects(offline.getContent(), error => error.code === 'NETWORK_ERROR' && error.retryable);
});

test('timeout aborts a slow fetch and is retryable', async () => {
  const slow = createPublicApiClient({
    baseUrl: 'http://mock.invalid',
    timeoutMs: 15,
    fetchImpl: (_url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    })
  });
  await assert.rejects(slow.getContent(), error => error.code === 'TIMEOUT' && error.retryable);
});

test('caller abort is distinguished from timeout', async () => {
  const controller = new AbortController();
  const slow = createPublicApiClient({
    baseUrl: 'http://mock.invalid',
    timeoutMs: 1000,
    fetchImpl: (_url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    })
  });
  const pending = slow.getContent({ signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, error => error.code === 'ABORTED' && !error.retryable);
});

test('pagination guard prevents unbounded page requests', async () => {
  const endless = createPublicApiClient({
    baseUrl: 'http://mock.invalid',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ data: { items: [1], next_cursor: 'next' }, meta: { request_id: 'req', api_version: 'v1' } })
    })
  });
  await assert.rejects(endless.getAllCatalog({ maxPages: 2 }), error => error.code === 'PAGE_LIMIT_EXCEEDED');
});

test('invalid client options are rejected early', () => {
  assert.throws(() => createPublicApiClient({ baseUrl: '' }), TypeError);
  assert.throws(() => createPublicApiClient({ baseUrl, timeoutMs: 0 }), TypeError);
});
