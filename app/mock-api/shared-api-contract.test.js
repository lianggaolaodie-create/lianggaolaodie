/** Phase 66 API contract regression tests using synthetic fixtures only. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const adapters = require('./production-read-adapters');
const members = require('./member-order-model');
const owner = require('./owner-order-admin-model');
const checkout = require('./checkout-gate');

test('public DTOs expose only allowlisted fields and reject disabled records', () => {
  const flavors = adapters.mapFlavorCatalog([
    { id: 1, product_name: '涼糕', name: '黑糖', description: '公開', price: 100, image_url: 'x', flavor_type: 'single', enabled: true, admin_note: 'secret' },
    { id: 2, name: '停售', enabled: false }
  ]);
  assert.equal(flavors.length, 1);
  assert.deepEqual(Object.keys(flavors[0]).sort(),
    ['description','enabled','flavorType','id','imageUrl','name','price','productName'].sort());
  const radish = adapters.mapRadishProducts({ data: { products: [
    { id: 'r1', name: '蘿蔔糕', price: 200, spec: '盒', description: '說明', image_url: 'img', enabled: true, online_enabled: true, secret: 'x' },
    { id: 'r2', name: '不開放', price: 100, enabled: true, online_enabled: false }
  ] } });
  assert.equal(radish.length, 1);
  assert.equal(Object.hasOwn(radish[0], 'secret'), false);
  const merch = adapters.mapMerchandise({
    categories: [{ id: 1, enabled: true }, { id: 2, enabled: false }],
    products: [
      { id: 1, category_id: 1, name: '帽子', price: 300, enabled: true, stock: 88 },
      { id: 2, category_id: 2, name: '隱藏', price: 10, enabled: true }
    ]
  });
  assert.equal(merch.length, 1);
  assert.equal(Object.hasOwn(merch[0], 'stock'), false);
});

test('daily menu uses date-scoped snapshot and does not expose exact inventory', () => {
  const menu = adapters.mapDailyMenu({
    todayTaipei: '2026-11-08',
    setting: { order_date: '2026-11-08', ordering_enabled: true, notes: 'private' },
    regions: [{ order_date: '2026-11-08', region_name: '台北', enabled: true }],
    items: [{ id: 9, order_date: '2026-11-08', flavor_id: 3, product_name: '涼糕', flavor_name: '芋頭', price: 155, quantity: 27, enabled: true, stock_note: 'secret' }]
  });
  assert.equal(menu.items[0].price, 155);
  assert.equal(menu.items[0].available, true);
  assert.equal(Object.hasOwn(menu.items[0], 'quantity'), false);
  assert.equal(Object.hasOwn(menu, 'notes'), false);
  const closed = adapters.mapDailyMenu({
    todayTaipei: '2026-11-08',
    setting: { order_date: '2026-11-08', ordering_enabled: false }
  });
  assert.equal(closed, null);
});

test('stall payload is structurally price-free even when source contains legacy and current prices', () => {
  const dto = adapters.mapSchedule({
    schedule: { id: 10, schedule_date: '2026-11-09', schedule_type: 'stall', enabled: true, title: '市集', region: '台北', start_time: '10:00', end_time: '18:00', note: 'private', address: 'private' },
    links: [{ schedule_id: 10, flavor_id: 3, price_per_box: 150, price: 160, unit_price: 170 }],
    flavorsById: { '3': { id: 3, name: '芋頭', enabled: true } }
  });
  assert.deepEqual(dto.flavors, [{ flavorId: 3, name: '芋頭' }]);
  for (const key of ['price','pricePerBox','unitPrice','address','note']) {
    assert.equal(JSON.stringify(dto).toLowerCase().includes(key.toLowerCase()), false);
  }
});

test('food truck exposes only price_per_box and excludes legacy price fields', () => {
  const dto = adapters.mapSchedule({
    schedule: { id: 11, schedule_date: '2026-11-09', schedule_type: 'food_truck', enabled: true, title: '餐車', region: '雙北', start_time: '09:00', end_time: '18:00' },
    links: [{ schedule_id: 11, flavor_id: 4, price_per_box: 120, price: 999, unit_price: 888 }],
    flavorsById: { '4': { id: 4, name: '水果綜合', enabled: true } }
  });
  assert.equal(dto.flavors[0].pricePerBox, 120);
  assert.equal(Object.hasOwn(dto.flavors[0], 'price'), false);
  assert.equal(Object.hasOwn(dto.flavors[0], 'unitPrice'), false);
});

test('checkout authorization rejects client-invented totals by using only registered server quote', () => {
  const store = checkout.createCheckoutGateStore();
  const cart = { items: [{ productId: 'flavor-1', variantId: '', quantity: 2 }] };
  const fulfillmentMethod = 'lianggao_home_delivery';
  const recipient = { name: '測試', phone: '0900000000', address: '測試地址' };
  const quoteModel = require('./quote-model');
  const quoteResult = quoteModel.issueQuote({
    cart,
    fulfillmentMethod,
    recipient,
    trustedCatalog: {
      'flavor-1': { enabled: true, onlineEnabled: true, category: 'lianggao', unitPriceMinor: 10000, name: '黑糖' }
    },
    trustedRates: { [fulfillmentMethod]: { enabled: true, feeMinor: 4000 } },
    quoteId: 'quote-phase66',
    issuedAt: 500,
    expiresAt: 2000
  });
  assert.equal(quoteResult.ok, true);
  assert.equal(checkout.registerServerQuote(store, quoteResult.quote).ok, true);
  const result = checkout.authorizeCheckout({
    store, quoteId: 'quote-phase66', cart, fulfillmentMethod, recipient,
    serverNow: 1000, sessionId: 'session-phase66', idempotencyKey: 'phase66-key-000001',
    clientTotal: 1, paymentStatus: 'confirmed'
  });
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.totalMinor, 24000);
  assert.equal(result.orderCreationEnabled, false);
  assert.equal(result.paymentExecutionEnabled, false);
});

test('member order lookup denies another member and permits verified owner only', () => {
  const store = members.createMemberOrderStore();
  assert.equal(members.registerSyntheticOrder({
    store, order: { orderId: 'M66-1', ownerSubject: 'member-a', status: 'confirmed', paymentStatus: 'confirmed', fulfillmentType: 'home_delivery' }, now: 1
  }).ok, true);
  assert.equal(members.lookupCustomerOrder({
    store, orderId: 'M66-1', principal: { verified: true, subject: 'member-b' }, now: 2
  }).reason, 'ORDER_ACCESS_DENIED');
  assert.equal(members.lookupCustomerOrder({
    store, orderId: 'M66-1', principal: { verified: true, subject: 'member-a' }, now: 2
  }).ok, true);
  assert.equal(members.lookupCustomerOrder({
    store, orderId: 'M66-1', principal: { verified: false, subject: 'member-a' }, now: 2
  }).reason, 'ORDER_ACCESS_DENIED');
});

test('guest order claim expires and can be revoked', () => {
  const store = members.createMemberOrderStore();
  members.registerSyntheticOrder({
    store, order: { orderId: 'G66-1', status: 'awaiting_payment', paymentStatus: 'unpaid', fulfillmentType: 'cold_store_pickup' }, now: 10
  });
  const claim = members.issueGuestOrderClaim({ store, orderId: 'G66-1', now: 10, ttlMs: 60000 });
  assert.equal(claim.ok, true);
  assert.equal(members.lookupCustomerOrder({ store, orderId: 'G66-1', guestClaimToken: claim.token, now: 11 }).ok, true);
  assert.equal(members.lookupCustomerOrder({ store, orderId: 'G66-1', guestClaimToken: claim.token, now: 70010 }).reason, 'ORDER_ACCESS_DENIED');
  const claim2 = members.issueGuestOrderClaim({ store, orderId: 'G66-1', now: 20, ttlMs: 60000 });
  members.revokeGuestOrderClaim({ store, token: claim2.token, now: 21 });
  assert.equal(members.lookupCustomerOrder({ store, orderId: 'G66-1', guestClaimToken: claim2.token, now: 22 }).reason, 'ORDER_ACCESS_DENIED');
});

test('personal data administrator cannot review payment or update fulfillment', () => {
  const store = owner.createOwnerOrderStore();
  owner.seedOwnerOrder({
    store, now: 1,
    order: { orderId: 'O66-1', orderStatus: 'confirmed', paymentStatus: 'confirmed', productType: 'lianggao', source: 'online', fulfillmentType: 'home_delivery' }
  });
  const actor = { verified: true, subject: 'privacy-admin', role: 'personal_data_admin' };
  assert.equal(owner.updateOwnerFulfillment({
    store, actor, orderId: 'O66-1', nextStatus: 'preparing', expectedVersion: 1, now: 2, idempotencyKey: 'phase66-fulfill-0001'
  }).reason, 'PERMISSION_FORBIDDEN');
  assert.equal(owner.reviewOrderPayment({
    store, actor, orderId: 'O66-1', decision: 'confirmed', expectedVersion: 1, now: 2, idempotencyKey: 'phase66-payment-0001'
  }).reason, 'PERMISSION_FORBIDDEN');
});

test('owner fulfillment cannot ship until payment is confirmed', () => {
  const store = owner.createOwnerOrderStore();
  owner.seedOwnerOrder({
    store, now: 1,
    order: { orderId: 'O66-2', orderStatus: 'awaiting_payment', paymentStatus: 'unpaid', fulfillmentStatus: 'ready_to_ship', productType: 'radish_cake', source: 'online', fulfillmentType: 'home_delivery' }
  });
  const actor = { verified: true, subject: 'order-admin', role: 'order_admin' };
  assert.equal(owner.updateOwnerFulfillment({
    store, actor, orderId: 'O66-2', nextStatus: 'shipped', expectedVersion: 1, now: 2, idempotencyKey: 'phase66-ship-000001'
  }).reason, 'PAYMENT_REQUIRED');
});
