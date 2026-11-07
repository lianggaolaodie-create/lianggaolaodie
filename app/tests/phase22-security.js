'use strict';

const PAYMENT_TRANSITIONS = {
  unpaid: ['proof_submitted', 'cancelled'],
  proof_submitted: ['reviewing', 'rejected', 'confirmed'],
  reviewing: ['rejected', 'confirmed'],
  rejected: ['proof_submitted', 'cancelled'],
  confirmed: ['refunded'], refunded: [], cancelled: []
};
function canTransitionPayment(from, to) {
  return Boolean(PAYMENT_TRANSITIONS[from] && PAYMENT_TRANSITIONS[from].includes(to));
}
function normalizeLegacyMerchPayment(status) {
  const map = { unpaid: 'unpaid', pending: 'unpaid', proof_submitted: 'proof_submitted', reviewing: 'reviewing', paid: 'confirmed', confirmed: 'confirmed', refunded: 'refunded' };
  return Object.prototype.hasOwnProperty.call(map, status)
    ? { status: map[status], needsReview: false, source: status }
    : { status: 'unknown', needsReview: true, source: status ?? null };
}
function validateShipmentToken({ tokenHashMatches, orderMatches, nowMs, expiresAtMs, consumedAtMs, revokedAtMs }) {
  if (tokenHashMatches !== true) return { ok: false, reason: 'invalid_token' };
  if (orderMatches !== true) return { ok: false, reason: 'order_mismatch' };
  if (!Number.isFinite(nowMs) || !Number.isFinite(expiresAtMs)) return { ok: false, reason: 'invalid_expiry' };
  if (nowMs >= expiresAtMs) return { ok: false, reason: 'expired' };
  if (consumedAtMs != null) return { ok: false, reason: 'already_consumed' };
  if (revokedAtMs != null) return { ok: false, reason: 'revoked' };
  return { ok: true, reason: 'authorized' };
}
function buildShipmentNotification({ verifiedOrder, requestBody = {} }) {
  if (!verifiedOrder || verifiedOrder.tokenAuthorized !== true) return { ok: false, reason: 'unauthorized' };
  const order = verifiedOrder.order;
  if (!order || !order.order_number) return { ok: false, reason: 'order_not_found' };
  if (!verifiedOrder.recipient) return { ok: false, reason: 'recipient_not_bound' };
  return { ok: true, eventId: verifiedOrder.eventId, recipient: verifiedOrder.recipient, orderNumber: order.order_number, pickupType: order.pickup_type, pickupStore: order.pickup_store ?? null };
}
function shouldProcessEvent({ eventId, processedEventIds }) {
  return typeof eventId === 'string' && eventId.length >= 12 && processedEventIds instanceof Set && !processedEventIds.has(eventId);
}
module.exports = { canTransitionPayment, normalizeLegacyMerchPayment, validateShipmentToken, buildShipmentNotification, shouldProcessEvent };
