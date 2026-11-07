/**
 * Phase 45 local cart model.
 * Immutable in-memory state only; no persistence, checkout, pricing arithmetic or order writes.
 */
'use strict';

const MAX_QUANTITY = 99;

function confirmedPrice(product) {
  return typeof product.priceLabel === 'string' &&
    product.priceLabel.trim() !== '' &&
    product.priceLabel !== '價格待確認';
}

function validProduct(product) {
  return Boolean(product && typeof product.id === 'string' && product.id.trim()) &&
    product.available === true && confirmedPrice(product);
}

function lineKey(productId, variantId = '') {
  return productId + '::' + variantId;
}

function createCart(items = []) {
  return Object.freeze({
    items: Object.freeze(Array.isArray(items) ? items.map(item => Object.freeze({ ...item })) : [])
  });
}

function addCartItem(cart, product, quantity = 1, variantId = '') {
  const current = cart && Array.isArray(cart.items) ? cart : createCart();
  if (!validProduct(product)) {
    return Object.freeze({ ok: false, reason: 'PRODUCT_NOT_ORDERABLE', cart: current });
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    return Object.freeze({ ok: false, reason: 'INVALID_QUANTITY', cart: current });
  }

  const id = product.id.trim();
  const variant = typeof variantId === 'string' ? variantId.trim() : '';
  const key = lineKey(id, variant);
  const index = current.items.findIndex(item => lineKey(item.productId, item.variantId) === key);
  const items = current.items.map(item => ({ ...item }));

  if (index >= 0) {
    const nextQuantity = items[index].quantity + quantity;
    if (nextQuantity > MAX_QUANTITY) {
      return Object.freeze({ ok: false, reason: 'QUANTITY_LIMIT_EXCEEDED', cart: current });
    }
    items[index] = { ...items[index], quantity: nextQuantity };
  } else {
    items.push({
      productId: id,
      categorySnapshot: product.category === 'lianggao' || product.category === 'radish_cake' ? product.category : 'unknown',
      variantId: variant,
      nameSnapshot: typeof product.name === 'string' && product.name.trim() ? product.name.trim() : '商品名稱待更新',
      specSnapshot: typeof product.spec === 'string' ? product.spec.trim() : '',
      priceSnapshotLabel: product.priceLabel,
      quantity
    });
  }
  return Object.freeze({ ok: true, reason: null, cart: createCart(items) });
}

function removeCartItem(cart, productId, variantId = '') {
  const current = cart && Array.isArray(cart.items) ? cart : createCart();
  const key = lineKey(productId, variantId);
  return createCart(current.items.filter(item => lineKey(item.productId, item.variantId) !== key));
}

function setCartItemQuantity(cart, productId, quantity, variantId = '') {
  const current = cart && Array.isArray(cart.items) ? cart : createCart();
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_QUANTITY) {
    return Object.freeze({ ok: false, reason: 'INVALID_QUANTITY', cart: current });
  }
  if (quantity === 0) {
    return Object.freeze({ ok: true, reason: null, cart: removeCartItem(current, productId, variantId) });
  }
  const key = lineKey(productId, variantId);
  const index = current.items.findIndex(item => lineKey(item.productId, item.variantId) === key);
  if (index < 0) return Object.freeze({ ok: false, reason: 'CART_ITEM_NOT_FOUND', cart: current });
  const items = current.items.map((item, i) => i === index ? { ...item, quantity } : { ...item });
  return Object.freeze({ ok: true, reason: null, cart: createCart(items) });
}

function buildCartView(cart) {
  const items = cart && Array.isArray(cart.items) ? cart.items : [];
  return Object.freeze({
    items: Object.freeze(items.map(item => Object.freeze({
      productId: item.productId,
      category: item.categorySnapshot || 'unknown',
      variantId: item.variantId,
      name: item.nameSnapshot,
      spec: item.specSnapshot,
      priceLabel: item.priceSnapshotLabel,
      quantity: item.quantity
    }))),
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    distinctItemCount: items.length,
    totalLabel: '結帳時以伺服器確認價格與金額',
    checkoutEnabled: false
  });
}

module.exports = {
  MAX_QUANTITY,
  addCartItem,
  buildCartView,
  createCart,
  removeCartItem,
  setCartItemQuantity
};
