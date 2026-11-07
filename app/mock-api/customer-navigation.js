/**
 * Phase 43 customer information architecture and navigation model.
 * Declarative route metadata only; no UI framework or production navigation runtime.
 */
'use strict';

const ROUTES = Object.freeze({
  home: Object.freeze({ id: 'home', title: '首頁', group: 'main', visible: true }),
  lianggao: Object.freeze({ id: 'lianggao', title: '涼糕專區', group: 'shop', visible: true }),
  radish: Object.freeze({ id: 'radish', title: '蘿蔔糕專區', group: 'shop', visible: true }),
  truckSchedules: Object.freeze({ id: 'truckSchedules', title: '餐車行程', group: 'schedule', visible: true }),
  stallSchedules: Object.freeze({ id: 'stallSchedules', title: '擺攤資訊', group: 'schedule', visible: true }),
  cart: Object.freeze({ id: 'cart', title: '購物車', group: 'account', visible: true }),
  orders: Object.freeze({ id: 'orders', title: '訂單查詢', group: 'account', visible: true }),
  member: Object.freeze({ id: 'member', title: '會員中心', group: 'account', visible: true }),
  support: Object.freeze({ id: 'support', title: '客服與聯絡', group: 'help', visible: true }),
  about: Object.freeze({ id: 'about', title: '品牌介紹', group: 'help', visible: true })
});

const PRIMARY_TABS = Object.freeze(['home', 'lianggao', 'radish', 'truckSchedules', 'member']);

const HOME_CARDS = Object.freeze([
  Object.freeze({ id: 'lianggao', title: '涼糕專區', description: '查看涼糕口味與商品', route: 'lianggao', icon: '🍡' }),
  Object.freeze({ id: 'radish', title: '蘿蔔糕專區', description: '查看冷凍蘿蔔糕商品', route: 'radish', icon: '🥢' }),
  Object.freeze({ id: 'truckSchedules', title: '餐車行程', description: '查看日期、地區與販售口味', route: 'truckSchedules', icon: '🚚' }),
  Object.freeze({ id: 'stallSchedules', title: '擺攤資訊', description: '查看出攤日期與當日口味', route: 'stallSchedules', icon: '🏪' }),
  Object.freeze({ id: 'orders', title: '訂單查詢', description: '查看訂單與處理進度', route: 'orders', icon: '📦' }),
  Object.freeze({ id: 'support', title: '客服與聯絡', description: '取得客服與品牌聯絡資訊', route: 'support', icon: '💬' })
]);

const CONTENT_BLOCKS = Object.freeze([
  Object.freeze({ id: 'hero', title: '品牌主視覺', source: 'home_banner', optional: true }),
  Object.freeze({ id: 'announcement', title: '最新公告', source: 'announcement', optional: true }),
  Object.freeze({ id: 'serviceRules', title: '服務說明', source: 'service_rules', optional: true })
]);

function getRoute(routeId) {
  return Object.prototype.hasOwnProperty.call(ROUTES, routeId) ? ROUTES[routeId] : null;
}

function resolveNavigation(routeId) {
  const route = getRoute(routeId);
  if (!route || !route.visible) {
    return Object.freeze({ ok: false, route: 'home', reason: 'UNKNOWN_ROUTE' });
  }
  return Object.freeze({ ok: true, route: route.id, title: route.title });
}

function buildHomePresentation({ homeState, catalogState, truckState, stallState } = {}) {
  const content = homeState || { status: 'idle', data: [], error: null };
  const catalog = catalogState || { status: 'idle', data: [], error: null };
  const truck = truckState || { status: 'idle', data: [], error: null };
  const stall = stallState || { status: 'idle', data: [], error: null };

  const sections = Array.isArray(content.data) ? content.data : [];
  const byKey = new Map(sections.map(section => [section.key, section]));
  const cards = HOME_CARDS.map(card => Object.freeze({ ...card }));
  const banner = byKey.get('home_banner') || null;
  const announcement = byKey.get('announcement') || null;
  const serviceRules = byKey.get('service_rules') || null;

  return Object.freeze({
    status: content.status,
    banner,
    announcement,
    serviceRules,
    productSummary: Object.freeze({
      status: catalog.status,
      count: Array.isArray(catalog.data) ? catalog.data.length : 0
    }),
    scheduleSummary: Object.freeze({
      truckStatus: truck.status,
      truckCount: Array.isArray(truck.data) ? truck.data.length : 0,
      stallStatus: stall.status,
      stallCount: Array.isArray(stall.data) ? stall.data.length : 0
    }),
    cards: Object.freeze(cards),
    messages: Object.freeze({
      home: safeMessage(content),
      catalog: safeMessage(catalog),
      truck: safeMessage(truck),
      stall: safeMessage(stall)
    })
  });
}

function safeMessage(state) {
  if (!state || typeof state !== 'object') return '';
  if (state.status === 'loading') return '資料載入中…';
  if (state.status === 'refreshing') return '正在更新資料…';
  if (state.status === 'empty') return '目前沒有可顯示的資料';
  if (state.status === 'error') {
    return state.error && typeof state.error.message === 'string'
      ? state.error.message
      : '資料載入失敗，請稍後再試。';
  }
  return '';
}

module.exports = {
  CONTENT_BLOCKS,
  HOME_CARDS,
  PRIMARY_TABS,
  ROUTES,
  buildHomePresentation,
  getRoute,
  resolveNavigation
};
