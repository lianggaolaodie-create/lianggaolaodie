/**
 * Phase 67 HTTP workflow contract simulator.
 * Local-only reference server using synthetic in-memory fixtures.
 * Authentication is injected by tests/host; default denies every protected request.
 * No Supabase, real identity provider, payment gateway, shipping provider or order creation.
 */
'use strict';
const { randomUUID } = require('node:crypto');
const { createServer } = require('node:http');
const { URL } = require('node:url');
const { issueQuote } = require('./quote-model');
const checkout = require('./checkout-gate');
const members = require('./member-order-model');
const owner = require('./owner-order-admin-model');

class HttpContractError extends Error {
  constructor(status, code, message, details = []) {
    super(message); this.status = status; this.code = code; this.details = details;
  }
}
const json = (res, status, body, requestId) => {
  const raw = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(raw),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'x-request-id': requestId
  });
  res.end(raw);
};
const envelope = (data, requestId) => ({ data, meta: { request_id: requestId, api_version: 'v1' } });
const errorEnvelope = (error, requestId) => ({
  error: {
    code: error instanceof HttpContractError ? error.code : 'INTERNAL_ERROR',
    message: error instanceof HttpContractError ? error.message : '系統暫時無法處理請求。',
    details: error instanceof HttpContractError ? error.details : [],
    retryable: !(error instanceof HttpContractError) || error.status === 503
  },
  meta: { request_id: requestId, api_version: 'v1' }
});
function readBody(req, maxBytes = 16384) {
  return new Promise((resolve, reject) => {
    let raw = ''; let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) { reject(new HttpContractError(413, 'PAYLOAD_TOO_LARGE', '請求內容過大。')); req.destroy(); return; }
      raw += chunk.toString('utf8');
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        const value = JSON.parse(raw);
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('not object');
        resolve(value);
      } catch { reject(new HttpContractError(400, 'INVALID_JSON', '請求 JSON 格式錯誤。')); }
    });
    req.on('error', reject);
  });
}
function createWorkflowHttpServer({
  trustedCatalog = {}, trustedRates = {}, quoteStore = new Map(),
  memberStore = members.createMemberOrderStore(),
  ownerStore = owner.createOwnerOrderStore(),
  resolvePrincipal = async () => null,
  now = () => Date.now()
} = {}) {
  const checkoutStore = checkout.createCheckoutGateStore();
  const quotes = quoteStore;
  return createServer(async (req, res) => {
    const requestId = randomUUID();
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      if (req.method === 'GET' && url.pathname === '/api/v1/health') {
        return json(res, 200, envelope({ status: 'mock_only' }, requestId), requestId);
      }
      if (req.method === 'POST' && url.pathname === '/api/v1/quotes') {
        const body = await readBody(req);
        const issuedAt = now();
        const quoteId = randomUUID();
        const result = issueQuote({
          cart: body.cart, fulfillmentMethod: body.fulfillmentMethod, recipient: body.recipient,
          trustedCatalog, trustedRates, quoteId, issuedAt, expiresAt: issuedAt + 5 * 60 * 1000
        });
        if (!result.ok) throw new HttpContractError(422, 'QUOTE_REJECTED', '目前無法提供此訂單報價。', [{ reason: result.reason }]);
        quotes.set(quoteId, result.quote);
        checkout.registerServerQuote(checkoutStore, result.quote);
        return json(res, 201, envelope(result.quote, requestId), requestId);
      }
      if (req.method === 'POST' && url.pathname === '/api/v1/checkout/authorize') {
        const body = await readBody(req);
        const result = checkout.authorizeCheckout({
          store: checkoutStore, quoteId: body.quoteId, cart: body.cart,
          fulfillmentMethod: body.fulfillmentMethod, recipient: body.recipient,
          serverNow: now(), sessionId: body.sessionId,
          idempotencyKey: req.headers['idempotency-key']
        });
        if (!result.ok) throw new HttpContractError(409, 'CHECKOUT_REJECTED', '無法授權結帳。', [{ reason: result.reason }]);
        return json(res, 200, envelope(result, requestId), requestId);
      }
      const memberMatch = url.pathname.match(/^\/api\/v1\/member\/orders\/([^/]+)$/);
      const guestMatch = url.pathname.match(/^\/api\/v1\/guest\/orders\/([^/]+)$/);
      if (req.method === 'GET' && (memberMatch || guestMatch)) {
        const principal = await resolvePrincipal(req);
        const claim = req.headers['x-guest-order-claim'];
        const result = members.lookupCustomerOrder({
          store: memberStore, orderId: decodeURIComponent((memberMatch || guestMatch)[1]),
          principal, guestClaimToken: typeof claim === 'string' ? claim : undefined, now: now()
        });
        if (!result.ok) throw new HttpContractError(404, 'ORDER_NOT_FOUND', '找不到訂單或沒有查詢權限。');
        return json(res, 200, envelope(result.order, requestId), requestId);
      }
      const fulfillMatch = url.pathname.match(/^\/api\/v1\/admin\/orders\/([^/]+)\/fulfillment$/);
      if (req.method === 'PATCH' && fulfillMatch) {
        const principal = await resolvePrincipal(req);
        const body = await readBody(req);
        const result = owner.updateOwnerFulfillment({
          store: ownerStore, actor: principal,
          orderId: decodeURIComponent(fulfillMatch[1]), nextStatus: body.nextStatus,
          expectedVersion: body.expectedVersion, now: now(),
          idempotencyKey: req.headers['idempotency-key']
        });
        if (!result.ok) {
          const forbidden = ['ACTOR_NOT_VERIFIED','ROLE_FORBIDDEN','PERMISSION_FORBIDDEN'].includes(result.reason);
          throw new HttpContractError(forbidden ? 403 : 409, forbidden ? 'FORBIDDEN' : 'OPERATION_REJECTED', '無法更新訂單履約狀態。', [{ reason: result.reason }]);
        }
        return json(res, 200, envelope(result.order, requestId), requestId);
      }
      throw new HttpContractError(404, 'NOT_FOUND', '找不到此 API 路徑。');
    } catch (error) {
      const status = error instanceof HttpContractError ? error.status : 500;
      return json(res, status, errorEnvelope(error, requestId), requestId);
    }
  });
}
module.exports = { HttpContractError, createWorkflowHttpServer };
