/**
 * Phase 53 owner catalog and schedule administration reference model.
 * In-memory synthetic data only. No production API, Supabase or website writes.
 */
'use strict';

const PRODUCT_TYPES = Object.freeze(['lianggao', 'radish_cake']);
const SCHEDULE_TYPES = Object.freeze(['food_truck', 'stall']);
const PRODUCT_STATES = Object.freeze(['draft', 'published', 'paused', 'sold_out']);
const fail = (reason, fields = []) => Object.freeze({ ok: false, reason, fields: Object.freeze(fields) });
const text = value => typeof value === 'string' ? value.trim() : '';
const validMoney = value => Number.isSafeInteger(value) && value >= 0;

function createAdminCatalogStore() {
  return {
    products: new Map(),
    flavors: new Map(),
    schedules: new Map(),
    publicRevision: 0,
    publicSnapshot: Object.freeze({ revision: 0, products: Object.freeze([]), schedules: Object.freeze([]) }),
    audit: []
  };
}

function authorized(actor) {
  return !!actor && (actor.role === 'owner' || actor.role === 'admin') &&
    typeof actor.id === 'string' && !!actor.id.trim();
}
function audit(store, actor, action, entityType, entityId, now) {
  store.audit.push(Object.freeze({ actorId: actor.id.trim(), action, entityType, entityId, at: now }));
}
function nextVersion(current, expectedVersion) {
  return Number.isSafeInteger(expectedVersion) && current.version === expectedVersion;
}
function validNow(now) { return Number.isSafeInteger(now) && now >= 0; }

function saveProduct({ store, actor, product, expectedVersion, now } = {}) {
  if (!store || !(store.products instanceof Map)) return fail('STORE_INVALID');
  if (!authorized(actor)) return fail('ADMIN_FORBIDDEN');
  if (!validNow(now)) return fail('TIME_INVALID');
  if (!product || !text(product.id)) return fail('PRODUCT_ID_REQUIRED');
  const id = text(product.id);
  const previous = store.products.get(id);
  if (previous && !nextVersion(previous, expectedVersion)) return fail('VERSION_CONFLICT');
  if (!previous && expectedVersion !== undefined) return fail('VERSION_CONFLICT');
  const fields = [];
  if (!PRODUCT_TYPES.includes(product.type)) fields.push('type');
  if (!text(product.name)) fields.push('name');
  if (!text(product.spec)) fields.push('spec');
  if (!validMoney(product.priceMinor) || product.priceMinor <= 0) fields.push('priceMinor');
  if (!PRODUCT_STATES.includes(product.state || 'draft')) fields.push('state');
  if (product.onlineEnabled !== undefined && typeof product.onlineEnabled !== 'boolean') fields.push('onlineEnabled');
  if (fields.length) return fail('PRODUCT_INVALID', fields);
  const saved = Object.freeze({
    id, type: product.type, name: text(product.name), description: text(product.description),
    spec: text(product.spec), priceMinor: product.priceMinor,
    currency: 'TWD', state: product.state || 'draft',
    onlineEnabled: product.onlineEnabled === true,
    version: previous ? previous.version + 1 : 1,
    updatedAt: now
  });
  store.products.set(id, saved);
  audit(store, actor, previous ? 'product.updated' : 'product.created', 'product', id, now);
  return Object.freeze({ ok: true, product: saved });
}

function setProductState({ store, actor, productId, state, expectedVersion, now } = {}) {
  if (!store || !(store.products instanceof Map)) return fail('STORE_INVALID');
  if (!authorized(actor)) return fail('ADMIN_FORBIDDEN');
  if (!validNow(now)) return fail('TIME_INVALID');
  const current = store.products.get(productId);
  if (!current) return fail('PRODUCT_NOT_FOUND');
  if (!nextVersion(current, expectedVersion)) return fail('VERSION_CONFLICT');
  if (!PRODUCT_STATES.includes(state)) return fail('PRODUCT_STATE_INVALID');
  if (state === 'published' && (!current.onlineEnabled || !validMoney(current.priceMinor) || current.priceMinor <= 0)) {
    return fail('PRODUCT_NOT_READY_TO_PUBLISH');
  }
  const updated = Object.freeze({ ...current, state, version: current.version + 1, updatedAt: now });
  store.products.set(productId, updated);
  audit(store, actor, 'product.state_changed', 'product', productId, now);
  return Object.freeze({ ok: true, product: updated });
}

