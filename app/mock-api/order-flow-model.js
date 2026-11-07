/**
 * Phase 52 order, payment, fulfillment and notification coordination model.
 * In-memory synthetic reference only; no production writes or message delivery.
 */
'use strict';
const { createHash } = require('node:crypto');
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail = reason => Object.freeze({ ok: false, reason });

const ORDER_TRANSITIONS = Object.freeze({
  awaiting_payment: new Set(['confirmed', 'cancelled']),
  confirmed: new Set(['preparing', 'cancelled']),
  preparing: new Set(['ready_to_ship', 'cancelled']),
  ready_to_ship: new Set(['shipped', 'cancelled']),
  shipped: new Set(['delivered']),
  delivered: new Set(),
  cancelled: new Set()
});
const PAYMENT_TRANSITIONS = Object.freeze({
  unpaid: new Set(['proof_submitted', 'confirmed', 'rejected']),
  proof_submitted: new Set(['confirmed', 'rejected']),
  confirmed: new Set(['refunded']),
  rejected: new Set(),
  refunded: new Set()
});
const FULFILLMENT_TRANSITIONS = Object.freeze({
  unprepared: new Set(['preparing', 'cancelled']),
  preparing: new Set(['prepared', 'cancelled']),
  prepared: new Set(['shipped', 'cancelled']),
  shipped: new Set(['delivered']),
  delivered: new Set(),
  cancelled: new Set()
});

