/**
 * Phase 48 checkout authorization gate reference model.
 * In-memory simulation only. A production server must perform reservation,
 * idempotency persistence and quote consumption in one database transaction.
 */
'use strict';

const { createHash } = require('node:crypto');
const { fingerprint, normalizeCart } = require('./quote-model');

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function canonicalRecipient(recipient) {
  if (!recipient || typeof recipient !== 'object' || Array.isArray(recipient)) return null;
  const keys = ['name', 'phone', 'address', 'storeProvider', 'storeName', 'storeAddress'];
  const normalized = {};
  for (const key of keys) {
    if (recipient[key] !== undefined) {
      if (typeof recipient[key] !== 'string') return null;
      normalized[key] = recipient[key].trim().replace(/\\s+/g, ' ');
    } else {
      normalized[key] = '';
    }
  }
  return normalized;
}

function recipientFingerprint(recipient) {
  const normalized = canonicalRecipient(recipient);
  return normalized ? digest(normalized) : null;
}

function createCheckoutGateStore() {
  return {
    quotes: new Map(),
    idempotency: new Map(),
    quoteReservations: new Map()
  };
}

function registerServerQuote(store, quote) {
  if (!store || !(store.quotes instanceof Map) || !quote ||
      typeof quote.quoteId !== 'string' || !quote.quoteId.trim()) {
    return Object.freeze({ ok: false, reason: 'SERVER_QUOTE_INVALID' });
  }
  if (store.quotes.has(quote.quoteId)) return Object.freeze({ ok: false, reason: 'QUOTE_ID_CONFLICT' });
  store.quotes.set(quote.quoteId, Object.freeze({ ...quote }));
  return Object.freeze({ ok: true });
}

function fail(reason, fields = []) {
  return Object.freeze({ ok: false, authorized: false, reason, fields: Object.freeze(fields) });
}

function authorizeCheckout({ store, quoteId, cart, fulfillmentMethod, recipient,
  serverNow, sessionId, idempotencyKey } = {}) {
  if (!store || !(store.quotes instanceof Map) || !(store.idempotency instanceof Map) ||
      !(store.quoteReservations instanceof Map)) return fail('CHECKOUT_STORE_INVALID');
  if (typeof sessionId !== 'string' || !sessionId.trim()) return fail('CHECKOUT_SESSION_REQUIRED');
  if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) {
    return fail('IDEMPOTENCY_KEY_REQUIRED_OR_INVALID');
  }
  if (typeof quoteId !== 'string' || !quoteId.trim()) return fail('QUOTE_ID_REQUIRED');

  const normalized = normalizeCart(cart);
  if (!normalized.ok) return fail(normalized.reason);
  const recipientHash = recipientFingerprint(recipient);
  if (!recipientHash) return fail('RECIPIENT_DETAILS_INVALID');

  const requestHash = digest({
    quoteId: quoteId.trim(),
    cartFingerprint: fingerprint(normalized.items, fulfillmentMethod),
    fulfillmentMethod,
    recipientFingerprint: recipientHash
  });
  const idemKey = sessionId.trim() + '::' + idempotencyKey;
  const previous = store.idempotency.get(idemKey);
  if (previous) {
    if (previous.requestHash !== requestHash) return fail('IDEMPOTENCY_KEY_PAYLOAD_CONFLICT');
    return Object.freeze({ ...previous.result, replayed: true });
  }

  const quote = store.quotes.get(quoteId.trim());
  if (!quote) return fail('SERVER_QUOTE_NOT_FOUND');
  if (!Number.isFinite(serverNow) || !Number.isFinite(quote.expiresAt)) return fail('SERVER_TIME_INVALID');
  if (serverNow >= quote.expiresAt) return fail('QUOTE_EXPIRED');
  if (quote.fulfillmentMethod !== fulfillmentMethod) return fail('QUOTE_METHOD_MISMATCH');
  if (quote.cartFingerprint !== requestHashCartFingerprint(normalized.items, fulfillmentMethod)) {
    return fail('QUOTE_CART_MISMATCH');
  }
  if (!quote.recipientFingerprint || quote.recipientFingerprint !== recipientHash) {
    return fail('QUOTE_RECIPIENT_MISMATCH');
  }

  const reservation = store.quoteReservations.get(quote.quoteId);
  if (reservation) return fail('QUOTE_ALREADY_RESERVED');
  const result = Object.freeze({
    ok: true,
    authorized: true,
    reason: null,
    quoteId: quote.quoteId,
    totalMinor: quote.totalMinor,
    currency: quote.currency,
    idempotencyKey,
    orderCreationEnabled: false,
    paymentExecutionEnabled: false,
    replayed: false
  });
  store.quoteReservations.set(quote.quoteId, idemKey);
  store.idempotency.set(idemKey, Object.freeze({ requestHash, result }));
  return result;
}

function requestHashCartFingerprint(items, fulfillmentMethod) {
  return fingerprint(items, fulfillmentMethod);
}

module.exports = {
  authorizeCheckout,
  canonicalRecipient,
  createCheckoutGateStore,
  recipientFingerprint,
  registerServerQuote
};
