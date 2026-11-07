/**
 * Phase 50 refund lifecycle and settlement reconciliation reference model.
 * In-memory synthetic model only; never calls a payment provider or writes orders.
 */
'use strict';

const { createHash } = require('node:crypto');
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail = reason => Object.freeze({ ok: false, reason });

function createRefundStore() {
  return { payments: new Map(), refunds: new Map(), idempotency: new Map() };
}
function registerCapturedPayment({ store, paymentId, orderId, amountMinor, currency = 'TWD', capturedAt } = {}) {
  if (!store || !(store.payments instanceof Map)) return fail('REFUND_STORE_INVALID');
  if (typeof paymentId !== 'string' || !paymentId.trim()) return fail('PAYMENT_ID_REQUIRED');
  if (typeof orderId !== 'string' || !orderId.trim()) return fail('ORDER_ID_REQUIRED');
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return fail('CAPTURE_AMOUNT_INVALID');
  if (currency !== 'TWD') return fail('REFUND_CURRENCY_UNSUPPORTED');
  if (!Number.isSafeInteger(capturedAt)) return fail('CAPTURE_TIME_INVALID');
  if (store.payments.has(paymentId)) return fail('PAYMENT_ALREADY_REGISTERED');
  store.payments.set(paymentId, Object.freeze({
    paymentId, orderId, amountMinor, currency, capturedAt, status: 'captured'
  }));
  return Object.freeze({ ok: true });
}
function reservedRefundAmount(store, paymentId) {
  let total = 0;
  for (const refund of store.refunds.values()) {
    if (refund.paymentId === paymentId && ['requested', 'approved', 'processing', 'succeeded'].includes(refund.status)) {
      total += refund.amountMinor;
    }
  }
  return total;
}
function requestRefund({ store, paymentId, amountMinor, reason, idempotencyKey, now } = {}) {
  if (!store || !(store.payments instanceof Map) || !(store.refunds instanceof Map) ||
      !(store.idempotency instanceof Map)) return fail('REFUND_STORE_INVALID');
  if (typeof paymentId !== 'string' || !paymentId.trim()) return fail('PAYMENT_ID_REQUIRED');
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return fail('REFUND_AMOUNT_INVALID');
  if (typeof reason !== 'string' || !reason.trim()) return fail('REFUND_REASON_REQUIRED');
  if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) return fail('REFUND_IDEMPOTENCY_KEY_INVALID');
  if (!Number.isSafeInteger(now)) return fail('REFUND_TIME_INVALID');
  const payment = store.payments.get(paymentId);
  if (!payment) return fail('PAYMENT_NOT_FOUND');
  const requestHash = sha({ paymentId, amountMinor, reason: reason.trim() });
  const prior = store.idempotency.get(idempotencyKey);
  if (prior) {
    if (prior.requestHash !== requestHash) return fail('REFUND_IDEMPOTENCY_CONFLICT');
    return Object.freeze({ ok: true, refund: prior.refund, replayed: true });
  }
  if (reservedRefundAmount(store, paymentId) + amountMinor > payment.amountMinor) return fail('REFUND_EXCEEDS_CAPTURED_AMOUNT');
  const refundId = 'rf_' + sha({ paymentId, amountMinor, idempotencyKey }).slice(0, 24);
  const refund = Object.freeze({
    refundId, paymentId, orderId: payment.orderId, amountMinor,
    currency: payment.currency, reason: reason.trim(), status: 'requested',
    requestedAt: now, approvedAt: null, processedAt: null, completedAt: null,
    failureCode: null, providerRefundId: null
  });
  store.refunds.set(refundId, refund);
  store.idempotency.set(idempotencyKey, Object.freeze({ requestHash, refund }));
  return Object.freeze({ ok: true, refund, replayed: false });
}
function transitionRefund({ store, refundId, action, now, providerRefundId, failureCode } = {}) {
  if (!store || !(store.refunds instanceof Map)) return fail('REFUND_STORE_INVALID');
  const current = store.refunds.get(refundId);
  if (!current) return fail('REFUND_NOT_FOUND');
  if (!Number.isSafeInteger(now)) return fail('REFUND_TIME_INVALID');
  let next;
  if (action === 'approve' && current.status === 'requested') {
    next = { ...current, status: 'approved', approvedAt: now };
  } else if (action === 'reject' && current.status === 'requested') {
    next = { ...current, status: 'rejected', completedAt: now, failureCode: typeof failureCode === 'string' ? failureCode : 'REJECTED' };
  } else if (action === 'process' && current.status === 'approved') {
    next = { ...current, status: 'processing', processedAt: now };
  } else if (action === 'succeed' && current.status === 'processing' &&
      typeof providerRefundId === 'string' && providerRefundId.trim()) {
    next = { ...current, status: 'succeeded', completedAt: now, providerRefundId: providerRefundId.trim() };
  } else if (action === 'fail' && ['approved', 'processing'].includes(current.status)) {
    next = { ...current, status: 'failed', completedAt: now, failureCode: typeof failureCode === 'string' && failureCode.trim() ? failureCode.trim() : 'PROVIDER_FAILED' };
  } else {
    return fail('REFUND_TRANSITION_NOT_ALLOWED');
  }
  const frozen = Object.freeze(next);
  store.refunds.set(refundId, frozen);
  return Object.freeze({ ok: true, refund: frozen });
}
function reconcileSettlement({ store, providerPayments, providerRefunds } = {}) {
  if (!store || !(store.payments instanceof Map) || !(store.refunds instanceof Map)) return fail('REFUND_STORE_INVALID');
  if (!Array.isArray(providerPayments) || !Array.isArray(providerRefunds)) return fail('SETTLEMENT_INPUT_INVALID');
  const localPayments = [...store.payments.values()];
  const localRefunds = [...store.refunds.values()].filter(x => x.status === 'succeeded');
  const normalize = (items, idKey) => {
    const map = new Map();
    for (const item of items) {
      if (!item || typeof item[idKey] !== 'string' || !item[idKey] ||
          !Number.isSafeInteger(item.amountMinor) || item.amountMinor < 0 || item.currency !== 'TWD') return null;
      if (map.has(item[idKey])) return null;
      map.set(item[idKey], item);
    }
    return map;
  };
  const externalPayments = normalize(providerPayments, 'paymentId');
  const externalRefunds = normalize(providerRefunds, 'refundId');
  if (!externalPayments || !externalRefunds) return fail('SETTLEMENT_ROW_INVALID_OR_DUPLICATE');
  const differences = [];
  const paymentIds = new Set([...localPayments.map(x => x.paymentId), ...externalPayments.keys()]);
  for (const id of paymentIds) {
    const local = store.payments.get(id);
    const external = externalPayments.get(id);
    if (!local || !external || local.amountMinor !== external.amountMinor || local.currency !== external.currency) {
      differences.push(Object.freeze({ type: 'payment', id, localAmountMinor: local?.amountMinor ?? null, providerAmountMinor: external?.amountMinor ?? null, reason: !local ? 'PROVIDER_ONLY' : !external ? 'LOCAL_ONLY' : 'AMOUNT_OR_CURRENCY_MISMATCH' }));
    }
  }
  const refundIds = new Set([...localRefunds.map(x => x.refundId), ...externalRefunds.keys()]);
  for (const id of refundIds) {
    const local = localRefunds.find(x => x.refundId === id);
    const external = externalRefunds.get(id);
    if (!local || !external || local.amountMinor !== external.amountMinor || local.currency !== external.currency) {
      differences.push(Object.freeze({ type: 'refund', id, localAmountMinor: local?.amountMinor ?? null, providerAmountMinor: external?.amountMinor ?? null, reason: !local ? 'PROVIDER_ONLY' : !external ? 'LOCAL_ONLY' : 'AMOUNT_OR_CURRENCY_MISMATCH' }));
    }
  }
  return Object.freeze({ ok: true, matched: differences.length === 0, differenceCount: differences.length, differences: Object.freeze(differences) });
}

module.exports = {
  createRefundStore, reconcileSettlement, registerCapturedPayment,
  requestRefund, reservedRefundAmount, transitionRefund
};
