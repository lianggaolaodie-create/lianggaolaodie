'use strict';

const ORDER = {
  pending: 'placed', confirmed: 'accepted', preparing: 'preparing',
  shipped: 'preparing', completed: 'fulfilled', cancelled: 'cancelled',
  paid: 'unknown', stored: 'accepted', delivering: 'preparing', delivered: 'fulfilled'
};
const PAYMENT = {
  unpaid: 'pending', proof_submitted: 'proof_submitted',
  confirmed: 'paid', rejected: 'rejected', cod: 'not_required'
};
const COOLING = {
  '待確認匯款': { order: 'accepted', payment: 'pending', fulfillment: 'not_created' },
  '已付款': { order: 'accepted', payment: 'paid', fulfillment: 'not_created' },
  '製作中': { order: 'preparing', payment: 'unknown', fulfillment: 'pending' },
  '已出貨': { order: 'preparing', payment: 'unknown', fulfillment: 'shipped' },
  '已寄放': { order: 'preparing', payment: 'unknown', fulfillment: 'arrived' },
  '已取貨': { order: 'fulfilled', payment: 'unknown', fulfillment: 'delivered' },
  '已完成': { order: 'fulfilled', payment: 'unknown', fulfillment: 'delivered' },
  '已取消': { order: 'cancelled', payment: 'unknown', fulfillment: 'unknown' }
};
const RADISH_ORDER = {
  pending: 'placed', confirmed: 'accepted', preparing: 'preparing',
  shipped: 'preparing', delivered: 'fulfilled', completed: 'fulfilled', cancelled: 'cancelled'
};

function mapLegacyOrder(row) {
  if (!row || typeof row !== 'object') throw new TypeError('order row required');
  const oldOrder = row.status;
  const oldPayment = row.payment_status;
  const order = ORDER[oldOrder] || 'exception';
  const payment = PAYMENT[oldPayment] || 'unknown';
  const fulfillment = oldOrder === 'stored' ? 'arrived'
    : oldOrder === 'shipped' ? 'shipped'
    : oldOrder === 'delivering' ? 'in_transit'
    : oldOrder === 'delivered' || oldOrder === 'completed' ? 'delivered'
    : oldOrder === 'cancelled' ? 'unknown' : 'not_created';
  return { order, payment, fulfillment, source: { order: oldOrder ?? null, payment: oldPayment ?? null }, needsReview: order === 'exception' || payment === 'unknown' || oldOrder === 'paid' };
}

function mapCoolingStatus(status) {
  const value = COOLING[status];
  return value ? { ...value, source: status, needsReview: value.payment === 'unknown' }
    : { order: 'exception', payment: 'unknown', fulfillment: 'exception', source: status ?? null, needsReview: true };
}

function mapRadishStatus(status) {
  const order = RADISH_ORDER[status] || 'exception';
  const fulfillment = status === 'shipped' ? 'shipped'
    : status === 'delivered' || status === 'completed' ? 'delivered'
    : status === 'cancelled' ? 'unknown' : 'not_created';
  return { order, payment: 'unknown', fulfillment, source: status ?? null, needsReview: true };
}

const ALLOWED = {
  draft: ['placed'], placed: ['accepted', 'rejected', 'cancellation_requested', 'exception'],
  accepted: ['preparing', 'cancellation_requested', 'exception'],
  preparing: ['fulfilled', 'cancellation_requested', 'exception'],
  cancellation_requested: ['cancelled', 'accepted', 'preparing'],
  exception: ['accepted', 'preparing', 'cancelled'],
  fulfilled: [], cancelled: [], rejected: []
};
function canTransition(from, to) { return Boolean(ALLOWED[from] && ALLOWED[from].includes(to)); }

function dedupeEvents(events) {
  const seen = new Set();
  return events.filter(event => {
    if (!event || typeof event.event_id !== 'string' || !event.event_id) return false;
    if (seen.has(event.event_id)) return false;
    seen.add(event.event_id);
    return true;
  });
}

module.exports = { mapLegacyOrder, mapCoolingStatus, mapRadishStatus, canTransition, dedupeEvents };
