'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { mapLegacyOrder, mapCoolingStatus, mapRadishStatus, canTransition, dedupeEvents } = require('./status-mapping');

test('orders.status=paid is not treated as order completion or payment confirmation', () => {
  const result = mapLegacyOrder({ status: 'paid', payment_status: 'unpaid' });
  assert.equal(result.order, 'unknown');
  assert.equal(result.payment, 'pending');
  assert.equal(result.needsReview, true);
});
test('payment proof submitted is not paid', () => {
  const result = mapLegacyOrder({ status: 'pending', payment_status: 'proof_submitted' });
  assert.equal(result.payment, 'proof_submitted');
});
test('cooling stored means arrived at store, not customer pickup', () => {
  const result = mapCoolingStatus('已寄放');
  assert.equal(result.fulfillment, 'arrived');
  assert.notEqual(result.fulfillment, 'delivered');
});
test('cooling picked up means delivered; payment remains unknown unless proven', () => {
  const result = mapCoolingStatus('已取貨');
  assert.equal(result.fulfillment, 'delivered');
  assert.equal(result.payment, 'unknown');
  assert.equal(result.needsReview, true);
});
test('radish payment method is not interpreted as payment state', () => {
  const result = mapRadishStatus('shipped');
  assert.equal(result.payment, 'unknown');
  assert.equal(result.fulfillment, 'shipped');
});
test('unknown legacy states are preserved and flagged for review', () => {
  const result = mapCoolingStatus('unexpected-state');
  assert.equal(result.source, 'unexpected-state');
  assert.equal(result.order, 'exception');
  assert.equal(result.needsReview, true);
});
test('forbidden order transitions are rejected', () => {
  assert.equal(canTransition('cancelled', 'preparing'), false);
  assert.equal(canTransition('fulfilled', 'preparing'), false);
  assert.equal(canTransition('proof_submitted', 'paid'), false);
  assert.equal(canTransition('placed', 'accepted'), true);
});
test('duplicate event IDs are processed only once', () => {
  const unique = dedupeEvents([{event_id:'e1'}, {event_id:'e1'}, {event_id:'e2'}, {}]);
  assert.deepEqual(unique.map(x => x.event_id), ['e1', 'e2']);
});
