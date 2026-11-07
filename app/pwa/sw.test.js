'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function createWorker({ fetchImpl = async () => new Response('network') } = {}) {
  const handlers = {};
  const cacheData = new Map();
  const deleted = [];
  let claimed = false;
  let skipped = false;

  const caches = {
    async open(name) {
      if (!cacheData.has(name)) cacheData.set(name, new Map());
      const store = cacheData.get(name);
      return {
        async addAll() {},
        async match(request) {
          const key = typeof request === 'string' ? request : request.url;
          return store.get(key);
        },
        async put(request, response) {
          const key = typeof request === 'string' ? request : request.url;
          store.set(key, response);
        }
      };
    },
    async keys() { return [...cacheData.keys()]; },
    async delete(name) { deleted.push(name); return cacheData.delete(name); }
  };

  const self = {
    location: { origin: 'https://example.test' },
    registration: { scope: 'https://example.test/app/pwa/' },
    clients: { claim: async () => { claimed = true; } },
    skipWaiting: () => { skipped = true; },
    addEventListener(name, handler) { handlers[name] = handler; }
  };

  const context = { self, caches, URL, Response, Promise, fetch: fetchImpl };
  vm.runInNewContext(
    fs.readFileSync(require.resolve('./sw.js'), 'utf8'),
    context,
    { filename: 'sw.js' }
  );

  return {
    handlers, cacheData, deleted,
    get claimed() { return claimed; },
    get skipped() { return skipped; }
  };
}

test('activate removes only previous Laodie PWA caches', async () => {
  const worker = createWorker();
  worker.cacheData.set('laodie-pwa-shell-v1', new Map());
  worker.cacheData.set('another-site-cache', new Map());
  worker.cacheData.set('laodie-pwa-shell-v2', new Map());
  let activation;
  worker.handlers.activate({ waitUntil(promise) { activation = promise; } });
  await activation;
  assert.deepEqual(worker.deleted, ['laodie-pwa-shell-v1']);
  assert.equal(worker.cacheData.has('another-site-cache'), true);
  assert.equal(worker.claimed, true);
});

test('install pre-caches the static shell and activates immediately', async () => {
  const worker = createWorker();
  let installation;
  worker.handlers.install({ waitUntil(promise) { installation = promise; } });
  await installation;
  assert.equal(worker.cacheData.has('laodie-pwa-shell-v2'), true);
  assert.equal(worker.skipped, true);
});

test('fetch handler ignores non-GET, cross-origin, and out-of-scope requests', () => {
  const worker = createWorker();
  for (const request of [
    { method: 'POST', url: 'https://example.test/app/pwa/order' },
    { method: 'GET', url: 'https://other.test/app/pwa/index.html' },
    { method: 'GET', url: 'https://example.test/other/index.html' }
  ]) {
    let intercepted = false;
    worker.handlers.fetch({
      request,
      respondWith() { intercepted = true; }
    });
    assert.equal(intercepted, false);
  }
});

test('GET requests in PWA scope use cache-first and cache successful network responses', async () => {
  let networkCalls = 0;
  const worker = createWorker({
    fetchImpl: async () => {
      networkCalls += 1;
      return new Response('fresh asset', { status: 200 });
    }
  });
  const request = { method: 'GET', url: 'https://example.test/app/pwa/app.js', mode: 'same-origin' };
  let responsePromise;
  worker.handlers.fetch({ request, respondWith(promise) { responsePromise = promise; } });
  assert.equal(await (await responsePromise).text(), 'fresh asset');
  assert.equal(networkCalls, 1);

  worker.handlers.fetch({ request, respondWith(promise) { responsePromise = promise; } });
  assert.equal(await (await responsePromise).text(), 'fresh asset');
  assert.equal(networkCalls, 1);
});

test('offline fallback is returned only for navigation requests', async () => {
  const worker = createWorker({ fetchImpl: async () => { throw new Error('offline'); } });
  const cache = await worker.cacheData.set('laodie-pwa-shell-v2', new Map());
  const store = worker.cacheData.get('laodie-pwa-shell-v2');
  store.set('https://example.test/app/pwa/index.html', new Response('offline home'));

  let navigationResponse;
  worker.handlers.fetch({
    request: { method: 'GET', url: 'https://example.test/app/pwa/products', mode: 'navigate' },
    respondWith(promise) { navigationResponse = promise; }
  });
  assert.equal(await (await navigationResponse).text(), 'offline home');

  let assetResponse;
  worker.handlers.fetch({
    request: { method: 'GET', url: 'https://example.test/app/pwa/app.js', mode: 'same-origin' },
    respondWith(promise) { assetResponse = promise; }
  });
  assert.equal((await assetResponse).type, 'error');
});
