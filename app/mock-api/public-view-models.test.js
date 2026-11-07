'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  mapCatalogItemToViewModel,
  mapCatalogToViewModels,
  mapContentToViewModels,
  mapScheduleToViewModel,
  mapSchedulesToViewModels,
  moneyLabel,
  safeImageUrl
} = require('./public-view-models');

test('catalog view model maps product category, image, price and availability', () => {
  const item = mapCatalogItemToViewModel({
    product_id: 'p1', name: '水果綜合', category: 'lianggao',
    price: 100, currency: 'TWD', available: true,
    image_url: 'https://example.com/p1.jpg'
  });
  assert.equal(item.id, 'p1');
  assert.equal(item.category, '涼糕');
  assert.equal(item.priceLabel, 'NT$ 100');
  assert.equal(item.availabilityLabel, '可訂購');
  assert.equal(item.imageUrl, 'https://example.com/p1.jpg');
});

test('radish catalog maps description/spec and unavailable state safely', () => {
  const [item] = mapCatalogToViewModels([{
    product_id: 'r1', name: '純米蘿蔔糕', category: 'radish_cake',
    description: '冷凍商品', spec: '一份', price: null,
    currency: 'TWD', available: false, image_url: ''
  }]);
  assert.equal(item.category, '蘿蔔糕');
  assert.equal(item.spec, '一份');
  assert.equal(item.imageUrl, null);
  assert.equal(item.imageFallbackLabel, '商品圖片準備中');
  assert.equal(item.priceLabel, '價格待確認');
  assert.equal(item.availabilityLabel, '暫不可訂購');
});

test('unsafe image schemes and malformed URLs are not exposed', () => {
  assert.equal(safeImageUrl('javascript:alert(1)'), null);
  assert.equal(safeImageUrl('data:image/png;base64,abc'), null);
  assert.equal(safeImageUrl('not a url'), null);
  assert.equal(safeImageUrl('https://example.com/image.png'), 'https://example.com/image.png');
});

test('published content only is converted and missing text gets safe defaults', () => {
  const sections = mapContentToViewModels({
    home_banner: { title: '首頁', content: '歡迎', image_url: '', published: true },
    hidden: { title: '內部', content: '不可顯示', image_url: '', published: false }
  });
  assert.equal(sections.length, 1);
  assert.equal(sections[0].title, '首頁');
  assert.equal(sections[0].imageUrl, null);
});

test('schedule view model uses safe fallbacks for missing date, region and time', () => {
  const schedule = mapScheduleToViewModel({
    schedule_id: 's1', type: 'stall', service_date: 'not-a-date',
    title: '', region: '', start_time: 'bad', end_time: '',
    flavors: [{ flavor_id: 'f1', name: '黑糖', price: 100, currency: 'TWD' }]
  });
  assert.equal(schedule.typeLabel, '擺攤');
  assert.equal(schedule.date, '日期待公布');
  assert.equal(schedule.title, '出攤行程');
  assert.equal(schedule.region, '地區待公布');
  assert.equal(schedule.timeLabel, '時間待公布');
  assert.equal('priceLabel' in schedule.flavors[0], false);
});

test('food truck may display price while stall never gets price label', () => {
  const truck = mapScheduleToViewModel({
    schedule_id: 't1', type: 'food_truck', service_date: '2026-11-10',
    title: '老爹餐車', region: '台北', start_time: '10:00', end_time: '18:00',
    flavors: [{ flavor_id: 'f1', name: '水果綜合', price: 120, currency: 'TWD' }]
  });
  const stall = mapScheduleToViewModel({
    schedule_id: 's1', type: 'stall', service_date: '2026-11-11',
    title: '市場擺攤', region: '新北', start_time: '08:00', end_time: '12:00',
    flavors: [{ flavor_id: 'f1', name: '水果綜合', price: 120, currency: 'TWD' }]
  });
  assert.equal(truck.timeLabel, '10:00–18:00');
  assert.equal(truck.flavors[0].priceLabel, 'NT$ 120');
  assert.equal('priceLabel' in stall.flavors[0], false);
  assert.equal('price' in stall.flavors[0], false);
  assert.equal('currency' in stall.flavors[0], false);
});

test('schedule list filters unknown types and optional requested type', () => {
  const items = [
    { schedule_id: 't', type: 'food_truck' },
    { schedule_id: 's', type: 'stall' },
    { schedule_id: 'x', type: 'other' }
  ];
  assert.equal(mapSchedulesToViewModels(items).length, 2);
  assert.equal(mapSchedulesToViewModels(items, 'stall').length, 1);
});

test('money labels never invent a price or accept a foreign currency', () => {
  assert.equal(moneyLabel(null), '價格待確認');
  assert.equal(moneyLabel(-1), '價格待確認');
  assert.equal(moneyLabel(100, 'USD'), '價格待確認');
  assert.equal(moneyLabel(0), 'NT$ 0');
});
