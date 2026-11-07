'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  applyVerifiedWebhook, createPaymentIntent, createPaymentStore,
  expirePaymentIntent, signWebhook, verifyWebhookSignature
} = require('./payment-model');

const secret = 'test-only-secret-never-use-in-production';
const base = { orderId: 'synthetic-order-1', amountMinor: 23000, currency: 'TWD',
  sessionScope: 'guest-session-a', idempotencyKey: 'payment-key-000001',
  now: 1000, expiresAt: 5000, provider: 'test-gateway' };
function setup() {
  const store = createPaymentStore();
  const created = createPaymentIntent({ store, ...base });
  assert.equal(created.ok, true);
  return { store, intent: created.intent };
}
function webhook(intent, overrides = {}) {
  const event = {
    eventId: 'evt-test-001', intentId: intent.intentId, type: 'succeeded',
    amountMinor: intent.amountMinor, currency: intent.currency,
    provider: intent.provider, providerPaymentId: 'provider-pay-001', ...overrides
  };
  const rawBody = JSON.stringify(event);
  const timestamp = 1200;
  return { rawBody, secret, timestamp, signature: signWebhook(rawBody, secret, timestamp), now: 1201 };
}

test('creates a pending payment intent bound to order amount and currency', () => {
  const { intent } = setup();
  assert.equal(intent.status, 'pending');
  assert.equal(intent.amountMinor, 23000);
  assert.equal(intent.orderId, base.orderId);
});

test('same idempotency key and same request returns same intent', () => {
  const store = createPaymentStore();
  const first = createPaymentIntent({ store, ...base });
  const second = createPaymentIntent({ store, ...base });
  assert.equal(second.intent.intentId, first.intent.intentId);
  assert.equal(second.replayed, true);
});

test('same idempotency key with changed amount is rejected', () => {
  const store = createPaymentStore();
  createPaymentIntent({ store, ...base });
  assert.equal(createPaymentIntent({ store, ...base, amountMinor: 24000 }).reason, 'PAYMENT_IDEMPOTENCY_CONFLICT');
});

test('invalid order, amount, currency, session, key and expiry fail closed', () => {
  const store = createPaymentStore();
  assert.equal(createPaymentIntent({ store, ...base, orderId: '' }).reason, 'ORDER_ID_REQUIRED');
  assert.equal(createPaymentIntent({ store, ...base, amountMinor: 0 }).reason, 'PAYMENT_AMOUNT_INVALID');
  assert.equal(createPaymentIntent({ store, ...base, currency: 'USD' }).reason, 'PAYMENT_CURRENCY_UNSUPPORTED');
  assert.equal(createPaymentIntent({ store, ...base, sessionScope: '' }).reason, 'PAYMENT_SESSION_REQUIRED');
  assert.equal(createPaymentIntent({ store, ...base, idempotencyKey: '' }).reason, 'PAYMENT_IDEMPOTENCY_KEY_INVALID');
  assert.equal(createPaymentIntent({ store, ...base, expiresAt: 1000 }).reason, 'PAYMENT_EXPIRY_INVALID');
});

test('valid HMAC signature and timestamp are accepted', () => {
  const payload = '{"eventId":"e"}';
  const signature = signWebhook(payload, secret, 1000);
  assert.equal(verifyWebhookSignature({ rawBody: payload, secret, timestamp: 1000, signature, now: 1001 }).ok, true);
});

test('invalid signature is rejected', () => {
  assert.equal(verifyWebhookSignature({ rawBody: '{}', secret, timestamp: 1000, signature: '0'.repeat(64), now: 1001 }).reason,
    'WEBHOOK_SIGNATURE_INVALID');
});

test('stale webhook timestamp is rejected', () => {
  const payload = '{}';
  assert.equal(verifyWebhookSignature({ rawBody: payload, secret, timestamp: 1,
    signature: signWebhook(payload, secret, 1), now: 1000, toleranceSeconds: 300 }).reason,
  'WEBHOOK_TIMESTAMP_OUT_OF_RANGE');
});

test('malformed signature inputs are rejected', () => {
  assert.equal(verifyWebhookSignature({ rawBody: '{}', secret, timestamp: 1, signature: 'bad', now: 1 }).reason,
    'WEBHOOK_SIGNATURE_INVALID');
});

test('valid signed success webhook marks intent succeeded', () => {
  const { store, intent } = setup();
  const result = applyVerifiedWebhook({ store, ...webhook(intent) });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'succeeded');
  assert.equal(store.intents.get(intent.intentId).status, 'succeeded');
});

