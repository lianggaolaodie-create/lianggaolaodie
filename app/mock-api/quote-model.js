/**
 * Phase 47 server-authoritative quote contract reference model.
 * Pure Node reference only; caller must supply server-trusted catalog and rate snapshots.
 * Never accepts client-supplied prices, fees, totals, or quote validity as authority.
 */
'use strict';

const { createHash } = require('node:crypto');

const CURRENCY = 'TWD';
const MAX_QUANTITY = 99;
const ALLOWED_METHODS = Object.freeze({
  lianggao: Object.freeze(['lianggao_home_delivery', 'lianggao_store_cooling_pickup']),
  radish_cake: Object.freeze(['radish_frozen_store_to_store', 'radish_frozen_home_delivery'])
});

function integerAmount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function normalizeCart(cart) {
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    return { ok: false, reason: 'CART_EMPTY' };
  }
  const items = [];
  for (const item of cart.items) {
    if (!item || typeof item.productId !== 'string' || !item.productId.trim() ||
        !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY) {
      return { ok: false, reason: 'INVALID_CART_ITEM' };
    }
    items.push({
      productId: item.productId.trim(),
      variantId: typeof item.variantId === 'string' ? item.variantId.trim() : '',
      quantity: item.quantity
    });
  }
  items.sort((a, b) => a.productId.localeCompare(b.productId) || a.variantId.localeCompare(b.variantId));
  return { ok: true, items };
}

