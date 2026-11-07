/**
 * Phase 70 synthetic staging seed fixtures.
 *
 * Pure data only: no Supabase SDK, network, credentials, production data or writes.
 * Fixtures are deterministic and safe for local/CI contract tests.
 */
export const stagingSeed = Object.freeze({
  schemaVersion: 1,
  environment: 'synthetic-staging',
  users: Object.freeze([
    { id: 'user-customer-a', role: 'customer', email: 'customer-a@example.test', verified: true },
    { id: 'user-customer-b', role: 'customer', email: 'customer-b@example.test', verified: true },
    { id: 'user-super-admin', role: 'super_admin', email: 'super-admin@example.test', verified: true },
    { id: 'user-product-admin', role: 'product_admin', email: 'product-admin@example.test', verified: true },
    { id: 'user-order-admin', role: 'order_admin', email: 'order-admin@example.test', verified: true },
    { id: 'user-payment-admin', role: 'payment_admin', email: 'payment-admin@example.test', verified: true },
    { id: 'user-personal-data-admin', role: 'personal_data_admin', email: 'privacy-admin@example.test', verified: true },
  ]),
  products: Object.freeze([
    { id: 'prod-lianggao', type: 'lianggao', name: '涼糕', enabled: true },
    { id: 'prod-radish', type: 'radish_cake', name: '蘿蔔糕', enabled: true },
  ]),
  flavors: Object.freeze([
    { id: 'flavor-black-sugar', productId: 'prod-lianggao', name: '黑糖', enabled: true },
    { id: 'flavor-taro', productId: 'prod-lianggao', name: '芋頭', enabled: true },
    { id: 'flavor-disabled', productId: 'prod-lianggao', name: '測試停售口味', enabled: false },
  ]),
  schedules: Object.freeze([
    { id: 'schedule-truck-001', type: 'food_truck', title: '合成餐車場次', date: '2030-01-15', region: '測試區', enabled: true, publicPrice: 100 },
    { id: 'schedule-stall-001', type: 'stall', title: '合成擺攤場次', date: '2030-01-16', region: '測試區', enabled: true, internalPrice: 100 },
  ]),
  orders: Object.freeze([
    { id: 'order-a-unpaid', ownerId: 'user-customer-a', status: 'pending', paymentStatus: 'unpaid', fulfillmentStatus: 'unfulfilled', version: 1 },
    { id: 'order-a-proof', ownerId: 'user-customer-a', status: 'pending', paymentStatus: 'proof_submitted', fulfillmentStatus: 'unfulfilled', version: 1 },
    { id: 'order-b-paid', ownerId: 'user-customer-b', status: 'confirmed', paymentStatus: 'paid', fulfillmentStatus: 'ready', version: 2 },
    { id: 'order-a-cancelled', ownerId: 'user-customer-a', status: 'cancelled', paymentStatus: 'unpaid', fulfillmentStatus: 'unfulfilled', version: 3 },
  ]),
  guestClaims: Object.freeze([
    { orderId: 'guest-order-valid', tokenHash: 'synthetic-hash-valid', expiresAt: '2030-01-16T00:00:00.000Z', revoked: false },
    { orderId: 'guest-order-expired', tokenHash: 'synthetic-hash-expired', expiresAt: '2000-01-01T00:00:00.000Z', revoked: false },
    { orderId: 'guest-order-revoked', tokenHash: 'synthetic-hash-revoked', expiresAt: '2030-01-16T00:00:00.000Z', revoked: true },
  ]),
  idempotency: Object.freeze([
    { key: 'synthetic-checkout-key-001', fingerprint: 'cart-a-v1', result: 'quote-created' },
  ]),
});

export function validateStagingSeed(seed = stagingSeed) {
  const errors = [];
  const unique = (items, key, label) => {
    const values = items.map((item) => item[key]);
    if (new Set(values).size !== values.length) errors.push(label + ' contains duplicate ' + key);
  };
  if (seed.environment !== 'synthetic-staging') errors.push('environment must be synthetic-staging');
  unique(seed.users, 'id', 'users');
  unique(seed.products, 'id', 'products');
  unique(seed.flavors, 'id', 'flavors');
  unique(seed.schedules, 'id', 'schedules');
  unique(seed.orders, 'id', 'orders');
  if (seed.users.some((user) => !user.email.endsWith('.test'))) errors.push('all fixture emails must use .test');
  if (seed.orders.some((order) => !seed.users.some((user) => user.id === order.ownerId))) errors.push('order owner must exist');
  if (seed.schedules.some((schedule) => schedule.type === 'stall' && Object.hasOwn(schedule, 'publicPrice'))) errors.push('stall schedule must not expose publicPrice');
  if (seed.schedules.some((schedule) => schedule.type === 'food_truck' && typeof schedule.publicPrice !== 'number')) errors.push('food truck schedule requires a public price');
  if (seed.guestClaims.some((claim) => !claim.tokenHash || claim.tokenHash.includes('token'))) errors.push('guest claims must store a hash-like fixture only');
  return { valid: errors.length === 0, errors };
}

export function toPublicSchedule(schedule) {
  if (schedule.type === 'stall') {
    const { internalPrice, ...publicFields } = schedule;
    return publicFields;
  }
  const { internalPrice, ...publicFields } = schedule;
  return publicFields;
}
