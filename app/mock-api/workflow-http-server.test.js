'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorkflowHttpServer } = require('./workflow-http-server');
const members = require('./member-order-model');
const owner = require('./owner-order-admin-model');

const cart = { items: [{ productId: 'f1', variantId: '', quantity: 2 }] };
const fulfillmentMethod = 'lianggao_home_delivery';
const recipient = { name: '測試顧客', phone: '0900000000', address: '台北市測試路 1 號' };
let server, baseUrl, memberStore, ownerStore, actor;
let clock = 1000;
const headers = { 'content-type': 'application/json' };
async function call(path, method = 'GET', body, extraHeaders = {}) {
  const response = await fetch(baseUrl + path, {
    method, headers: { ...headers, ...extraHeaders },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  return { response, body: await response.json() };
}

test.before(async () => {
  memberStore = members.createMemberOrderStore();
  ownerStore = owner.createOwnerOrderStore();
  members.registerSyntheticOrder({
    store: memberStore,
    order: { orderId: 'M67-1', ownerSubject: 'member-1', status: 'confirmed', paymentStatus: 'confirmed', fulfillmentType: 'home_delivery' },
    now: 900
  });
  members.registerSyntheticOrder({
    store: memberStore,
    order: { orderId: 'G67-1', status: 'awaiting_payment', paymentStatus: 'unpaid', fulfillmentType: 'cold_store_pickup' },
    now: 900
  });
  owner.seedOwnerOrder({
    store: ownerStore, now: 900,
    order: { orderId: 'A67-1', orderStatus: 'confirmed', paymentStatus: 'confirmed', fulfillmentStatus: 'unprepared', productType: 'lianggao', source: 'online', fulfillmentType: 'home_delivery' }
  });
  actor = { verified: true, subject: 'order-admin', role: 'order_admin' };
  server = createWorkflowHttpServer({
    trustedCatalog: { f1: { enabled: true, onlineEnabled: true, category: 'lianggao', unitPriceMinor: 10000, name: '黑糖' } },
    trustedRates: { [fulfillmentMethod]: { enabled: true, feeMinor: 4000 } },
    memberStore, ownerStore,
    resolvePrincipal: async req => req.headers['x-test-role'] === 'order_admin'
      ? actor
      : req.headers['x-test-member'] === 'member-1'
        ? { verified: true, subject: 'member-1' }
        : req.headers['x-test-member'] === 'member-2'
          ? { verified: true, subject: 'member-2' }
          : null,
    now: () => clock
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = 'http://127.0.0.1:' + server.address().port;
});
test.after(async () => { if (server) await new Promise(resolve => server.close(resolve)); });

test('health returns v1 envelope and request id', async () => {
  const { response, body } = await call('/api/v1/health');
  assert.equal(response.status, 200);
  assert.equal(body.data.status, 'mock_only');
  assert.equal(body.meta.api_version, 'v1');
  assert.equal(response.headers.get('x-request-id'), body.meta.request_id);
});

test('quote is computed from trusted catalog and rate, not client price', async () => {
  const { response, body } = await call('/api/v1/quotes', 'POST', {
    cart, fulfillmentMethod, recipient, unitPriceMinor: 1, totalMinor: 1, shippingFeeMinor: 0
  });
  assert.equal(response.status, 201);
  assert.equal(body.data.totalMinor, 24000);
  assert.equal(body.data.orderCreationEnabled, false);
});

test('invalid quote input returns structured 422 without leaking internals', async () => {
  const { response, body } = await call('/api/v1/quotes', 'POST', { cart: { items: [] }, fulfillmentMethod, recipient });
  assert.equal(response.status, 422);
  assert.equal(body.error.code, 'QUOTE_REJECTED');
  assert.equal(typeof body.meta.request_id, 'string');
  assert.equal(JSON.stringify(body).includes('stack'), false);
});

test('checkout authorization needs quote and idempotency key; does not create order or charge', async () => {
  const quote = await call('/api/v1/quotes', 'POST', { cart, fulfillmentMethod, recipient });
  const { response, body } = await call('/api/v1/checkout/authorize', 'POST', {
    quoteId: quote.body.data.quoteId, cart, fulfillmentMethod, recipient,
    sessionId: 'session-67', totalMinor: 1, paymentStatus: 'confirmed'
  }, { 'idempotency-key': 'phase67-checkout-0001' });
  assert.equal(response.status, 200);
  assert.equal(body.data.totalMinor, 24000);
  assert.equal(body.data.orderCreationEnabled, false);
  assert.equal(body.data.paymentExecutionEnabled, false);
});

test('member can read own order; another member receives hidden 404', async () => {
  const own = await call('/api/v1/member/orders/M67-1', 'GET', undefined, { 'x-test-member': 'member-1' });
  assert.equal(own.response.status, 200);
  const other = await call('/api/v1/member/orders/M67-1', 'GET', undefined, { 'x-test-member': 'member-2' });
  assert.equal(other.response.status, 404);
  assert.equal(other.body.error.code, 'ORDER_NOT_FOUND');
});

test('guest claim token is required for guest order lookup', async () => {
  const claim = members.issueGuestOrderClaim({ store: memberStore, orderId: 'G67-1', now: clock, ttlMs: 60000 });
  const denied = await call('/api/v1/guest/orders/G67-1');
  assert.equal(denied.response.status, 404);
  const allowed = await call('/api/v1/guest/orders/G67-1', 'GET', undefined, { 'x-guest-order-claim': claim.token });
  assert.equal(allowed.response.status, 200);
});

test('owner fulfillment endpoint checks server-resolved role and version', async () => {
  const denied = await call('/api/v1/admin/orders/A67-1/fulfillment', 'PATCH', {
    nextStatus: 'preparing', expectedVersion: 1
  }, { 'idempotency-key': 'phase67-admin-denied-0001' });
  assert.equal(denied.response.status, 403);
  const allowed = await call('/api/v1/admin/orders/A67-1/fulfillment', 'PATCH', {
    nextStatus: 'preparing', expectedVersion: 1
  }, { 'x-test-role': 'order_admin', 'idempotency-key': 'phase67-admin-allowed-001' });
  assert.equal(allowed.response.status, 200);
  assert.equal(allowed.body.data.fulfillmentStatus, 'preparing');
  assert.equal(allowed.body.data.version, 2);
});

test('unknown route and unsupported method return standard errors', async () => {
  const missing = await call('/api/v1/not-found');
  assert.equal(missing.response.status, 404);
  assert.equal(missing.body.error.code, 'NOT_FOUND');
  const method = await call('/api/v1/health', 'DELETE');
  assert.equal(method.response.status, 404);
});

test('malformed JSON returns 400 structured error', async () => {
  const response = await fetch(baseUrl + '/api/v1/quotes', {
    method: 'POST', headers, body: '{bad-json'
  });
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error.code, 'INVALID_JSON');
});
