/**
 * Phase 44 customer product catalog screen models.
 * Pure presentation/filtering helpers; no cart mutation or production data.
 */
'use strict';

const CATEGORIES = Object.freeze({
  lianggao: Object.freeze({ id: 'lianggao', title: '涼糕專區', productCategory: 'lianggao' }),
  radish: Object.freeze({ id: 'radish', title: '蘿蔔糕專區', productCategory: 'radish_cake' })
});

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeCategory(category) {
  return Object.prototype.hasOwnProperty.call(CATEGORIES, category) ? category : null;
}

function matchesSearch(product, query) {
  const needle = normalizeText(query).toLocaleLowerCase('zh-TW');
  if (!needle) return true;
  const haystack = [product.name, product.description, product.spec, product.category]
    .map(value => normalizeText(value).toLocaleLowerCase('zh-TW'))
    .join(' ');
  return haystack.includes(needle);
}

function hasConfirmedPrice(product) {
  return typeof product.priceLabel === 'string' &&
    product.priceLabel.trim() !== '' &&
    product.priceLabel !== '價格待確認';
}

function buildProductCard(product = {}) {
  const available = product.available === true && hasConfirmedPrice(product);
  return Object.freeze({
    id: normalizeText(product.id) || 'unknown',
    name: normalizeText(product.name) || '商品名稱待更新',
    category: normalizeText(product.category) || '商品',
    description: normalizeText(product.description),
    spec: normalizeText(product.spec),
    imageUrl: typeof product.imageUrl === 'string' ? product.imageUrl : null,
    imageFallbackLabel: normalizeText(product.imageFallbackLabel) || '商品圖片準備中',
    priceLabel: hasConfirmedPrice(product) ? product.priceLabel : '價格待確認',
    available,
    availabilityLabel: available ? '可訂購' : '暫不可訂購',
    addToCartEnabled: available
  });
}

function buildProductDetail(product = {}) {
  const card = buildProductCard(product);
  return Object.freeze({
    ...card,
    detailFields: Object.freeze([
      Object.freeze({ key: 'description', label: '商品介紹', value: card.description || '商品介紹待更新' }),
      Object.freeze({ key: 'spec', label: '規格', value: card.spec || '規格待確認' }),
      Object.freeze({ key: 'price', label: '價格', value: card.priceLabel }),
      Object.freeze({ key: 'availability', label: '販售狀態', value: card.availabilityLabel })
    ]),
    addToCartEnabled: card.available
  });
}

function buildCatalogScreen({ category, products = [], query = '' } = {}) {
  const selected = normalizeCategory(category);
  if (!selected) {
    return Object.freeze({
      ok: false, category: null, title: '商品專區', query: normalizeText(query),
      products: Object.freeze([]), count: 0, emptyMessage: '目前沒有這個商品專區。'
    });
  }
  const filtered = Array.isArray(products)
    ? products.filter(item => item && item.category === CATEGORIES[selected].productCategory)
      .filter(item => matchesSearch(item, query))
      .map(buildProductCard)
    : [];
  return Object.freeze({
    ok: true,
    category: selected,
    title: CATEGORIES[selected].title,
    query: normalizeText(query),
    products: Object.freeze(filtered),
    count: filtered.length,
    emptyMessage: filtered.length ? '' : (normalizeText(query) ? '找不到符合的商品。' : '目前沒有上架商品。')
  });
}

function resolveProductAction(product, action) {
  const card = buildProductCard(product);
  if (action === 'detail') return Object.freeze({ enabled: card.id !== 'unknown', route: 'productDetail', productId: card.id });
  if (action === 'cart') {
    return card.addToCartEnabled
      ? Object.freeze({ enabled: true, route: 'cart', productId: card.id })
      : Object.freeze({ enabled: false, route: null, productId: card.id, reason: 'PRODUCT_NOT_ORDERABLE' });
  }
  return Object.freeze({ enabled: false, route: null, productId: card.id, reason: 'UNKNOWN_ACTION' });
}

module.exports = {
  CATEGORIES,
  buildCatalogScreen,
  buildProductCard,
  buildProductDetail,
  hasConfirmedPrice,
  matchesSearch,
  resolveProductAction
};