function saveFlavor({ store, actor, flavor, expectedVersion, now } = {}) {
  if (!store || !(store.flavors instanceof Map)) return fail('STORE_INVALID');
  if (!authorized(actor)) return fail('ADMIN_FORBIDDEN');
  if (!validNow(now)) return fail('TIME_INVALID');
  if (!flavor || !text(flavor.id)) return fail('FLAVOR_ID_REQUIRED');
  const id = text(flavor.id);
  const previous = store.flavors.get(id);
  if (previous && !nextVersion(previous, expectedVersion)) return fail('VERSION_CONFLICT');
  if (!previous && expectedVersion !== undefined) return fail('VERSION_CONFLICT');
  const fields = [];
  if (!PRODUCT_TYPES.includes(flavor.productType)) fields.push('productType');
  if (!text(flavor.name)) fields.push('name');
  if (flavor.enabled !== undefined && typeof flavor.enabled !== 'boolean') fields.push('enabled');
  if (fields.length) return fail('FLAVOR_INVALID', fields);
  const saved = Object.freeze({
    id, productType: flavor.productType, name: text(flavor.name),
    description: text(flavor.description), enabled: flavor.enabled !== false,
    version: previous ? previous.version + 1 : 1, updatedAt: now
  });
  store.flavors.set(id, saved);
  audit(store, actor, previous ? 'flavor.updated' : 'flavor.created', 'flavor', id, now);
  return Object.freeze({ ok: true, flavor: saved });
}

function saveSchedule({ store, actor, schedule, expectedVersion, now } = {}) {
  if (!store || !(store.schedules instanceof Map)) return fail('STORE_INVALID');
  if (!authorized(actor)) return fail('ADMIN_FORBIDDEN');
  if (!validNow(now)) return fail('TIME_INVALID');
  if (!schedule || !text(schedule.id)) return fail('SCHEDULE_ID_REQUIRED');
  const id = text(schedule.id);
  const previous = store.schedules.get(id);
  if (previous && !nextVersion(previous, expectedVersion)) return fail('VERSION_CONFLICT');
  if (!previous && expectedVersion !== undefined) return fail('VERSION_CONFLICT');
  const fields = [];
  if (!SCHEDULE_TYPES.includes(schedule.type)) fields.push('type');
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(text(schedule.serviceDate))) fields.push('serviceDate');
  if (!text(schedule.region) || !text(schedule.location)) fields.push('location');
  if (!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(text(schedule.startTime))) fields.push('startTime');
  if (!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(text(schedule.endTime))) fields.push('endTime');
  if (schedule.startTime >= schedule.endTime) fields.push('timeRange');
  const flavorIds = Array.isArray(schedule.flavorIds) ? [...new Set(schedule.flavorIds.map(text).filter(Boolean))] : [];
  if (flavorIds.some(flavorId => {
    const flavor = store.flavors.get(flavorId);
    return !flavor || !flavor.enabled || flavor.productType !== 'lianggao';
  })) fields.push('flavorIds');
  if (schedule.prices !== undefined && (!schedule.prices || typeof schedule.prices !== 'object' ||
      Object.values(schedule.prices).some(value => !validMoney(value)))) fields.push('prices');
  if (fields.length) return fail('SCHEDULE_INVALID', fields);
  const prices = schedule.type === 'food_truck' ? Object.freeze({ ...(schedule.prices || {}) }) : Object.freeze({});
  if (Object.keys(prices).some(flavorId => !flavorIds.includes(flavorId))) return fail('SCHEDULE_PRICE_FLAVOR_MISMATCH');
  const saved = Object.freeze({
    id, type: schedule.type, serviceDate: text(schedule.serviceDate), region: text(schedule.region),
    location: text(schedule.location), address: text(schedule.address), startTime: text(schedule.startTime),
    endTime: text(schedule.endTime), flavorIds: Object.freeze(flavorIds), prices,
    state: schedule.state === 'published' ? 'draft' : (schedule.state || 'draft'),
    version: previous ? previous.version + 1 : 1, updatedAt: now
  });
  store.schedules.set(id, saved);
  audit(store, actor, previous ? 'schedule.updated' : 'schedule.created', 'schedule', id, now);
  return Object.freeze({ ok: true, schedule: saved });
}

