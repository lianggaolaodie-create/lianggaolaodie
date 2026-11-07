/**
 * Phase 42 customer screen controller composition.
 * Connects read-only repository -> display view models -> screen state.
 * Uses injected repository only; no production URL, secrets, or writes.
 */
'use strict';

const { createScreenState, screenReducer } = require('./screen-state');
const {
  mapCatalogToViewModels,
  mapContentToViewModels,
  mapSchedulesToViewModels
} = require('./public-view-models');

const SCREEN_KEYS = Object.freeze(['home', 'catalog', 'truckSchedules', 'stallSchedules']);

function assertRepository(repository) {
  const required = ['getPublishedContent', 'listAllCatalog', 'listAllSchedules'];
  if (!repository || typeof repository !== 'object') throw new TypeError('repository 必須是公開資料 repository。');
  for (const method of required) {
    if (typeof repository[method] !== 'function') throw new TypeError(`repository.${method} 必須是函式。`);
  }
}

function unwrapData(result) {
  if (!result || typeof result !== 'object') throw new TypeError('公開資料回應格式不正確。');
  if (result.data !== undefined) return result.data;
  return result;
}

function createCustomerScreenController({ repository, catalogLimit = 100, scheduleLimit = 100 } = {}) {
  assertRepository(repository);
  if (!Number.isInteger(catalogLimit) || catalogLimit < 1 || catalogLimit > 100) {
    throw new TypeError('catalogLimit 必須介於 1 到 100。');
  }
  if (!Number.isInteger(scheduleLimit) || scheduleLimit < 1 || scheduleLimit > 100) {
    throw new TypeError('scheduleLimit 必須介於 1 到 100。');
  }

  const states = Object.fromEntries(SCREEN_KEYS.map(key => [key, createScreenState()]));
  const sequences = Object.fromEntries(SCREEN_KEYS.map(key => [key, 0]));
  const controllers = Object.fromEntries(SCREEN_KEYS.map(key => [key, null]));
  const listeners = new Set();
  let disposed = false;

  function snapshot() {
    return Object.freeze({ ...states });
  }

  function emit() {
    const current = snapshot();
    for (const listener of listeners) listener(current);
  }

  function dispatch(key, action) {
    states[key] = screenReducer(states[key], action);
    emit();
  }

  function ensureActive() {
    if (disposed) throw new Error('畫面控制器已結束使用。');
  }

  async function run(key, operation, mapData) {
    ensureActive();
    if (controllers[key]) controllers[key].abort();
    const requestId = ++sequences[key];
    const abortController = new AbortController();
    controllers[key] = abortController;
    dispatch(key, { type: 'LOAD_START', requestId });

    try {
      const result = await operation(abortController.signal);
      if (abortController.signal.aborted) {
        dispatch(key, { type: 'LOAD_CANCEL', requestId });
        return { ok: false, cancelled: true };
      }
      const data = mapData(unwrapData(result));
      if (requestId !== sequences[key]) return { ok: false, stale: true };
      dispatch(key, { type: 'LOAD_SUCCESS', requestId, data });
      return { ok: true, data };
    } catch (error) {
      if (abortController.signal.aborted || (error && error.code === 'ABORTED')) {
        dispatch(key, { type: 'LOAD_CANCEL', requestId });
        return { ok: false, cancelled: true };
      }
      if (requestId !== sequences[key]) return { ok: false, stale: true };
      dispatch(key, { type: 'LOAD_ERROR', requestId, error });
      return { ok: false, error };
    } finally {
      if (controllers[key] === abortController) controllers[key] = null;
    }
  }

  const methods = {
    loadHome() {
      return run('home', signal => repository.getPublishedContent({ signal }), mapContentToViewModels);
    },
    loadCatalog() {
      return run('catalog', signal => repository.listAllCatalog({ limit: catalogLimit, signal }), result => {
        const items = Array.isArray(result) ? result : result.items;
        return mapCatalogToViewModels(items);
      });
    },
    loadTruckSchedules() {
      return run('truckSchedules', signal => repository.listAllSchedules({
        type: 'food_truck', limit: scheduleLimit, signal
      }), result => {
        const items = Array.isArray(result) ? result : result.items;
        return mapSchedulesToViewModels(items, 'food_truck');
      });
    },
    loadStallSchedules() {
      return run('stallSchedules', signal => repository.listAllSchedules({
        type: 'stall', limit: scheduleLimit, signal
      }), result => {
        const items = Array.isArray(result) ? result : result.items;
        return mapSchedulesToViewModels(items, 'stall');
      });
    }
  };

  function cancel(key) {
    if (!SCREEN_KEYS.includes(key)) throw new TypeError('未知的畫面名稱。');
    const controller = controllers[key];
    if (!controller) return false;
    const requestId = sequences[key];
    controller.abort();
    dispatch(key, { type: 'LOAD_CANCEL', requestId });
    controllers[key] = null;
    return true;
  }

  function cancelAll() {
    for (const key of SCREEN_KEYS) cancel(key);
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('listener 必須是函式。');
    ensureActive();
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function dispose() {
    if (disposed) return;
    cancelAll();
    disposed = true;
    listeners.clear();
  }

  return Object.freeze({
    getState: snapshot,
    subscribe,
    cancel,
    cancelAll,
    dispose,
    ...methods
  });
}

module.exports = { SCREEN_KEYS, createCustomerScreenController };
