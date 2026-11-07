/**
 * Phase 56 in-memory transactional mock services.
 * Synthetic fixtures only. No database, network, Supabase or production writes.
 */
'use strict';

const fail = (reason, fields = []) => Object.freeze({
  ok: false, reason, fields: Object.freeze(fields)
});
const isText = value => typeof value === 'string' && value.trim().length > 0;
const isMoney = value => Number.isSafeInteger(value) && value >= 0;
const clone = value => structuredClone(value);
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const canManage = actor => !!actor && isText(actor.id) &&
  ['owner', 'super_admin', 'product_admin'].includes(actor.role);

function createStore() {
  return {
    dailyOrders: new Map(),
    radishSections: new Map(),
    audit: [],
    idempotency: new Map()
  };
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function validClock(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
function validateDailyPayload(payload) {
  const fields = [];
  if (!payload || !validDate(payload.orderDate)) fields.push('orderDate');
  if (typeof payload?.orderingEnabled !== 'boolean') fields.push('orderingEnabled');
  if (!Array.isArray(payload?.regions)) fields.push('regions');
  if (!Array.isArray(payload?.items)) fields.push('items');
  const regions = Array.isArray(payload?.regions) ? payload.regions : [];
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const regionNames = new Set();
  for (const [i, region] of regions.entries()) {
    if (!isText(region?.regionName) || typeof region.enabled !== 'boolean') fields.push('regions.' + i);
    const key = String(region?.regionName || '').trim();
    if (key && regionNames.has(key)) fields.push('regions.' + i + '.duplicate');
    if (key) regionNames.add(key);
  }
  const flavorIds = new Set();
  for (const [i, item] of items.entries()) {
    if (!isText(item?.flavorId) || !isText(item?.productName) || !isText(item?.flavorName) ||
        !isMoney(item?.price) || typeof item?.enabled !== 'boolean' ||
        !(item?.quantity === null || Number.isSafeInteger(item?.quantity) && item.quantity >= 0)) {
      fields.push('items.' + i);
    }
    const key = String(item?.flavorId || '');
    if (key && flavorIds.has(key)) fields.push('items.' + i + '.duplicate');
    if (key) flavorIds.add(key);
  }
  return fields;
}

function saveDailyOrder({ store, actor, payload, expectedVersion, now, idempotencyKey, failAt } = {}) {
  if (!store || !(store.dailyOrders instanceof Map)) return fail('STORE_INVALID');
  if (!canManage(actor)) return fail('ADMIN_FORBIDDEN');
  if (!Number.isSafeInteger(now) || now < 0) return fail('TIME_INVALID');
  const fields = validateDailyPayload(payload);
  if (fields.length) return fail('DAILY_ORDER_INVALID', fields);
  const date = payload.orderDate;
  const current = store.dailyOrders.get(date);
  if (current && current.version !== expectedVersion) return fail('VERSION_CONFLICT');
  if (!current && expectedVersion !== undefined && expectedVersion !== 0) return fail('VERSION_CONFLICT');
  const idemKey = isText(idempotencyKey) ? idempotencyKey.trim() : null;
  if (idemKey && store.idempotency.has(idemKey)) {
    const prior = store.idempotency.get(idemKey);
    return prior.fingerprint === JSON.stringify(payload)
      ? Object.freeze({ ok: true, replayed: true, record: prior.result })
      : fail('IDEMPOTENCY_CONFLICT');
  }

  // Build the complete replacement off-store. Any injected failure leaves all maps unchanged.
  const staged = freeze({
    orderDate: date,
    orderingEnabled: payload.orderingEnabled,
    notes: isText(payload.notes) ? payload.notes.trim() : '',
    regions: clone(payload.regions).map(item => ({
      regionName: item.regionName.trim(), enabled: item.enabled
    })),
    items: clone(payload.items).map(item => ({
      flavorId: item.flavorId.trim(), productName: item.productName.trim(),
      flavorName: item.flavorName.trim(), price: item.price,
      enabled: item.enabled, quantity: item.quantity
    })),
    version: current ? current.version + 1 : 1,
    updatedAt: now
  });
  if (failAt === 'after_validation' || failAt === 'before_commit') return fail('TRANSACTION_ABORTED');
  store.dailyOrders.set(date, staged);
  const auditEntry = freeze({
    actorId: actor.id.trim(), action: current ? 'daily_order.updated' : 'daily_order.created',
    entityId: date, version: staged.version, at: now
  });
  store.audit.push(auditEntry);
  const result = freeze({ orderDate: date, version: staged.version,
    regionCount: staged.regions.length, itemCount: staged.items.length });
  if (idemKey) store.idempotency.set(idemKey, {
    fingerprint: JSON.stringify(payload), result
  });
  return Object.freeze({ ok: true, replayed: false, record: result });
}

function readDailyOrder(store, orderDate) {
  const record = store?.dailyOrders?.get(orderDate);
  return record ? clone(record) : null;
}

function seedRadishSection(store, sectionId, data, version = 1) {
  if (!store || !(store.radishSections instanceof Map) || !isText(sectionId) ||
      !Number.isSafeInteger(version) || version < 1) return fail('SEED_INVALID');
  store.radishSections.set(sectionId.trim(), freeze({
    sectionId: sectionId.trim(), data: clone(data), version
  }));
  return Object.freeze({ ok: true });
}

function validateRadishProducts(data) {
  const products = data && Array.isArray(data.products) ? data.products : null;
  if (!products) return ['products'];
  const fields = [];
  const ids = new Set();
  for (const [i, product] of products.entries()) {
    if (!isText(product?.id) || !isText(product?.name) || !isMoney(product?.price) ||
        typeof product?.online_enabled !== 'boolean' ||
        !(product?.enabled === undefined || typeof product.enabled === 'boolean')) {
      fields.push('products.' + i);
    }
    const id = String(product?.id || '');
    if (id && ids.has(id)) fields.push('products.' + i + '.duplicate');
    if (id) ids.add(id);
  }
  return fields;
}

function updateRadishSection({ store, actor, sectionId = 'radish_products', data,
  expectedVersion, now, failAt } = {}) {
  if (!store || !(store.radishSections instanceof Map)) return fail('STORE_INVALID');
  if (!canManage(actor)) return fail('ADMIN_FORBIDDEN');
  if (!Number.isSafeInteger(now) || now < 0) return fail('TIME_INVALID');
  if (sectionId !== 'radish_products') return fail('SECTION_FORBIDDEN');
  const current = store.radishSections.get(sectionId);
  if (!current) return fail('SECTION_NOT_FOUND');
  if (current.version !== expectedVersion) return fail('VERSION_CONFLICT');
  const fields = validateRadishProducts(data);
  if (fields.length) return fail('RADISH_DATA_INVALID', fields);
  const staged = freeze({
    sectionId, data: clone(data), version: current.version + 1, updatedAt: now
  });
  if (failAt === 'after_validation' || failAt === 'before_commit') return fail('TRANSACTION_ABORTED');
  store.radishSections.set(sectionId, staged);
  store.audit.push(freeze({
    actorId: actor.id.trim(), action: 'radish_products.updated',
    entityId: sectionId, version: staged.version, at: now
  }));
  return Object.freeze({ ok: true, sectionId, version: staged.version });
}

function readRadishSection(store, sectionId = 'radish_products') {
  const record = store?.radishSections?.get(sectionId);
  return record ? clone(record) : null;
}

module.exports = {
  createStore, readDailyOrder, readRadishSection, saveDailyOrder,
  seedRadishSection, updateRadishSection
};
