/**
 * Phase 49 payment intent and webhook verification reference model.
 * Pure Node simulation; no provider calls and no order/payment writes.
 */
'use strict';

const { createHmac, timingSafeEqual, createHash } = require('node:crypto');

const CURRENCY = 'TWD';
const TERMINAL = new Set(['succeeded', 'failed', 'expired']);

function fail(reason) {
  return Object.freeze({ ok: false, reason });
}
function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
function safeEqualHex(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}
function signWebhook(rawBody, secret, timestamp) {
  if (typeof rawBody !== 'string' || typeof secret !== 'string' || !secret ||
      !Number.isSafeInteger(timestamp)) return null;
  return createHmac('sha256', secret).update(String(timestamp) + '.' + rawBody).digest('hex');
}
function verifyWebhookSignature({ rawBody, secret, timestamp, signature, now, toleranceSeconds = 300 } = {}) {
  if (typeof rawBody !== 'string' || typeof secret !== 'string' || !secret ||
      !Number.isSafeInteger(timestamp) || !Number.isSafeInteger(now) ||
      !Number.isSafeInteger(toleranceSeconds) || toleranceSeconds < 0) return fail('WEBHOOK_SIGNATURE_INPUT_INVALID');
  if (Math.abs(now - timestamp) > toleranceSeconds) return fail('WEBHOOK_TIMESTAMP_OUT_OF_RANGE');
  const expected = signWebhook(rawBody, secret, timestamp);
  if (!safeEqualHex(expected, signature)) return fail('WEBHOOK_SIGNATURE_INVALID');
  return Object.freeze({ ok: true });
}
function createPaymentStore() {
  return { intents: new Map(), intentKeys: new Map(), events: new Map() };
}
function createPaymentIntent({ store, orderId, amountMinor, currency = CURRENCY,
  sessionScope, idempotencyKey, now, expiresAt, provider = 'manual_or_gateway' } = {}) {
  if (!store || !(store.intents instanceof Map) || !(store.intentKeys instanceof Map)) return fail('PAYMENT_STORE_INVALID');
  if (typeof orderId !== 'string' || !orderId.trim()) return fail('ORDER_ID_REQUIRED');
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return fail('PAYMENT_AMOUNT_INVALID');
  if (currency !== CURRENCY) return fail('PAYMENT_CURRENCY_UNSUPPORTED');
  if (typeof sessionScope !== 'string' || !sessionScope.trim()) return fail('PAYMENT_SESSION_REQUIRED');
  if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) return fail('PAYMENT_IDEMPOTENCY_KEY_INVALID');
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(expiresAt) || expiresAt <= now) return fail('PAYMENT_EXPIRY_INVALID');
  if (typeof provider !== 'string' || !provider.trim()) return fail('PAYMENT_PROVIDER_INVALID');

  const requestHash = sha256(JSON.stringify({ orderId: orderId.trim(), amountMinor, currency, provider }));
  const scopedKey = sessionScope.trim() + '::' + idempotencyKey;
  const prior = store.intentKeys.get(scopedKey);
  if (prior) {
    if (prior.requestHash !== requestHash) return fail('PAYMENT_IDEMPOTENCY_CONFLICT');
    return Object.freeze({ ok: true, intent: prior.intent, replayed: true });
  }
  const intentId = 'pi_' + sha256(scopedKey + ':' + requestHash).slice(0, 24);
  const intent = Object.freeze({
    intentId, orderId: orderId.trim(), amountMinor, currency, provider: provider.trim(),
    status: 'pending', createdAt: now, expiresAt, providerPaymentId: null,
    succeededAt: null, failedAt: null, expiredAt: null
  });
  store.intents.set(intentId, intent);
  store.intentKeys.set(scopedKey, Object.freeze({ requestHash, intent }));
  return Object.freeze({ ok: true, intent, replayed: false });
}
function applyVerifiedWebhook({ store, rawBody, secret, timestamp, signature, now,
  toleranceSeconds = 300 } = {}) {
  if (!store || !(store.intents instanceof Map) || !(store.events instanceof Map)) return fail('PAYMENT_STORE_INVALID');
  const verified = verifyWebhookSignature({ rawBody, secret, timestamp, signature, now, toleranceSeconds });
  if (!verified.ok) return verified;
  let event;
  try { event = JSON.parse(rawBody); } catch { return fail('WEBHOOK_JSON_INVALID'); }
  if (!event || typeof event !== 'object' || Array.isArray(event) ||
      typeof event.eventId !== 'string' || !event.eventId.trim() ||
      typeof event.intentId !== 'string' || !event.intentId.trim() ||
      !['succeeded', 'failed'].includes(event.type) ||
      !Number.isSafeInteger(event.amountMinor) || typeof event.currency !== 'string' ||
      typeof event.providerPaymentId !== 'string' || !event.providerPaymentId.trim()) {
    return fail('WEBHOOK_PAYLOAD_INVALID');
  }
  const payloadHash = sha256(rawBody);
  const priorEvent = store.events.get(event.eventId);
  if (priorEvent) {
    if (priorEvent.payloadHash !== payloadHash) return fail('WEBHOOK_EVENT_ID_CONFLICT');
    return Object.freeze({ ok: true, duplicate: true, status: priorEvent.status, intentId: event.intentId });
  }
  const intent = store.intents.get(event.intentId);
  if (!intent) return fail('PAYMENT_INTENT_NOT_FOUND');
  if (event.amountMinor !== intent.amountMinor || event.currency !== intent.currency) return fail('PAYMENT_AMOUNT_OR_CURRENCY_MISMATCH');
  if (intent.provider !== event.provider) return fail('PAYMENT_PROVIDER_MISMATCH');
  if (TERMINAL.has(intent.status)) return fail('PAYMENT_INTENT_TERMINAL');
  if (now >= intent.expiresAt) return fail('PAYMENT_INTENT_EXPIRED');
  const next = Object.freeze({
    ...intent,
    status: event.type,
    providerPaymentId: event.providerPaymentId,
    succeededAt: event.type === 'succeeded' ? now : null,
    failedAt: event.type === 'failed' ? now : null
  });
  store.intents.set(intent.intentId, next);
  store.events.set(event.eventId, Object.freeze({ payloadHash, status: next.status, intentId: intent.intentId }));
  return Object.freeze({ ok: true, duplicate: false, status: next.status, intentId: intent.intentId });
}
function expirePaymentIntent({ store, intentId, now } = {}) {
  if (!store || !(store.intents instanceof Map)) return fail('PAYMENT_STORE_INVALID');
  const intent = store.intents.get(intentId);
  if (!intent) return fail('PAYMENT_INTENT_NOT_FOUND');
  if (intent.status !== 'pending') return fail('PAYMENT_INTENT_NOT_PENDING');
  if (!Number.isSafeInteger(now) || now < intent.expiresAt) return fail('PAYMENT_NOT_YET_EXPIRED');
  const next = Object.freeze({ ...intent, status: 'expired', expiredAt: now });
  store.intents.set(intentId, next);
  return Object.freeze({ ok: true, intent: next });
}

module.exports = {
  applyVerifiedWebhook, createPaymentIntent, createPaymentStore,
  expirePaymentIntent, signWebhook, verifyWebhookSignature
};
