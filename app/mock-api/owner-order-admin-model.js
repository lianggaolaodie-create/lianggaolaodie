/**
 * Phase 60 owner order operations reference model.
 * Synthetic in-memory only; no production order, payment, inventory or shipment writes.
 */
'use strict';
const { createHash } = require('node:crypto');
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail = reason => Object.freeze({ ok: false, reason });
const ROLES = new Set(['super_admin', 'order_admin', 'personal_data_admin']);
const PAYMENT_STATES = new Set(['unpaid', 'proof_submitted', 'confirmed', 'rejected', 'refunded']);
const ORDER_STATES = new Set(['awaiting_payment', 'confirmed', 'preparing', 'ready_to_ship', 'shipped', 'delivered', 'cancelled']);

function createOwnerOrderStore() {
  return { orders: new Map(), audit: [], idempotency: new Map() };
}
function seedOwnerOrder({ store, order, now } = {}) {
  if (!store || !(store.orders instanceof Map)) return fail('STORE_INVALID');
  if (!order || typeof order.orderId !== 'string' || !order.orderId.trim() || store.orders.has(order.orderId)) return fail('ORDER_INVALID');
  if (!Number.isSafeInteger(now)) return fail('TIME_INVALID');
  if (!ORDER_STATES.has(order.orderStatus) || !PAYMENT_STATES.has(order.paymentStatus)) return fail('ORDER_STATE_INVALID');
  if (!['lianggao', 'radish_cake'].includes(order.productType)) return fail('PRODUCT_TYPE_INVALID');
  if (!['online', 'walk_in'].includes(order.source)) return fail('ORDER_SOURCE_INVALID');
  if (!['food_truck', 'stall', 'home_delivery', 'cold_store_pickup', 'frozen_store_to_store'].includes(order.fulfillmentType)) return fail('FULFILLMENT_TYPE_INVALID');
  const safe = Object.freeze({
    orderId: order.orderId.trim(), orderStatus: order.orderStatus, paymentStatus: order.paymentStatus,
    fulfillmentStatus: String(order.fulfillmentStatus || 'unprepared'),
    productType: order.productType, source: order.source, fulfillmentType: order.fulfillmentType,
    scheduleType: order.scheduleType === 'stall' ? 'stall' : order.scheduleType === 'food_truck' ? 'food_truck' : null,
    items: Object.freeze((Array.isArray(order.items) ? order.items : []).slice(0, 30).map(item => Object.freeze({
      name: String(item?.name || '').slice(0, 80),
      quantity: Number.isSafeInteger(item?.quantity) && item.quantity > 0 ? item.quantity : 1,
      unitPrice: Number.isFinite(item?.unitPrice) && item.unitPrice >= 0 ? item.unitPrice : null,
      lineTotal: Number.isFinite(item?.lineTotal) && item.lineTotal >= 0 ? item.lineTotal : null
    }))),
    total: Number.isFinite(order.total) && order.total >= 0 ? order.total : null,
    recipientMasked: String(order.recipientMasked || '').slice(0, 40),
    version: 1, createdAt: now, updatedAt: now
  });
  store.orders.set(safe.orderId, safe);
  return Object.freeze({ ok: true, order: safe });
}
function authorize(actor, permission) {
  if (!actor || actor.verified !== true || typeof actor.subject !== 'string' || !actor.subject.trim()) return fail('ACTOR_NOT_VERIFIED');
  if (!ROLES.has(actor.role)) return fail('ROLE_FORBIDDEN');
  if (permission === 'payment_review' && !['super_admin', 'order_admin'].includes(actor.role)) return fail('PERMISSION_FORBIDDEN');
  if (permission === 'manage_fulfillment' && !['super_admin', 'order_admin'].includes(actor.role)) return fail('PERMISSION_FORBIDDEN');
  if (permission === 'view_personal_data' && !['super_admin', 'personal_data_admin'].includes(actor.role)) return fail('PERMISSION_FORBIDDEN');
  return { ok: true };
}
function listOwnerOrders({ store, actor, filters = {} } = {}) {
  const auth = authorize(actor, 'list_orders');
  if (!auth.ok) return auth;
  if (!store || !(store.orders instanceof Map)) return fail('STORE_INVALID');
  const rows = [...store.orders.values()].filter(order =>
    (!filters.status || order.orderStatus === filters.status) &&
    (!filters.paymentStatus || order.paymentStatus === filters.paymentStatus) &&
    (!filters.source || order.source === filters.source) &&
    (!filters.productType || order.productType === filters.productType)
  ).sort((a,b) => b.createdAt - a.createdAt);
  return Object.freeze({ ok: true, orders: rows.map(order => Object.freeze({
    orderId: order.orderId, orderStatus: order.orderStatus, paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus, productType: order.productType, source: order.source,
    fulfillmentType: order.fulfillmentType, scheduleType: order.scheduleType,
    itemCount: order.items.reduce((n,item)=>n+item.quantity,0), total: order.total,
    recipientMasked: order.recipientMasked, createdAt: order.createdAt, version: order.version
  })) });
}
function reviewOrderPayment({ store, actor, orderId, decision, expectedVersion, now, idempotencyKey, note = '' } = {}) {
  const auth = authorize(actor, 'payment_review');
  if (!auth.ok) return auth;
  if (!store || !(store.orders instanceof Map) || !Array.isArray(store.audit) || !(store.idempotency instanceof Map)) return fail('STORE_INVALID');
  if (!['confirmed','rejected'].includes(decision)) return fail('PAYMENT_DECISION_INVALID');
  if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) return fail('IDEMPOTENCY_KEY_INVALID');
  if (!Number.isSafeInteger(now)) return fail('TIME_INVALID');
  const fingerprint = digest({ orderId, decision, expectedVersion, note });
  const replay = store.idempotency.get(idempotencyKey);
  if (replay) return replay.fingerprint === fingerprint ? Object.freeze({ ...replay.result, duplicate: true }) : fail('IDEMPOTENCY_CONFLICT');
  const order = store.orders.get(orderId);
  if (!order) return fail('ORDER_NOT_FOUND');
  if (order.version !== expectedVersion) return fail('VERSION_CONFLICT');
  if (order.paymentStatus !== 'proof_submitted') return fail('PAYMENT_NOT_REVIEWABLE');
  if (decision === 'confirmed' && order.orderStatus === 'cancelled') return fail('CANCELLED_ORDER');
  const next = Object.freeze({ ...order, paymentStatus: decision,
    orderStatus: decision === 'confirmed' && order.orderStatus === 'awaiting_payment' ? 'confirmed' : order.orderStatus,
    version: order.version + 1, updatedAt: now });
  store.orders.set(orderId, next);
  const audit = Object.freeze({ actor: actor.subject, action: 'payment_'+decision, orderId,
    from: order.paymentStatus, to: decision, note: String(note).slice(0,200), at: now, version: next.version });
  store.audit.push(audit);
  const result = Object.freeze({ ok: true, duplicate: false, order: next, audit });
  store.idempotency.set(idempotencyKey, { fingerprint, result });
  return result;
}
function updateOwnerFulfillment({ store, actor, orderId, nextStatus, expectedVersion, now, idempotencyKey } = {}) {
  const auth = authorize(actor, 'manage_fulfillment');
  if (!auth.ok) return auth;
  if (!store || !(store.orders instanceof Map) || !Array.isArray(store.audit) || !(store.idempotency instanceof Map)) return fail('STORE_INVALID');
  const allowed = { unprepared:['preparing','cancelled'], preparing:['prepared','cancelled'], prepared:['ready_to_ship','cancelled'], ready_to_ship:['shipped','cancelled'], shipped:['delivered'], delivered:[], cancelled:[] };
  if (!Number.isSafeInteger(now)) return fail('TIME_INVALID');
  if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) return fail('IDEMPOTENCY_KEY_INVALID');
  const fingerprint = digest({ orderId, nextStatus, expectedVersion });
  const replay = store.idempotency.get(idempotencyKey);
  if (replay) return replay.fingerprint === fingerprint ? Object.freeze({ ...replay.result, duplicate: true }) : fail('IDEMPOTENCY_CONFLICT');
  const order = store.orders.get(orderId);
  if (!order) return fail('ORDER_NOT_FOUND');
  if (order.version !== expectedVersion) return fail('VERSION_CONFLICT');
  if (!allowed[order.fulfillmentStatus]?.includes(nextStatus)) return fail('FULFILLMENT_TRANSITION_INVALID');
  if (nextStatus === 'shipped' && order.paymentStatus !== 'confirmed') return fail('PAYMENT_REQUIRED');
  const next = Object.freeze({ ...order, fulfillmentStatus: nextStatus,
    orderStatus: nextStatus === 'shipped' ? 'shipped' : nextStatus === 'delivered' ? 'delivered' : order.orderStatus,
    version: order.version + 1, updatedAt: now });
  store.orders.set(orderId, next);
  const audit = Object.freeze({ actor: actor.subject, action: 'fulfillment_'+nextStatus,
    orderId, from: order.fulfillmentStatus, to: nextStatus, at: now, version: next.version });
  store.audit.push(audit);
  const result = Object.freeze({ ok: true, duplicate: false, order: next, audit });
  store.idempotency.set(idempotencyKey, { fingerprint, result });
  return result;
}
function cancelOwnerOrder({ store, actor, orderId, expectedVersion, now, idempotencyKey, reason = '' } = {}) {
  const auth = authorize(actor, 'manage_fulfillment');
  if (!auth.ok) return auth;
  if (!store || !(store.orders instanceof Map) || !Array.isArray(store.audit) || !(store.idempotency instanceof Map)) return fail('STORE_INVALID');
  if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) return fail('IDEMPOTENCY_KEY_INVALID');
  if (!Number.isSafeInteger(now)) return fail('TIME_INVALID');
  const fingerprint = digest({ orderId, expectedVersion, reason });
  const replay = store.idempotency.get(idempotencyKey);
  if (replay) return replay.fingerprint === fingerprint ? Object.freeze({ ...replay.result, duplicate: true }) : fail('IDEMPOTENCY_CONFLICT');
  const order = store.orders.get(orderId);
  if (!order) return fail('ORDER_NOT_FOUND');
  if (order.version !== expectedVersion) return fail('VERSION_CONFLICT');
  if (['shipped','delivered'].includes(order.orderStatus) || ['shipped','delivered'].includes(order.fulfillmentStatus)) return fail('ALREADY_SHIPPED');
  if (order.paymentStatus === 'confirmed') return fail('REFUND_REQUIRED_BEFORE_CANCEL');
  if (!['awaiting_payment','confirmed','preparing','ready_to_ship'].includes(order.orderStatus)) return fail('ORDER_NOT_CANCELLABLE');
  const next = Object.freeze({ ...order, orderStatus:'cancelled', fulfillmentStatus:'cancelled',
    version:order.version+1, updatedAt:now });
  store.orders.set(orderId,next);
  const audit = Object.freeze({ actor:actor.subject, action:'order_cancelled', orderId,
    from:order.orderStatus, to:'cancelled', reason:String(reason).slice(0,200), at:now, version:next.version });
  store.audit.push(audit);
  const result = Object.freeze({ok:true,duplicate:false,order:next,audit});
  store.idempotency.set(idempotencyKey, { fingerprint, result });
  return result;
}
function getOwnerOrderDetail({ store, actor, orderId } = {}) {
  const auth = authorize(actor, 'list_orders');
  if (!auth.ok) return auth;
  const order = store?.orders?.get(orderId);
  if (!order) return fail('ORDER_NOT_FOUND');
  const personal = actor.role === 'super_admin' || actor.role === 'personal_data_admin';
  return Object.freeze({ ok:true, order:Object.freeze({
    ...order,
    recipientMasked: personal ? order.recipientMasked : '••••',
    items: order.items.map(item => ({...item}))
  }) });
}
module.exports = { createOwnerOrderStore, seedOwnerOrder, listOwnerOrders, getOwnerOrderDetail,
  reviewOrderPayment, updateOwnerFulfillment, cancelOwnerOrder };
