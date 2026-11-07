'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { SCREEN_STATUS } = require('./screen-state');
const { createCustomerScreenController } = require('./customer-screen-controller');

function makeRepository(overrides = {}) {
  const calls = [];
  const repository = {
    async getPublishedContent(options = {}) {
      calls.push(['home', options]);
      return { data: {
        home_banner: { title: '老爹．涼糕', content: '歡迎', image_url: '', published: true },
        hidden: { title: '內部', content: '不公開', image_url: '', published: false }
      }, meta: { request_id: 'home' } };
    },
    async listAllCatalog(options = {}) {
      calls.push(['catalog', options]);
      return { items: [
        { product_id: 'f1', name: '水果綜合', category: 'lianggao', price: 100, currency: 'TWD', available: true },
        { product_id: 'r1', name: '純米蘿蔔糕', category: 'radish_cake', price: 180, currency: 'TWD', available: true }
      ], pages: 1, meta: { request_id: 'catalog' } };
    },
    async listAllSchedules(options = {}) {
      calls.push(['schedules', options]);
      const all = [
        { schedule_id: 't1', type: 'food_truck', service_date: '2026-11-10', title: '餐車', region: '台北', start_time: '10:00', end_time: '18:00', flavors: [{ flavor_id: 'f1', name: '水果綜合', price: 120, currency: 'TWD' }] },
        { schedule_id: 's1', type: 'stall', service_date: '2026-11-11', title: '市場擺攤', region: '新北', start_time: '08:00', end_time: '12:00', flavors: [{ flavor_id: 'f1', name: '水果綜合', price: 120, currency: 'TWD' }] }
      ];
      return { items: all.filter(x => !options.type || x.type === options.type), pages: 1, meta: { request_id: 'schedules' } };
    },
    ...overrides
  };
  return { repository, calls };
}

test('controller loads homepage published sections and reports success', async () => {
  const { repository } = makeRepository();
  const controller = createCustomerScreenController({ repository });
  const result = await controller.loadHome();
  const state = controller.getState().home;
  assert.equal(result.ok, true);
  assert.equal(state.status, SCREEN_STATUS.SUCCESS);
  assert.equal(state.data.length, 1);
  assert.equal(state.data[0].title, '老爹．涼糕');
});

test('controller loads catalog through repository and maps lianggao and radish products', async () => {
  const { repository, calls } = makeRepository();
  const controller = createCustomerScreenController({ repository, catalogLimit: 25 });
  await controller.loadCatalog();
  const state = controller.getState().catalog;
  assert.equal(state.status, SCREEN_STATUS.SUCCESS);
  assert.deepEqual(state.data.map(x => x.category), ['涼糕', '蘿蔔糕']);
  assert.equal(calls.find(x => x[0] === 'catalog')[1].limit, 25);
});

test('truck schedules may show price; stall schedules must never expose price', async () => {
  const { repository } = makeRepository();
  const controller = createCustomerScreenController({ repository });
  await controller.loadTruckSchedules();
  await controller.loadStallSchedules();
  const truckFlavor = controller.getState().truckSchedules.data[0].flavors[0];
  const stallFlavor = controller.getState().stallSchedules.data[0].flavors[0];
  assert.equal(truckFlavor.priceLabel, 'NT$ 120');
  assert.equal('priceLabel' in stallFlavor, false);
  assert.equal('price' in stallFlavor, false);
  assert.equal('currency' in stallFlavor, false);
});

test('empty repository results become empty screen states', async () => {
  const { repository } = makeRepository({
    async listAllCatalog() { return { items: [], pages: 0, meta: {} }; }
  });
  const controller = createCustomerScreenController({ repository });
  await controller.loadCatalog();
  assert.equal(controller.getState().catalog.status, SCREEN_STATUS.EMPTY);
});

test('refresh retains last successful data if repository fails', async () => {
  let calls = 0;
  const { repository } = makeRepository({
    async listAllCatalog() {
      calls += 1;
      if (calls === 1) return { items: [{ product_id: 'f1', name: '水果綜合', category: 'lianggao', price: 100, currency: 'TWD', available: true }], pages: 1 };
      throw { code: 'NETWORK_ERROR', message: '目前無法連線', retryable: true };
    }
  });
  const controller = createCustomerScreenController({ repository });
  await controller.loadCatalog();
  const result = await controller.loadCatalog();
  const state = controller.getState().catalog;
  assert.equal(result.ok, false);
  assert.equal(state.status, SCREEN_STATUS.SUCCESS);
  assert.equal(state.data[0].name, '水果綜合');
  assert.equal(state.error.message, '目前無法連線');
  assert.equal(state.canRetry, true);
});

test('new request supersedes previous request and stale response cannot overwrite it', async () => {
  let resolveFirst;
  let calls = 0;
  const { repository } = makeRepository({
    listAllCatalog() {
      calls += 1;
      if (calls === 1) return new Promise(resolve => { resolveFirst = resolve; });
      return Promise.resolve({ items: [{ product_id: 'new', name: '新資料', category: 'lianggao', price: 100, currency: 'TWD', available: true }] });
    }
  });
  const controller = createCustomerScreenController({ repository });
  const first = controller.loadCatalog();
  await Promise.resolve();
  const second = await controller.loadCatalog();
  resolveFirst({ items: [{ product_id: 'old', name: '舊資料', category: 'lianggao', price: 100, currency: 'TWD', available: true }] });
  await first;
  assert.equal(second.ok, true);
  assert.equal(controller.getState().catalog.data[0].name, '新資料');
});

test('cancel aborts pending request and returns screen to idle', async () => {
  let signalSeen;
  let resolvePending;
  const { repository } = makeRepository({
    listAllCatalog(options) {
      signalSeen = options.signal;
      return new Promise(resolve => { resolvePending = resolve; });
    }
  });
  const controller = createCustomerScreenController({ repository });
  const pending = controller.loadCatalog();
  await Promise.resolve();
  assert.equal(controller.cancel('catalog'), true);
  assert.equal(signalSeen.aborted, true);
  assert.equal(controller.getState().catalog.status, SCREEN_STATUS.IDLE);
  resolvePending({ items: [] });
  const result = await pending;
  assert.equal(result.cancelled, true);
  assert.equal(controller.getState().catalog.status, SCREEN_STATUS.IDLE);
});

test('subscriptions receive state snapshots and can unsubscribe', async () => {
  const { repository } = makeRepository();
  const controller = createCustomerScreenController({ repository });
  const seen = [];
  const unsubscribe = controller.subscribe(state => seen.push(state.home.status));
  await controller.loadHome();
  unsubscribe();
  await controller.loadCatalog();
  assert.deepEqual(seen, [SCREEN_STATUS.LOADING, SCREEN_STATUS.SUCCESS]);
});

test('cancelAll cancels active screens and dispose prevents later work', async () => {
  let pendingResolve;
  const { repository } = makeRepository({
    getPublishedContent(options) {
      return new Promise(resolve => { pendingResolve = resolve; });
    }
  });
  const controller = createCustomerScreenController({ repository });
  const pending = controller.loadHome();
  await Promise.resolve();
  controller.cancelAll();
  pendingResolve({ data: {} });
  const result = await pending;
  assert.equal(result.cancelled, true);
  controller.dispose();
  await assert.rejects(controller.loadHome(), /已結束使用/);
});

test('invalid dependencies and limits are rejected', () => {
  assert.throws(() => createCustomerScreenController({ repository: {} }), TypeError);
  const { repository } = makeRepository();
  assert.throws(() => createCustomerScreenController({ repository, catalogLimit: 101 }), TypeError);
});
