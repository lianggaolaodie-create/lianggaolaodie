'use strict';

const crypto = require('node:crypto');

function canonicalShipmentEnvelope({ method, path, timestamp, eventId, orderId, token }) {
  if (![method, path, timestamp, eventId, orderId, token].every(v => typeof v === 'string' && v.length > 0)) {
    throw new TypeError('invalid_envelope');
  }
  return [method.toUpperCase(), path, timestamp, eventId, orderId, token].join('\n');
}

function signShipmentEnvelope(fields, secret) {
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32) throw new TypeError('weak_secret');
  return crypto.createHmac('sha256', secret).update(canonicalShipmentEnvelope(fields), 'utf8').digest('hex');
}

function safeHexEqual(expected, supplied) {
  if (typeof supplied !== 'string' || !/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(supplied, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function verifyShipmentEnvelope({ fields, signature, secret, nowMs, maxSkewMs = 300000 }) {
  if (!Number.isFinite(nowMs) || !Number.isFinite(maxSkewMs) || maxSkewMs < 0) return { ok: false, reason: 'invalid_clock' };
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32) return { ok: false, reason: 'invalid_secret' };
  let expected;
  try { expected = signShipmentEnvelope(fields, secret); }
  catch { return { ok: false, reason: 'invalid_envelope' }; }
  if (!safeHexEqual(expected, signature)) return { ok: false, reason: 'invalid_signature' };
  const timestampMs = Date.parse(fields.timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(nowMs - timestampMs) > maxSkewMs) return { ok: false, reason: 'stale_timestamp' };
  return { ok: true, reason: 'verified' };
}

const MERCH_PAYMENT_TRANSITIONS = Object.freeze({
  unpaid: ['proof_submitted'],
  proof_submitted: ['confirmed', 'rejected'],
  rejected: ['proof_submitted'],
  confirmed: []
});
const MERCH_SHIPMENT_STATES = Object.freeze(['unprepared', 'preparing', 'shipped', 'delivered']);
function canTransitionMerchPayment(from, to) {
  return Boolean(MERCH_PAYMENT_TRANSITIONS[from]?.includes(to));
}
function isAllowedMerchShipmentStatus(status) {
  return MERCH_SHIPMENT_STATES.includes(status);
}
function normalizeLegacyMerchAdminPayment(status) {
  const map = { pending: 'unpaid', paid: 'confirmed', unpaid: 'unpaid', proof_submitted: 'proof_submitted', rejected: 'rejected', confirmed: 'confirmed' };
  if (status === 'refunded') return { status: 'unsupported_refund', needsReview: true, source: status };
  if (Object.prototype.hasOwnProperty.call(map, status)) return { status: map[status], needsReview: false, source: status };
  return { status: 'unknown', needsReview: true, source: status ?? null };
}
function validateProofCapability({ capabilityValid, orderMatches, nowMs, expiresAtMs, consumedAtMs, mimeType, sizeBytes, maxBytes }) {
  if (capabilityValid !== true) return { ok: false, reason: 'invalid_capability' };
  if (orderMatches !== true) return { ok: false, reason: 'order_mismatch' };
  if (!Number.isFinite(nowMs) || !Number.isFinite(expiresAtMs) || nowMs >= expiresAtMs) return { ok: false, reason: 'expired' };
  if (consumedAtMs != null) return { ok: false, reason: 'already_consumed' };
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) return { ok: false, reason: 'mime_not_allowed' };
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0 || !Number.isInteger(maxBytes) || sizeBytes > maxBytes) return { ok: false, reason: 'invalid_size' };
  return { ok: true, reason: 'authorized' };
}
function finalizeProof({ objectExists, capabilityValid, orderMatches, nowMs, expiresAtMs, consumedAtMs, mimeType, sizeBytes, maxBytes, eventId, processedEventIds = new Set(), paymentStatus }) {
  const auth = validateProofCapability({ capabilityValid, orderMatches, nowMs, expiresAtMs, consumedAtMs, mimeType, sizeBytes, maxBytes });
  if (!auth.ok) return auth;
  if (objectExists !== true) return { ok: false, reason: 'object_missing' };
  if (typeof eventId !== 'string' || eventId.length < 12) return { ok: false, reason: 'invalid_event_id' };
  if (processedEventIds.has(eventId)) return { ok: true, reason: 'already_finalized', idempotent: true, paymentStatus };
  if (paymentStatus !== 'unpaid' && paymentStatus !== 'rejected') return { ok: false, reason: 'invalid_payment_state' };
  return { ok: true, reason: 'proof_submitted', idempotent: false, paymentStatus: 'proof_submitted' };
}

module.exports = {
  canonicalShipmentEnvelope, signShipmentEnvelope, verifyShipmentEnvelope,
  canTransitionMerchPayment, isAllowedMerchShipmentStatus, normalizeLegacyMerchAdminPayment,
  validateProofCapability, finalizeProof
};