test('valid signed failure webhook marks intent failed', () => {
  const { store, intent } = setup();
  const result = applyVerifiedWebhook({ store, ...webhook(intent, { type: 'failed' }) });
  assert.equal(result.status, 'failed');
});

test('duplicate webhook event is idempotent', () => {
  const { store, intent } = setup();
  const payload = webhook(intent);
  applyVerifiedWebhook({ store, ...payload });
  const replay = applyVerifiedWebhook({ store, ...payload });
  assert.equal(replay.ok, true);
  assert.equal(replay.duplicate, true);
});

test('same event ID with changed payload is rejected', () => {
  const { store, intent } = setup();
  applyVerifiedWebhook({ store, ...webhook(intent) });
  assert.equal(applyVerifiedWebhook({ store, ...webhook(intent, { amountMinor: 999 }) }).reason,
    'WEBHOOK_EVENT_ID_CONFLICT');
});

test('unsigned, invalid JSON and malformed webhook payloads are rejected', () => {
  const { store, intent } = setup();
  assert.equal(applyVerifiedWebhook({ store, ...webhook(intent), signature: 'bad' }).reason, 'WEBHOOK_SIGNATURE_INVALID');
  const rawBody = '{';
  assert.equal(applyVerifiedWebhook({ store, rawBody, secret, timestamp: 1200,
    signature: signWebhook(rawBody, secret, 1200), now: 1201 }).reason, 'WEBHOOK_JSON_INVALID');
  const bad = JSON.stringify({ eventId: 'x' });
  assert.equal(applyVerifiedWebhook({ store, rawBody: bad, secret, timestamp: 1200,
    signature: signWebhook(bad, secret, 1200), now: 1201 }).reason, 'WEBHOOK_PAYLOAD_INVALID');
});

test('unknown intent is rejected', () => {
  const { store, intent } = setup();
  assert.equal(applyVerifiedWebhook({ store, ...webhook(intent, { intentId: 'missing' }) }).reason,
    'PAYMENT_INTENT_NOT_FOUND');
});

test('amount or currency mismatch is rejected', () => {
  const { store, intent } = setup();
  assert.equal(applyVerifiedWebhook({ store, ...webhook(intent, { amountMinor: 1 }) }).reason,
    'PAYMENT_AMOUNT_OR_CURRENCY_MISMATCH');
  assert.equal(applyVerifiedWebhook({ store, ...webhook(intent, { currency: 'USD' }) }).reason,
    'PAYMENT_AMOUNT_OR_CURRENCY_MISMATCH');
});

test('provider mismatch is rejected', () => {
  const { store, intent } = setup();
  assert.equal(applyVerifiedWebhook({ store, ...webhook(intent, { provider: 'other' }) }).reason,
    'PAYMENT_PROVIDER_MISMATCH');
});

test('terminal payment state cannot be overwritten by later event', () => {
  const { store, intent } = setup();
  applyVerifiedWebhook({ store, ...webhook(intent) });
  assert.equal(applyVerifiedWebhook({ store, ...webhook(intent, { eventId: 'evt-late', type: 'failed' }) }).reason,
    'PAYMENT_INTENT_TERMINAL');
});

test('webhook after intent expiry is rejected', () => {
  const { store, intent } = setup();
  const payload = webhook(intent);
  const timestamp = intent.expiresAt - 1;
  const rawBody = payload.rawBody;
  assert.equal(applyVerifiedWebhook({ store, ...payload, timestamp,
    signature: signWebhook(rawBody, secret, timestamp), now: intent.expiresAt }).reason, 'PAYMENT_INTENT_EXPIRED');
});

test('pending intent can expire only at or after expiry time', () => {
  const { store, intent } = setup();
  assert.equal(expirePaymentIntent({ store, intentId: intent.intentId, now: 4999 }).reason, 'PAYMENT_NOT_YET_EXPIRED');
  assert.equal(expirePaymentIntent({ store, intentId: intent.intentId, now: 5000 }).intent.status, 'expired');
});

test('succeeded intent cannot be manually expired', () => {
  const { store, intent } = setup();
  applyVerifiedWebhook({ store, ...webhook(intent) });
  assert.equal(expirePaymentIntent({ store, intentId: intent.intentId, now: 6000 }).reason,
    'PAYMENT_INTENT_NOT_PENDING');
});

test('payment model never claims to create orders or charge cards', () => {
  const { intent } = setup();
  assert.equal(intent.status, 'pending');
  assert.equal(Object.hasOwn(intent, 'orderCreated'), false);
  assert.equal(Object.hasOwn(intent, 'charged'), false);
});
