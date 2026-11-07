/**
 * Phase 46 fulfillment selection and checkout-input validation.
 * No shipping fee calculation, quote issuance, payment, or order creation.
 */
'use strict';

const METHODS = Object.freeze({
  lianggao: Object.freeze([
    Object.freeze({ id: 'lianggao_home_delivery', label: '涼糕送到府', temperature: 'chilled', addressRequired: true, storeRequired: false }),
    Object.freeze({ id: 'lianggao_store_cooling_pickup', label: '超商冷藏寄放', temperature: 'chilled', addressRequired: false, storeRequired: true })
  ]),
  radish_cake: Object.freeze([
    Object.freeze({ id: 'radish_frozen_store_to_store', label: '冷凍店到店', temperature: 'frozen', addressRequired: false, storeRequired: true }),
    Object.freeze({ id: 'radish_frozen_home_delivery', label: '冷凍宅配', temperature: 'frozen', addressRequired: true, storeRequired: false })
  ])
});

function categoriesInCart(cart) {
  const items = cart && Array.isArray(cart.items) ? cart.items : [];
  return [...new Set(items.map(item => item.category).filter(category => category === 'lianggao' || category === 'radish_cake'))];
}

function buildFulfillmentOptions(cart) {
  const categories = categoriesInCart(cart);
  if (!categories.length) {
    return Object.freeze({ ok: false, reason: 'CART_EMPTY_OR_CATEGORY_UNKNOWN', options: Object.freeze([]), requiresSeparateOrders: false });
  }
  if (categories.length > 1) {
    return Object.freeze({ ok: false, reason: 'MIXED_TEMPERATURE_FULFILLMENT', options: Object.freeze([]), requiresSeparateOrders: true,
      message: '涼糕與蘿蔔糕配送溫層不同，請分開結帳。' });
  }
  const category = categories[0];
  return Object.freeze({
    ok: true,
    category,
    options: METHODS[category],
    requiresSeparateOrders: false,
    note: category === 'lianggao'
      ? '超商方式為冷藏寄放，不是冷藏宅配。'
      : '蘿蔔糕配送需維持冷凍溫層。'
  });
}

function validateFulfillmentSelection(cart, methodId, details = {}) {
  const result = buildFulfillmentOptions(cart);
  if (!result.ok) return Object.freeze({ ok: false, reason: result.reason, fields: Object.freeze([]) });
  const method = result.options.find(option => option.id === methodId);
  if (!method) return Object.freeze({ ok: false, reason: 'FULFILLMENT_METHOD_NOT_ALLOWED', fields: Object.freeze([]) });

  const fields = [];
  if (method.addressRequired) {
    if (typeof details.recipientName !== 'string' || !details.recipientName.trim()) fields.push('recipientName');
    if (typeof details.phone !== 'string' || !details.phone.trim()) fields.push('phone');
    if (typeof details.address !== 'string' || !details.address.trim()) fields.push('address');
  }
  if (method.storeRequired) {
    if (typeof details.recipientName !== 'string' || !details.recipientName.trim()) fields.push('recipientName');
    if (typeof details.phone !== 'string' || !details.phone.trim()) fields.push('phone');
    if (typeof details.storeProvider !== 'string' || !details.storeProvider.trim()) fields.push('storeProvider');
    if (typeof details.storeName !== 'string' || !details.storeName.trim()) fields.push('storeName');
    if (typeof details.storeAddress !== 'string' || !details.storeAddress.trim()) fields.push('storeAddress');
  }
  return Object.freeze({
    ok: fields.length === 0,
    reason: fields.length ? 'REQUIRED_FIELDS_MISSING' : null,
    methodId,
    temperature: method.temperature,
    fields: Object.freeze(fields),
    shippingFee: null,
    payableTotal: null,
    quoteRequired: true,
    orderCreationEnabled: false
  });
}

function buildCheckoutDraft(cart, methodId, details = {}) {
  const validation = validateFulfillmentSelection(cart, methodId, details);
  if (!validation.ok) return Object.freeze({ ok: false, validation });
  return Object.freeze({
    ok: true,
    fulfillmentMethod: methodId,
    temperature: validation.temperature,
    recipientName: details.recipientName.trim(),
    phone: details.phone.trim(),
    address: typeof details.address === 'string' ? details.address.trim() : null,
    store: validation.temperature === 'chilled' || validation.temperature === 'frozen'
      ? (details.storeName ? Object.freeze({
          provider: details.storeProvider.trim(),
          name: details.storeName.trim(),
          address: details.storeAddress.trim()
        }) : null)
      : null,
    shippingFee: null,
    payableTotal: null,
    quoteRequired: true,
    submitEnabled: false
  });
}

module.exports = {
  METHODS,
  buildCheckoutDraft,
  buildFulfillmentOptions,
  categoriesInCart,
  validateFulfillmentSelection
};
