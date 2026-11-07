/**
 * Phase 39 public data repository.
 * A single read-only interface for App and website consumers.
 * No authentication, customer data, order writes, or production configuration.
 */
'use strict';

const { ApiClientError } = require('./api-client');

function assertClient(client) {
  if (!client || typeof client !== 'object') throw new TypeError('client 必須是 API client。');
  for (const method of ['getCatalog', 'getContent', 'getSchedules']) {
    if (typeof client[method] !== 'function') throw new TypeError(`client.${method} 必須是函式。`);
  }
}

function createPublicRepository({ client } = {}) {
  assertClient(client);

  async function unwrap(operation) {
    const result = await operation();
    if (!result || !result.data || !result.meta) {
      throw new ApiClientError({
        message: '公開資料回應格式不正確。',
        code: 'INVALID_ENVELOPE',
        requestId: result && result.meta && result.meta.request_id
      });
    }
    return result;
  }

  return Object.freeze({
    async listCatalog(options = {}) {
      return unwrap(() => client.getCatalog(options));
    },
    async getPublishedContent(options = {}) {
      return unwrap(() => client.getContent(options));
    },
    async listSchedules(options = {}) {
      return unwrap(() => client.getSchedules(options));
    },
    async listAllCatalog(options = {}) {
      if (typeof client.getAllCatalog !== 'function') {
        throw new ApiClientError({ message: '目前 API client 不支援完整商品分頁。', code: 'UNSUPPORTED_OPERATION' });
      }
      return client.getAllCatalog(options);
    },
    async listAllSchedules(options = {}) {
      if (typeof client.getAllSchedules !== 'function') {
        throw new ApiClientError({ message: '目前 API client 不支援完整行程分頁。', code: 'UNSUPPORTED_OPERATION' });
      }
      return client.getAllSchedules(options);
    }
  });
}

/**
 * Synthetic-data adapter for UI development and tests.
 * Its return shape matches the HTTP client repository.
 */
function createMockPublicRepository({ api, requestId = 'mock-request', apiVersion = 'v1' } = {}) {
  if (!api || typeof api.getCatalog !== 'function' ||
      typeof api.getContent !== 'function' || typeof api.getSchedules !== 'function') {
    throw new TypeError('api 必須提供 getCatalog、getContent、getSchedules。');
  }

  function envelope(data) {
    return { data, meta: { request_id: requestId, api_version: apiVersion } };
  }

  return Object.freeze({
    async listCatalog(options = {}) {
      return envelope(api.getCatalog(options));
    },
    async getPublishedContent() {
      return envelope(api.getContent());
    },
    async listSchedules(options = {}) {
      return envelope(api.getSchedules(options));
    },
    async listAllCatalog({ limit = 100, maxPages = 100 } = {}) {
      const items = [];
      let cursor = null;
      let pages = 0;
      do {
        if (pages >= maxPages) {
          throw new ApiClientError({ message: '已達分頁安全上限。', code: 'PAGE_LIMIT_EXCEEDED' });
        }
        const page = api.getCatalog({ cursor, limit });
        items.push(...page.items);
        cursor = page.next_cursor;
        pages += 1;
      } while (cursor);
      return { items, pages, meta: { request_id: requestId, api_version: apiVersion } };
    },
    async listAllSchedules({ type, limit = 100, maxPages = 100 } = {}) {
      const items = [];
      let cursor = null;
      let pages = 0;
      do {
        if (pages >= maxPages) {
          throw new ApiClientError({ message: '已達分頁安全上限。', code: 'PAGE_LIMIT_EXCEEDED' });
        }
        const page = api.getSchedules({ type, cursor, limit });
        items.push(...page.items);
        cursor = page.next_cursor;
        pages += 1;
      } while (cursor);
      return { items, pages, meta: { request_id: requestId, api_version: apiVersion } };
    }
  });
}

module.exports = { createMockPublicRepository, createPublicRepository };
