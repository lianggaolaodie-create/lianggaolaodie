/**
 * Phase 35 public read API reference implementation.
 * Pure Node.js module; no network, database, secrets, or external dependencies.
 * This is a mock adapter prototype, NOT a deployed HTTP API.
 */

'use strict';

const PUBLIC_CONTENT_SECTIONS = new Set([
  'home_banner',
  'announcement',
  'service_rules',
  'about',
  'radish',
  'radish_products'
]);

class ApiError extends Error {
  constructor(status, code, message, fieldErrors = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.field_errors = fieldErrors;
  }
}

function assertArray(value, field) {
  if (!Array.isArray(value)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} 必須是陣列。`, [{ field, reason: 'must_be_array' }]);
  }
}

function cleanText(value, max = 500) {
  if (value == null) return '';
  return String(value).trim().slice(0, max);
}

function integerAmount(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

function mapCatalog({ flavors = [], radishProducts = [] } = {}) {
  assertArray(flavors, 'flavors');
  assertArray(radishProducts, 'radish_products');

  const items = [];
  for (const flavor of flavors) {
    if (!flavor || flavor.enabled !== true) continue;
    const price = integerAmount(flavor.price);
    items.push({
      product_id: cleanText(flavor.product_id || flavor.id, 100),
      name: cleanText(flavor.name, 120),
      category: 'lianggao',
      price,
      currency: 'TWD',
      available: flavor.available !== false && price !== null
    });
  }

  for (const product of radishProducts) {
    if (!product || product.enabled === false) continue;
    const price = integerAmount(product.price);
    items.push({
      product_id: cleanText(product.id, 100),
      name: cleanText(product.name, 120),
      category: 'radish_cake',
      description: cleanText(product.description, 1000),
      spec: cleanText(product.spec, 200),
      image_url: cleanText(product.image_url, 2000),
      price,
      currency: 'TWD',
      available: product.online_enabled === true && price !== null
    });
  }

  return items.filter(x => x.product_id && x.name);
}

function mapPublicContent(sections = {}) {
  if (!sections || typeof sections !== 'object' || Array.isArray(sections)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'sections 必須是物件。');
  }
  const output = {};
  for (const [key, value] of Object.entries(sections)) {
    if (!PUBLIC_CONTENT_SECTIONS.has(key)) continue;
    if (value == null || typeof value !== 'object' || Array.isArray(value)) continue;
    if (value.published !== true) continue;
    output[key] = {
      title: cleanText(value.title, 200),
      content: cleanText(value.content, 5000),
      image_url: cleanText(value.image_url, 2000),
      published: value.published === true
    };
  }
  return output;
}

function mapSchedule(schedule, links = [], flavors = []) {
  if (!schedule || schedule.enabled !== true) return null;
  const type = schedule.schedule_type;
  if (type !== 'food_truck' && type !== 'stall') return null;

  const flavorById = new Map(flavors.map(f => [String(f.id), f]));
  const scheduleLinks = links.filter(link => String(link.schedule_id) === String(schedule.id));
  const items = scheduleLinks.map(link => {
    const flavor = flavorById.get(String(link.flavor_id));
    if (!flavor || flavor.enabled !== true) return null;
    const item = {
      flavor_id: cleanText(flavor.id, 100),
      name: cleanText(flavor.name, 120)
    };
    if (type === 'food_truck') {
      const rawPrice = link.price_per_box ?? link.price ?? link.unit_price ?? flavor.price;
      const price = integerAmount(rawPrice);
      if (price !== null) {
        item.price = price;
        item.currency = 'TWD';
      }
    }
    return item;
  }).filter(Boolean);

  return {
    schedule_id: cleanText(schedule.id, 100),
    type,
    service_date: cleanText(schedule.schedule_date, 20),
    title: cleanText(schedule.title, 160),
    region: cleanText(schedule.region, 120),
    start_time: cleanText(schedule.start_time, 20),
    end_time: cleanText(schedule.end_time, 20),
    flavors: items
  };
}

function encodeCursor(offset) {
  return Buffer.from(JSON.stringify({ offset }), 'utf8').toString('base64url');
}

function decodeCursor(cursor) {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8'));
    if (!Number.isSafeInteger(parsed.offset) || parsed.offset < 0) throw new Error('bad offset');
    return parsed.offset;
  } catch {
    throw new ApiError(400, 'VALIDATION_ERROR', '分頁游標無效。', [{ field: 'cursor', reason: 'invalid_cursor' }]);
  }
}

function paginate(items, { cursor = null, limit = 20 } = {}) {
  assertArray(items, 'items');
  const n = Number(limit);
  if (!Number.isInteger(n) || n < 1 || n > 100) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'limit 必須介於 1 到 100。', [{ field: 'limit', reason: 'out_of_range' }]);
  }
  const offset = decodeCursor(cursor);
  const page = items.slice(offset, offset + n);
  const nextOffset = offset + page.length;
  return {
    items: page,
    next_cursor: nextOffset < items.length ? encodeCursor(nextOffset) : null
  };
}

function buildPublicReadApi(fixtures = {}) {
  const catalog = mapCatalog(fixtures);
  const content = mapPublicContent(fixtures.content || {});
  const schedules = (fixtures.schedules || [])
    .map(s => mapSchedule(s, fixtures.scheduleFlavors || [], fixtures.flavors || []))
    .filter(Boolean)
    .sort((a, b) => a.service_date.localeCompare(b.service_date));

  return {
    getCatalog(options = {}) {
      return paginate(catalog, options);
    },
    getContent() {
      return content;
    },
    getSchedules({ type, cursor = null, limit = 20 } = {}) {
      const selected = type ? schedules.filter(s => s.type === type) : schedules;
      if (type && type !== 'food_truck' && type !== 'stall') {
        throw new ApiError(400, 'VALIDATION_ERROR', 'type 僅接受 food_truck 或 stall。', [{ field: 'type', reason: 'invalid_enum' }]);
      }
      return paginate(selected, { cursor, limit });
    }
  };
}

module.exports = {
  ApiError,
  PUBLIC_CONTENT_SECTIONS,
  buildPublicReadApi,
  decodeCursor,
  encodeCursor,
  mapCatalog,
  mapPublicContent,
  mapSchedule,
  paginate
};
