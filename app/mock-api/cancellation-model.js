/**
 * Phase 51 order cancellation coordination reference model.
 * In-memory synthetic state only; no production order, payment, refund or stock writes.
 */
'use strict';
const { createHash } = require('node:crypto');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail = reason => Object.freeze({ ok: false, reason });
const RELEASED = new Set(['cancelled', 'refund_succeeded']);

function createCancellationStore() {
  return { orders: new Map(), inventory: new Map(), cancellationKeys: new Map(), cancellations: new Map() };
}
function setInventory({ store, sku, available, reserved = 0 } = {}) {
  if (!store || !(store.inventory instanceof Map)) return fail('CANCELLATION_STORE_INVALID');
  if (typeof sku !== 'string' || !sku.trim()) return fail('SKU_REQUIRED');
  if (!Number.isSafeInteger(available) || available < 0 || !Number.isSafeInteger(reserved) || reserved < 0) return fail('INVENTORY_QUANTITY_INVALID');
  store.inventory.set(sku, { sku, available, reserved });
  return Object.freeze({ ok: true });
}
function registerOrder({ store, orderId, paymentStatus = 'unpaid', orderStatus = 'awaiting_payment', lines, paymentId = null } = {}) {
  if (!store || !(store.orders instanceof Map) || !(store.inventory instanceof Map)) return fail('CANCELLATION_STORE_INVALID');
  if (typeof orderId !== 'string' || !orderId.trim()) return fail('ORDER_ID_REQUIRED');
  if (store.orders.has(orderId)) return fail('ORDER_ALREADY_REGISTERED');
  if (!['unpaid', 'succeeded'].includes(paymentStatus)) return fail('PAYMENT_STATUS_INVALID');
  if (!['awaiting_payment', 'processing', 'partially_shipped', 'shipped'].includes(orderStatus)) return fail('ORDER_STATUS_INVALID');
  if (!Array.isArray(lines) || !lines.length) return fail('ORDER_LINES_REQUIRED');
  const normalized = [];
  for (const line of lines) {
    if (!line || typeof line.sku !== 'string' || !line.sku.trim() || !Number.isSafeInteger(line.quantity) || line.quantity <= 0) return fail('ORDER_LINE_INVALID');
    const stock = store.inventory.get(line.sku);
    if (!stock || stock.reserved < line.quantity) return fail('RESERVED_STOCK_INSUFFICIENT');
    normalized.push(Object.freeze({ sku: line.sku, quantity: line.quantity }));
  }
  if (paymentStatus === 'succeeded' && (typeof paymentId !== 'string' || !paymentId.trim())) return fail('PAYMENT_ID_REQUIRED');
  store.orders.set(orderId, Object.freeze({
    orderId, paymentId, paymentStatus, orderStatus,
    lines: Object.freeze(normalized), cancellationStatus: 'none',
    cancelledAt: null, refundId: null, stockReleasedAt: null
  }));
  return Object.freeze({ ok: true });
}
function requestOrderCancellation({ store, orderId, reason, idempotencyKey, now } = {}) {
  if (!store || !(store.orders instanceof Map) || !(store.cancellationKeys instanceof Map) ||
      !(store.cancellations instanceof Map) || !(store.inventory instanceof Map)) return fail('CANCELLATION_STORE_INVALID');
  if (typeof orderId !== 'string' || !orderId.trim()) return fail('ORDER_ID_REQUIRED');
  if (typeof reason !== 'string' || !reason.trim()) return fail('CANCELLATION_REASON_REQUIRED');
  if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) return fail('CANCELLATION_IDEMPOTENCY_KEY_INVALID');
  if (!Number.isSafeInteger(now)) return fail('CANCELLATION_TIME_INVALID');
  const order = store.orders.get(orderId);
  if (!order) return fail('ORDER_NOT_FOUND');
  const requestHash = hash({ orderId, reason: reason.trim() });
  const prior = store.cancellationKeys.get(idempotencyKey);
  if (prior) {
    if (prior.requestHash !== requestHash) return fail('CANCELLATION_IDEMPOTENCY_CONFLICT');
    return Object.freeze({ ok: true, cancellation: prior.cancellation, replayed: true });
  }
  if (['partially_shipped', 'shipped'].includes(order.orderStatus)) return fail('ORDER_ALREADY_SHIPPED_OR_PARTIAL');
  if (order.orderStatus === 'processing') return fail('ORDER_PROCESSING_REVIEW_REQUIRED');
  if (order.cancellationStatus !== 'none' || order.orderStatus === 'cancelled') return fail('CANCELLATION_ALREADY_REQUESTED');
  const cancellationId = 'cx_' + hash({ orderId, idempotencyKey, requestHash }).slice(0, 24);
  const needsRefund = order.paymentStatus === 'succeeded';
  const cancellation = Object.freeze({
    cancellationId, orderId, reason: reason.trim(),
    status: needsRefund ? 'refund_pending' : 'cancelled',
    refundRequired: needsRefund, refundId: null, requestedAt: now,
    completedAt: needsRefund ? null : now
  });
  store.cancellations.set(cancellationId, cancellation);
  store.cancellationKeys.set(idempotencyKey, Object.freeze({ requestHash, cancellation }));
  if (needsRefund) {
    store.orders.set(orderId, Object.freeze({ ...order, cancellationStatus: 'refund_pending' }));
  } else {
    releaseReservedStock(store, order, now);
    store.orders.set(orderId, Object.freeze({ ...order, orderStatus: 'cancelled',
      cancellationStatus: 'cancelled', cancelledAt: now, stockReleasedAt: now }));
  }
  return Object.freeze({ ok: true, cancellation, replayed: false });
}
function releaseReservedStock(store, order, now) {
  for (const line of order.lines) {
    const stock = store.inventory.get(line.sku);
    if (!stock || stock.reserved < line.quantity) throw new Error('RESERVED_STOCK_INVARIANT_BROKEN');
    store.inventory.set(line.sku, { ...stock, reserved: stock.reserved - line.quantity, available: stock.available + line.quantity });
  }
}
function attachRefund({ store, cancellationId, refundId } = {}) {
  if (!store || !(store.cancellations instanceof Map) || !(store.orders instanceof Map)) return fail('CANCELLATION_STORE_INVALID');
  const cancellation = store.cancellations.get(cancellationId);
  if (!cancellation) return fail('CANCELLATION_NOT_FOUND');
  if (cancellation.status !== 'refund_pending' || typeof refundId !== 'string' || !refundId.trim()) return fail('REFUND_LINK_INVALID');
  const order = store.orders.get(cancellation.orderId);
  if (order.refundId) return fail('REFUND_ALREADY_LINKED');
  const nextCancellation = Object.freeze({ ...cancellation, refundId: refundId.trim() });
  store.cancellations.set(cancellationId, nextCancellation);
  store.orders.set(order.orderId, Object.freeze({ ...order, refundId: refundId.trim() }));
  return Object.freeze({ ok: true, cancellation: nextCancellation });
}
function confirmCancellationRefund({ store, cancellationId, refundId, succeeded, now } = {}) {
  if (!store || !(store.cancellations instanceof Map) || !(store.orders instanceof Map) || !(store.inventory instanceof Map)) return fail('CANCELLATION_STORE_INVALID');
  const cancellation = store.cancellations.get(cancellationId);
  if (!cancellation) return fail('CANCELLATION_NOT_FOUND');
  if (!Number.isSafeInteger(now)) return fail('CANCELLATION_TIME_INVALID');
  if (cancellation.status !== 'refund_pending' || !cancellation.refundId || cancellation.refundId !== refundId) return fail('REFUND_CONFIRMATION_MISMATCH');
  const order = store.orders.get(cancellation.orderId);
  if (succeeded !== true) return fail('REFUND_NOT_CONFIRMED');
  if (order.stockReleasedAt !== null) return fail('STOCK_ALREADY_RELEASED');
  releaseReservedStock(store, order, now);
  const nextCancellation = Object.freeze({ ...cancellation, status: 'refund_succeeded', completedAt: now });
  store.cancellations.set(cancellationId, nextCancellation);
  store.orders.set(order.orderId, Object.freeze({ ...order, orderStatus: 'cancelled',
    paymentStatus: 'refunded', cancellationStatus: 'refund_succeeded',
    cancelledAt: now, stockReleasedAt: now }));
  return Object.freeze({ ok: true, cancellation: nextCancellation });
}
module.exports = { attachRefund, confirmCancellationRefund, createCancellationStore,
  registerOrder, requestOrderCancellation, setInventory };
