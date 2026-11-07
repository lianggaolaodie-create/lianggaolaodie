'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CONTENT_BLOCKS,
  HOME_CARDS,
  PRIMARY_TABS,
  ROUTES,
  buildHomePresentation,
  getRoute,
  resolveNavigation
} = require('./customer-navigation');

test('primary navigation contains the customer app destinations in order', () => {
  assert.deepEqual(PRIMARY_TABS, ['home', 'lianggao', 'radish', 'truckSchedules', 'member']);
  assert.ok(PRIMARY_TABS.every(id => ROUTES[id] && ROUTES[id].visible));
});

test('all home cards target a registered visible route', () => {
  assert.ok(HOME_CARDS.length >= 5);
  for (const card of HOME_CARDS) {
    assert.ok(ROUTES[card.route]);
    assert.equal(ROUTES[card.route].visible, true);
  }
});

test('route resolution returns title for known route and safe home fallback for unknown route', () => {
  assert.deepEqual(resolveNavigation('truckSchedules'), {
    ok: true, route: 'truckSchedules', title: '餐車行程'
  });
  assert.deepEqual(resolveNavigation('employeePda'), {
    ok: false, route: 'home', reason: 'UNKNOWN_ROUTE'
  });
  assert.equal(getRoute('not-a-route'), null);
});

test('home presentation maps banner, announcement and service rules from published sections', () => {
  const model = buildHomePresentation({
    homeState: {
      status: 'success',
      data: [
        { key: 'home_banner', title: '一口涼糕，記住老爹', content: '新鮮製作', imageUrl: null },
        { key: 'announcement', title: '最新公告', content: '本週出攤資訊' },
        { key: 'service_rules', title: '訂購說明', content: '請提前預訂' }
      ]
    },
    catalogState: { status: 'success', data: [{ id: 'p1' }, { id: 'p2' }] },
    truckState: { status: 'success', data: [{ id: 't1' }] },
    stallState: { status: 'empty', data: [] }
  });
  assert.equal(model.banner.title, '一口涼糕，記住老爹');
  assert.equal(model.announcement.title, '最新公告');
  assert.equal(model.serviceRules.title, '訂購說明');
  assert.equal(model.productSummary.count, 2);
  assert.equal(model.scheduleSummary.truckCount, 1);
  assert.equal(model.scheduleSummary.stallCount, 0);
});

test('home presentation handles absent content without inventing sections', () => {
  const model = buildHomePresentation();
  assert.equal(model.banner, null);
  assert.equal(model.announcement, null);
  assert.equal(model.serviceRules, null);
  assert.equal(model.productSummary.status, 'idle');
  assert.equal(model.cards.length, HOME_CARDS.length);
});

test('loading, empty and error states have explicit safe messages', () => {
  const model = buildHomePresentation({
    homeState: { status: 'loading' },
    catalogState: { status: 'empty', data: [] },
    truckState: { status: 'error', error: { message: '網路連線失敗' } },
    stallState: { status: 'refreshing' }
  });
  assert.equal(model.messages.home, '資料載入中…');
  assert.equal(model.messages.catalog, '目前沒有可顯示的資料');
  assert.equal(model.messages.truck, '網路連線失敗');
  assert.equal(model.messages.stall, '正在更新資料…');
});

test('content block definitions are optional and tied to published API keys', () => {
  assert.deepEqual(CONTENT_BLOCKS.map(block => block.source), [
    'home_banner', 'announcement', 'service_rules'
  ]);
  assert.ok(CONTENT_BLOCKS.every(block => block.optional === true));
});

test('navigation metadata is declarative and does not include employee PDA routes', () => {
  assert.equal(ROUTES.employeePda, undefined);
  assert.equal(ROUTES.employeePicking, undefined);
  assert.equal(ROUTES.orders.title, '訂單查詢');
  assert.equal(ROUTES.member.title, '會員中心');
});
