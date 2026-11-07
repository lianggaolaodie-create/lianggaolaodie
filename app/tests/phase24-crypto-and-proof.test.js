'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  canonicalShipmentEnvelope, signShipmentEnvelope, verifyShipmentEnvelope,
  canTransitionMerchPayment, isAllowedMerchShipmentStatus, normalizeLegacyMerchAdminPayment,
  validateProofCapability, finalizeProof
} = require('./phase24-crypto-and-proof');

const secret = 'local-test-secret-only-32-bytes-minimum-000000';
const fields = { method: 'POST', path: '/functions/v1/line-customer-notify-v2', timestamp: '2026-11-08T02:00:00.000Z', eventId: 'event-000000000001', orderId: 'order-123', token: 'one-time-token-fixture' };
const nowMs = Date.parse(fields.timestamp);
const goodProof = { objectExists: true, capabilityValid: true, orderMatches: true, nowMs: 1000, expiresAtMs: 2000, consumedAtMs: null, mimeType: 'image/jpeg', sizeBytes: 1000, maxBytes: 5000000, eventId: 'proof-event-000001', processedEventIds: new Set(), paymentStatus: 'unpaid' };

test('canonical envelope is deterministic and binds method/path/order/event/token', () => {
  assert.equal(canonicalShipmentEnvelope(fields), canonicalShipmentEnvelope({ ...fields }));
  assert.notEqual(canonicalShipmentEnvelope(fields), canonicalShipmentEnvelope({ ...fields, orderId: 'other-order' }));
});
test('HMAC-SHA256 signs and verifies valid envelope', () => {
  const signature = signShipmentEnvelope(fields, secret);
  assert.equal(verifyShipmentEnvelope({ fields, signature, secret, nowMs }).ok, true);
});
test('HMAC rejects tampered token, order, path, method and event id', () => {
  const signature = signShipmentEnvelope(fields, secret);
  for (const patch of [{ token: 'changed' }, { orderId: 'other' }, { path: '/wrong' }, { method: 'GET' }, { eventId: 'other-event' }]) {
    assert.equal(verifyShipmentEnvelope({ fields: { ...fields, ...patch }, signature, secret, nowMs }).reason, 'invalid_signature');
  }
});
test('HMAC rejects malformed signature and wrong secret', () => {
  const signature = signShipmentEnvelope(fields, secret);
  assert.equal(verifyShipmentEnvelope({ fields, signature: 'xyz', secret, nowMs }).reason, 'invalid_signature');
  assert.equal(verifyShipmentEnvelope({ fields, signature, secret: 'wrong-secret-which-is-long-enough-000000', nowMs }).reason, 'invalid_signature');
});
test('HMAC rejects stale and invalid timestamps', () => {
  const signature = signShipmentEnvelope(fields, secret);
  assert.equal(verifyShipmentEnvelope({ fields, signature, secret, nowMs: nowMs + 300001 }).reason, 'stale_timestamp');
  const bad = { ...fields, timestamp: 'not-a-date' };
  assert.equal(verifyShipmentEnvelope({ fields: bad, signature: signShipmentEnvelope(bad, secret), secret, nowMs }).reason, 'stale_timestamp');
});
test('HMAC refuses weak signing secret', () => {
  assert.throws(() => signShipmentEnvelope(fields, 'short'), /weak_secret/);
});
test('DB-compatible merch payment transitions reject paid/refunded legacy values', () => {
  assert.equal(canTransitionMerchPayment('unpaid', 'proof_submitted'), true);
  assert.equal(canTransitionMerchPayment('proof_submitted', 'confirmed'), true);
  assert.equal(canTransitionMerchPayment('unpaid', 'confirmed'), false);
  assert.equal(canTransitionMerchPayment('confirmed', 'refunded'), false);
});
test('legacy admin labels normalize only supported states; refund needs review', () => {
  assert.equal(normalizeLegacyMerchAdminPayment('pending').status, 'unpaid');
  assert.equal(normalizeLegacyMerchAdminPayment('paid').status, 'confirmed');
  assert.equal(normalizeLegacyMerchAdminPayment('refunded').needsReview, true);
  assert.equal(normalizeLegacyMerchAdminPayment('refunded').status, 'unsupported_refund');
});
test('shipment states match DB CHECK values only', () => {
  for (const s of ['unprepared', 'preparing', 'shipped', 'delivered']) assert.equal(isAllowedMerchShipmentStatus(s), true);
  for (const s of ['pending', 'processing', 'completed']) assert.equal(isAllowedMerchShipmentStatus(s), false);
});
test('proof capability accepts valid order-bound image capability', () => {
  assert.equal(validateProofCapability({ capabilityValid: true, orderMatches: true, nowMs: 100, expiresAtMs: 200, consumedAtMs: null, mimeType: 'image/png', sizeBytes: 10, maxBytes: 100 }).ok, true);
});
test('proof capability rejects invalid, wrong-order, expired and consumed capabilities', () => {
  const base = { capabilityValid: true, orderMatches: true, nowMs: 100, expiresAtMs: 200, consumedAtMs: null, mimeType: 'image/png', sizeBytes: 10, maxBytes: 100 };
  assert.equal(validateProofCapability({ ...base, capabilityValid: false }).reason, 'invalid_capability');
  assert.equal(validateProofCapability({ ...base, orderMatches: false }).reason, 'order_mismatch');
  assert.equal(validateProofCapability({ ...base, nowMs: 200 }).reason, 'expired');
  assert.equal(validateProofCapability({ ...base, consumedAtMs: 1 }).reason, 'already_consumed');
});
test('proof capability rejects unsupported MIME and invalid/oversize files', () => {
  const base = { capabilityValid: true, orderMatches: true, nowMs: 100, expiresAtMs: 200, consumedAtMs: null, mimeType: 'image/png', sizeBytes: 10, maxBytes: 100 };
  assert.equal(validateProofCapability({ ...base, mimeType: 'application/pdf' }).reason, 'mime_not_allowed');
  assert.equal(validateProofCapability({ ...base, sizeBytes: 101 }).reason, 'invalid_size');
  assert.equal(validateProofCapability({ ...base, sizeBytes: 0 }).reason, 'invalid_size');
});
test('finalize requires existing object and valid event id', () => {
  assert.equal(finalizeProof({ ...goodProof, objectExists: false }).reason, 'object_missing');
  assert.equal(finalizeProof({ ...goodProof, eventId: 'short' }).reason, 'invalid_event_id');
});
test('finalize changes unpaid to proof_submitted, never confirmed', () => {
  const r = finalizeProof(goodProof);
  assert.deepEqual({ ok: r.ok, reason: r.reason, paymentStatus: r.paymentStatus }, { ok: true, reason: 'proof_submitted', paymentStatus: 'proof_submitted' });
});
test('finalize rejects already confirmed payment and only idempotently accepts processed event', () => {
  assert.equal(finalizeProof({ ...goodProof, paymentStatus: 'confirmed' }).reason, 'invalid_payment_state');
  const done = finalizeProof({ ...goodProof, processedEventIds: new Set(['proof-event-000001']) });
  assert.equal(done.reason, 'already_finalized');
  assert.equal(done.idempotent, true);
});
