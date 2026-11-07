/**
 * Phase 40 public view models for customer-facing App/website screens.
 * Converts API DTOs into display-safe data; never computes authoritative prices.
 */
'use strict';

function text(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function safeImageUrl(value) {
  const candidate = text(value);
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? candidate : null;
  } catch {
    return null;
  }
}

function moneyLabel(amount, currency = 'TWD') {
  if (!Number.isSafeInteger(amount) || amount < 0) return '價格待確認';
  if (currency !== 'TWD') return '價格待確認';
  return `NT$ ${amount.toLocaleString('zh-TW')}`;
}

function mapCatalogItemToViewModel(item = {}) {
  const category = item.category === 'radish_cake' ? '蘿蔔糕' : item.category === 'lianggao' ? '涼糕' : '商品';
  const available = item.available === true && Number.isSafeInteger(item.price) && item.price >= 0;
  return {
    id: text(item.product_id, 'unknown'),
    name: text(item.name, '商品名稱待更新'),
    category,
    description: text(item.description),
    spec: text(item.spec),
    imageUrl: safeImageUrl(item.image_url),
    imageFallbackLabel: '商品圖片準備中',
    priceLabel: moneyLabel(item.price, item.currency),
    available,
    availabilityLabel: available ? '可訂購' : '暫不可訂購'
  };
}

function mapCatalogToViewModels(items = []) {
  if (!Array.isArray(items)) return [];
  return items.map(mapCatalogItemToViewModel);
}

function mapContentSectionToViewModel(key, section = {}) {
  return {
    key: text(key, 'content'),
    title: text(section.title, '公告'),
    content: text(section.content),
    imageUrl: safeImageUrl(section.image_url)
  };
}

function mapContentToViewModels(content = {}) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return [];
  return Object.entries(content)
    .filter(([, section]) => section && section.published === true)
    .map(([key, section]) => mapContentSectionToViewModel(key, section));
}

function normalizeDate(value) {
  const candidate = text(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : '日期待公布';
}

function normalizeTime(value) {
  const candidate = text(value);
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(candidate) ? candidate : '';
}

function mapScheduleFlavorToViewModel(flavor = {}, scheduleType) {
  const result = {
    id: text(flavor.flavor_id, 'unknown'),
    name: text(flavor.name, '口味待公布')
  };
  if (scheduleType === 'food_truck' && Number.isSafeInteger(flavor.price) && flavor.price >= 0 && (flavor.currency === 'TWD' || flavor.currency === undefined)) {
    result.priceLabel = moneyLabel(flavor.price, flavor.currency || 'TWD');
  }
  return result;
}

function mapScheduleToViewModel(schedule = {}) {
  const isTruck = schedule.type === 'food_truck';
  const type = isTruck ? 'food_truck' : schedule.type === 'stall' ? 'stall' : 'unknown';
  const startTime = normalizeTime(schedule.start_time);
  const endTime = normalizeTime(schedule.end_time);
  const timeLabel = startTime && endTime ? `${startTime}–${endTime}` : startTime || endTime || '時間待公布';
  const flavors = Array.isArray(schedule.flavors)
    ? schedule.flavors.map(flavor => mapScheduleFlavorToViewModel(flavor, type))
    : [];

  return {
    id: text(schedule.schedule_id, 'unknown'),
    type,
    typeLabel: isTruck ? '餐車' : type === 'stall' ? '擺攤' : '行程',
    date: normalizeDate(schedule.service_date),
    title: text(schedule.title, isTruck ? '餐車行程' : '出攤行程'),
    region: text(schedule.region, '地區待公布'),
    timeLabel,
    flavors
  };
}

function mapSchedulesToViewModels(items = [], expectedType = null) {
  if (!Array.isArray(items)) return [];
  return items
    .filter(item => item && (item.type === 'food_truck' || item.type === 'stall'))
    .filter(item => !expectedType || item.type === expectedType)
    .map(mapScheduleToViewModel);
}

module.exports = {
  mapCatalogItemToViewModel,
  mapCatalogToViewModels,
  mapContentSectionToViewModel,
  mapContentToViewModels,
  mapScheduleFlavorToViewModel,
  mapScheduleToViewModel,
  mapSchedulesToViewModels,
  moneyLabel,
  safeImageUrl
};