function setScheduleState({ store, actor, scheduleId, state, expectedVersion, now } = {}) {
  if (!store || !(store.schedules instanceof Map)) return fail('STORE_INVALID');
  if (!authorized(actor)) return fail('ADMIN_FORBIDDEN');
  if (!validNow(now)) return fail('TIME_INVALID');
  const current = store.schedules.get(scheduleId);
  if (!current) return fail('SCHEDULE_NOT_FOUND');
  if (!nextVersion(current, expectedVersion)) return fail('VERSION_CONFLICT');
  if (!['draft', 'published', 'cancelled'].includes(state)) return fail('SCHEDULE_STATE_INVALID');
  if (state === 'published' && (!current.location || !current.flavorIds.length)) return fail('SCHEDULE_NOT_READY_TO_PUBLISH');
  const updated = Object.freeze({ ...current, state, version: current.version + 1, updatedAt: now });
  store.schedules.set(scheduleId, updated);
  audit(store, actor, 'schedule.state_changed', 'schedule', scheduleId, now);
  return Object.freeze({ ok: true, schedule: updated });
}

function buildPublicSnapshot(store) {
  if (!store || !(store.products instanceof Map) || !(store.schedules instanceof Map)) return fail('STORE_INVALID');
  const products = [...store.products.values()]
    .filter(item => item.state === 'published' && item.onlineEnabled)
    .map(item => Object.freeze({
      id: item.id, type: item.type, name: item.name, description: item.description,
      spec: item.spec, priceMinor: item.priceMinor, currency: item.currency
    }));
  const schedules = [...store.schedules.values()]
    .filter(item => item.state === 'published')
    .map(item => Object.freeze({
      id: item.id, type: item.type, serviceDate: item.serviceDate, region: item.region,
      location: item.location, address: item.address, startTime: item.startTime,
      endTime: item.endTime,
      flavors: Object.freeze(item.flavorIds.map(flavorId => {
        const flavor = store.flavors.get(flavorId);
        const result = { id: flavor.id, name: flavor.name };
        if (item.type === 'food_truck' && validMoney(item.prices[flavorId])) result.priceMinor = item.prices[flavorId];
        return Object.freeze(result);
      }))
    }));
  const revision = store.publicRevision + 1;
  const snapshot = Object.freeze({
    revision, products: Object.freeze(products), schedules: Object.freeze(schedules)
  });
  store.publicRevision = revision;
  store.publicSnapshot = snapshot;
  return Object.freeze({ ok: true, revision, website: snapshot, app: snapshot });
}

function getPublicSnapshot(store, client = 'app') {
  if (!store || !store.publicSnapshot) return fail('STORE_INVALID');
  if (!['app', 'website'].includes(client)) return fail('CLIENT_INVALID');
  return Object.freeze({ ok: true, client, snapshot: store.publicSnapshot });
}

module.exports = {
  PRODUCT_TYPES, PRODUCT_STATES, SCHEDULE_TYPES, buildPublicSnapshot, createAdminCatalogStore,
  getPublicSnapshot, saveFlavor, saveProduct, saveSchedule, setProductState, setScheduleState
};