function recipientFingerprint(recipient) {
  if (!recipient || typeof recipient !== 'object' || Array.isArray(recipient)) return null;
  const keys = ['name', 'phone', 'address', 'storeProvider', 'storeName', 'storeAddress'];
  const normalized = {};
  for (const key of keys) {
    const value = recipient[key] === undefined ? '' : recipient[key];
    if (typeof value !== 'string') return null;
    normalized[key] = value.trim().replace(/\\s+/g, ' ');
  }
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

function fingerprint(items, fulfillmentMethod) {
  const canonical = JSON.stringify({ currency: CURRENCY, fulfillmentMethod, items });
  return createHash('sha256').update(canonical).digest('hex');
}

function fail(reason, fields = []) {
  return Object.freeze({ ok: false, reason, fields: Object.freeze(fields) });
}

function issueQuote({ cart, fulfillmentMethod, recipient = {}, trustedCatalog, trustedRates,
  quoteId, quoteVersion = 1, issuedAt, expiresAt } = {}) {
  const normalized = normalizeCart(cart);
  if (!normalized.ok) return fail(normalized.reason);
  if (typeof fulfillmentMethod !== 'string') return fail('FULFILLMENT_METHOD_REQUIRED');

  const categories = new Set();
  const resolved = [];
  for (const item of normalized.items) {
    const product = trustedCatalog && trustedCatalog[item.productId];
    if (!product || product.enabled !== true || product.onlineEnabled !== true) return fail('PRODUCT_NOT_ORDERABLE');
    if (product.category !== 'lianggao' && product.category !== 'radish_cake') return fail('PRODUCT_CATEGORY_INVALID');
    categories.add(product.category);
    if (!integerAmount(product.unitPriceMinor) || product.unitPriceMinor <= 0) return fail('SERVER_PRICE_INVALID');
    resolved.push({ ...item, product });
  }
  if (categories.size !== 1) return fail('MIXED_TEMPERATURE_FULFILLMENT');
  const category = [...categories][0];
  if (!ALLOWED_METHODS[category].includes(fulfillmentMethod)) return fail('FULFILLMENT_METHOD_NOT_ALLOWED');

  const rate = trustedRates && trustedRates[fulfillmentMethod];
  if (!rate || rate.enabled !== true || !integerAmount(rate.feeMinor)) return fail('SERVER_SHIPPING_RATE_UNAVAILABLE');
  if (typeof quoteId !== 'string' || !quoteId.trim()) return fail('QUOTE_ID_REQUIRED');
  if (!Number.isSafeInteger(quoteVersion) || quoteVersion < 1) return fail('QUOTE_VERSION_INVALID');
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt <= issuedAt) return fail('QUOTE_EXPIRY_INVALID');

  const fields = [];
  if (typeof recipient.name !== 'string' || !recipient.name.trim()) fields.push('recipient.name');
  if (typeof recipient.phone !== 'string' || !recipient.phone.trim()) fields.push('recipient.phone');
  if (fulfillmentMethod.endsWith('home_delivery')) {
    if (typeof recipient.address !== 'string' || !recipient.address.trim()) fields.push('recipient.address');
  } else {
    if (typeof recipient.storeProvider !== 'string' || !recipient.storeProvider.trim()) fields.push('recipient.storeProvider');
    if (typeof recipient.storeName !== 'string' || !recipient.storeName.trim()) fields.push('recipient.storeName');
    if (typeof recipient.storeAddress !== 'string' || !recipient.storeAddress.trim()) fields.push('recipient.storeAddress');
  }
  if (fields.length) return fail('RECIPIENT_DETAILS_INVALID', fields);

  const lines = resolved.map(({ product, productId, variantId, quantity }) => Object.freeze({
    productId,
    variantId,
    name: typeof product.name === 'string' ? product.name : '商品名稱待更新',
    unitPriceMinor: product.unitPriceMinor,
    quantity,
    lineTotalMinor: product.unitPriceMinor * quantity
  }));
  if (lines.some(line => !Number.isSafeInteger(line.lineTotalMinor))) return fail('QUOTE_AMOUNT_OVERFLOW');
  const subtotalMinor = lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
  const totalMinor = subtotalMinor + rate.feeMinor;
  if (!Number.isSafeInteger(subtotalMinor) || !Number.isSafeInteger(totalMinor)) return fail('QUOTE_AMOUNT_OVERFLOW');

  const itemFingerprint = fingerprint(normalized.items, fulfillmentMethod);
  return Object.freeze({
    ok: true,
    quote: Object.freeze({
      quoteId: quoteId.trim(),
      quoteVersion,
      currency: CURRENCY,
      fulfillmentMethod,
      temperature: category === 'lianggao' ? 'chilled' : 'frozen',
      items: Object.freeze(lines),
      subtotalMinor,
      shippingFeeMinor: rate.feeMinor,
      totalMinor,
      issuedAt,
      expiresAt,
      cartFingerprint: itemFingerprint,
      pricingSource: 'server-trusted-snapshot',
      orderCreationEnabled: false
    })
  });
}

function validateQuoteForCheckout({ quote, cart, fulfillmentMethod, serverNow } = {}) {
  if (!quote || typeof quote.quoteId !== 'string' || !quote.quoteId ||
      !Number.isSafeInteger(quote.totalMinor) || quote.totalMinor < 0 ||
      !Number.isSafeInteger(quote.shippingFeeMinor) || quote.shippingFeeMinor < 0 ||
      !Number.isFinite(quote.expiresAt) || !Number.isFinite(serverNow)) {
    return fail('QUOTE_INVALID');
  }
  if (serverNow >= quote.expiresAt) return fail('QUOTE_EXPIRED');
  const normalized = normalizeCart(cart);
  if (!normalized.ok) return fail(normalized.reason);
  if (quote.fulfillmentMethod !== fulfillmentMethod) return fail('QUOTE_METHOD_MISMATCH');
  if (quote.cartFingerprint !== fingerprint(normalized.items, fulfillmentMethod)) return fail('QUOTE_CART_MISMATCH');
  return Object.freeze({ ok: true, quoteId: quote.quoteId, totalMinor: quote.totalMinor, currency: quote.currency, orderCreationEnabled: false });
}

module.exports = { CURRENCY, fingerprint, issueQuote, normalizeCart, recipientFingerprint, validateQuoteForCheckout };