function createOrderFlowStore() {
  return { orders: new Map(), events: new Map(), outbox: new Map(), notificationKeys: new Map() };
}
function createOrderFlow({ store, orderId, paymentStatus = 'unpaid', fulfillmentStatus = 'unprepared',
  fulfillmentType, now } = {}) {
  if (!store || !(store.orders instanceof Map)) return fail('ORDER_FLOW_STORE_INVALID');
  if (typeof orderId !== 'string' || !orderId.trim()) return fail('ORDER_ID_REQUIRED');
  if (store.orders.has(orderId)) return fail('ORDER_ALREADY_EXISTS');
  if (!Object.hasOwn(PAYMENT_TRANSITIONS, paymentStatus)) return fail('PAYMENT_STATUS_INVALID');
  if (!Object.hasOwn(FULFILLMENT_TRANSITIONS, fulfillmentStatus)) return fail('FULFILLMENT_STATUS_INVALID');
  if (!['lianggao_home_delivery', 'lianggao_store_cooling_pickup',
    'radish_frozen_store_to_store', 'radish_frozen_home_delivery', 'truck_pickup'].includes(fulfillmentType)) return fail('FULFILLMENT_TYPE_INVALID');
  if (!Number.isSafeInteger(now)) return fail('ORDER_TIME_INVALID');
  const order = Object.freeze({
    orderId: orderId.trim(), orderStatus: paymentStatus === 'unpaid' ? 'awaiting_payment' : 'confirmed',
    paymentStatus, fulfillmentStatus, fulfillmentType, version: 1, updatedAt: now
  });
  store.orders.set(orderId, order);
  return Object.freeze({ ok: true, order });
}
function transitionOrderFlow({ store, orderId, dimension, nextStatus, expectedVersion, now, eventId } = {}) {
  if (!store || !(store.orders instanceof Map) || !(store.events instanceof Map)) return fail('ORDER_FLOW_STORE_INVALID');
  const order = store.orders.get(orderId);
  if (!order) return fail('ORDER_NOT_FOUND');
  if (!Number.isSafeInteger(now)) return fail('ORDER_TIME_INVALID');
  if (typeof eventId !== 'string' || !eventId.trim()) return fail('EVENT_ID_REQUIRED');
  if (store.events.has(eventId)) {
    const previous = store.events.get(eventId);
    if (previous.orderId !== orderId || previous.dimension !== dimension || previous.nextStatus !== nextStatus) return fail('EVENT_ID_CONFLICT');
    return Object.freeze({ ok: true, duplicate: true, order: store.orders.get(orderId) });
  }
  if (expectedVersion !== order.version) return fail('ORDER_VERSION_CONFLICT');
  let transitions;
  if (dimension === 'order') transitions = ORDER_TRANSITIONS;
  else if (dimension === 'payment') transitions = PAYMENT_TRANSITIONS;
  else if (dimension === 'fulfillment') transitions = FULFILLMENT_TRANSITIONS;
  else return fail('ORDER_DIMENSION_INVALID');
  const currentStatus = dimension === 'order' ? order.orderStatus :
    dimension === 'payment' ? order.paymentStatus : order.fulfillmentStatus;
  if (!transitions[currentStatus]?.has(nextStatus)) return fail('STATUS_TRANSITION_NOT_ALLOWED');
  if (dimension === 'payment' && nextStatus === 'confirmed' && order.orderStatus === 'cancelled') return fail('CANCELLED_ORDER_CANNOT_BE_PAID');
  if (dimension === 'fulfillment' && nextStatus === 'shipped' && order.paymentStatus !== 'confirmed') return fail('PAYMENT_REQUIRED_BEFORE_SHIPMENT');
  if (dimension === 'order' && nextStatus === 'shipped' && order.paymentStatus !== 'confirmed') return fail('PAYMENT_REQUIRED_BEFORE_SHIPMENT');
  if (dimension === 'order' && nextStatus === 'delivered' && order.fulfillmentStatus !== 'shipped') return fail('FULFILLMENT_NOT_SHIPPED');
  const next = Object.freeze({ ...order, [dimension === 'order' ? 'orderStatus' :
    dimension === 'payment' ? 'paymentStatus' : 'fulfillmentStatus']: nextStatus,
    version: order.version + 1, updatedAt: now });
  store.orders.set(orderId, next);
  store.events.set(eventId, Object.freeze({ orderId, dimension, nextStatus, at: now, version: next.version }));
  return Object.freeze({ ok: true, duplicate: false, order: next });
}
function enqueueNotification({ store, orderId, eventType, channel = 'line', recipientRef, payload, idempotencyKey, now } = {}) {
  if (!store || !(store.orders instanceof Map) || !(store.outbox instanceof Map) ||
      !(store.notificationKeys instanceof Map)) return fail('ORDER_FLOW_STORE_INVALID');
  if (!store.orders.has(orderId)) return fail('ORDER_NOT_FOUND');
  if (typeof eventType !== 'string' || !eventType.trim()) return fail('NOTIFICATION_EVENT_REQUIRED');
  if (!['line', 'email', 'sms', 'push'].includes(channel)) return fail('NOTIFICATION_CHANNEL_INVALID');
  if (typeof recipientRef !== 'string' || !recipientRef.trim()) return fail('NOTIFICATION_RECIPIENT_REQUIRED');
  if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) return fail('NOTIFICATION_KEY_INVALID');
  if (!Number.isSafeInteger(now)) return fail('NOTIFICATION_TIME_INVALID');
  const payloadHash = digest(payload ?? {});
  const previous = store.notificationKeys.get(idempotencyKey);
  if (previous) {
    if (previous.payloadHash !== payloadHash || previous.orderId !== orderId || previous.channel !== channel) return fail('NOTIFICATION_IDEMPOTENCY_CONFLICT');
    return Object.freeze({ ok: true, duplicate: true, notification: previous.notification });
  }
  const notificationId = 'nt_' + digest({ orderId, eventType, channel, idempotencyKey }).slice(0, 24);
  const notification = Object.freeze({ notificationId, orderId, eventType, channel,
    recipientRef: recipientRef.trim(), payload: Object.freeze({ ...(payload ?? {}) }),
    status: 'queued', attempts: 0, createdAt: now, sentAt: null, lastError: null });
  store.outbox.set(notificationId, notification);
  store.notificationKeys.set(idempotencyKey, Object.freeze({ orderId, channel, payloadHash, notification }));
  return Object.freeze({ ok: true, duplicate: false, notification });
}
function recordNotificationAttempt({ store, notificationId, outcome, now, errorCode } = {}) {
  if (!store || !(store.outbox instanceof Map)) return fail('ORDER_FLOW_STORE_INVALID');
  const current = store.outbox.get(notificationId);
  if (!current) return fail('NOTIFICATION_NOT_FOUND');
  if (!Number.isSafeInteger(now)) return fail('NOTIFICATION_TIME_INVALID');
  if (!['sent', 'retryable_failure', 'permanent_failure'].includes(outcome)) return fail('NOTIFICATION_OUTCOME_INVALID');
  if (['sent', 'permanent_failure'].includes(current.status)) return fail('NOTIFICATION_ALREADY_TERMINAL');
  const next = Object.freeze({ ...current, status: outcome === 'sent' ? 'sent' :
    outcome === 'retryable_failure' ? 'queued' : 'permanent_failure',
    attempts: current.attempts + 1, sentAt: outcome === 'sent' ? now : current.sentAt,
    lastError: outcome === 'sent' ? null : (typeof errorCode === 'string' ? errorCode : 'DELIVERY_FAILED') });
  store.outbox.set(notificationId, next);
  return Object.freeze({ ok: true, notification: next });
}
module.exports = { createOrderFlow, createOrderFlowStore, enqueueNotification,
  recordNotificationAttempt, transitionOrderFlow };
