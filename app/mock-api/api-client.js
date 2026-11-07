/**
 * Phase 37 portable fetch client for the public read API.
 * Works with browser fetch and Node.js fetch; no framework or dependency required.
 */
'use strict';

class ApiClientError extends Error {
  constructor({ message, status = 0, code = 'CLIENT_ERROR', requestId = null, fieldErrors = [], retryable = false, cause = null }) {
    super(message, cause ? { cause } : undefined);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.fieldErrors = Array.isArray(fieldErrors) ? fieldErrors : [];
    this.retryable = retryable === true;
  }
}

function normalizeBaseUrl(baseUrl) {
  if (typeof baseUrl !== 'string' || !baseUrl.trim()) {
    throw new TypeError('baseUrl 必須是非空字串。');
  }
  return baseUrl.trim().replace(/\/+$/, '');
}

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    query.set(key, String(value));
  }
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
}

function parseEnvelope(payload, response, requestIdHeader) {
  const requestId = payload && payload.meta && payload.meta.request_id
    ? payload.meta.request_id
    : requestIdHeader || null;

  if (!response.ok || !payload || typeof payload !== 'object' || !payload.data || !payload.meta) {
    const error = payload && payload.error && typeof payload.error === 'object' ? payload.error : {};
    throw new ApiClientError({
      message: error.message || (response.ok ? '伺服器回應格式不正確。' : '伺服器無法處理請求。'),
      status: response.status,
      code: error.code || (response.ok ? 'INVALID_ENVELOPE' : 'HTTP_ERROR'),
      requestId,
      fieldErrors: error.field_errors,
      retryable: error.retryable === true
    });
  }

  return { data: payload.data, meta: payload.meta };
}

function createPublicApiClient({ baseUrl, fetchImpl = globalThis.fetch, timeoutMs = 10000, defaultHeaders = {} } = {}) {
  const base = normalizeBaseUrl(baseUrl);
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl 必須是函式。');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new TypeError('timeoutMs 必須是正整數。');

  async function request(path, params = {}, { signal, headers = {} } = {}) {
    const controller = new AbortController();
    let timedOut = false;
    const onAbort = () => controller.abort(signal.reason);
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error('Request timeout'));
    }, timeoutMs);

    try {
      const response = await fetchImpl(`${base}${path}${buildQuery(params)}`, {
        method: 'GET',
        headers: { accept: 'application/json', ...defaultHeaders, ...headers },
        signal: controller.signal
      });

      let payload;
      try {
        payload = await response.json();
      } catch (cause) {
        throw new ApiClientError({
          message: '伺服器回應不是有效 JSON。',
          status: response.status,
          code: 'INVALID_JSON',
          requestId: response.headers && response.headers.get('x-request-id'),
          retryable: response.status >= 500,
          cause
        });
      }
      return parseEnvelope(payload, response, response.headers && response.headers.get('x-request-id'));
    } catch (error) {
      if (error instanceof ApiClientError) throw error;
      if (timedOut) {
        throw new ApiClientError({ message: '連線逾時，請稍後再試。', code: 'TIMEOUT', retryable: true, cause: error });
      }
      if (signal && signal.aborted) {
        throw new ApiClientError({ message: '請求已取消。', code: 'ABORTED', retryable: false, cause: error });
      }
      throw new ApiClientError({ message: '網路連線失敗，請檢查網路後重試。', code: 'NETWORK_ERROR', retryable: true, cause: error });
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
    }
  }

  return Object.freeze({
    async getCatalog({ cursor, limit, signal, headers } = {}) {
      const result = await request('/api/v1/catalog', { cursor, limit }, { signal, headers });
      if (!result.data || !Array.isArray(result.data.items)) {
        throw new ApiClientError({ message: '商品目錄格式不正確。', code: 'INVALID_DATA', requestId: result.meta.request_id });
      }
      return result;
    },
    async getContent({ signal, headers } = {}) {
      const result = await request('/api/v1/content', {}, { signal, headers });
      if (!result.data || typeof result.data !== 'object' || Array.isArray(result.data)) {
        throw new ApiClientError({ message: '公開內容格式不正確。', code: 'INVALID_DATA', requestId: result.meta.request_id });
      }
      return result;
    },
    async getSchedules({ type, cursor, limit, signal, headers } = {}) {
      const result = await request('/api/v1/schedules', { type, cursor, limit }, { signal, headers });
      if (!result.data || !Array.isArray(result.data.items)) {
        throw new ApiClientError({ message: '行程資料格式不正確。', code: 'INVALID_DATA', requestId: result.meta.request_id });
      }
      return result;
    },
    async getAllCatalog({ limit = 100, maxPages = 100, signal } = {}) {
      return collectPages((options) => this.getCatalog(options), { limit, maxPages, signal });
    },
    async getAllSchedules({ type, limit = 100, maxPages = 100, signal } = {}) {
      return collectPages((options) => this.getSchedules(options), { type, limit, maxPages, signal });
    }
  });
}

async function collectPages(fetchPage, { limit, maxPages, signal, type } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new TypeError('limit 必須介於 1 到 100。');
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 1000) throw new TypeError('maxPages 必須介於 1 到 1000。');
  const items = [];
  let cursor;
  let pages = 0;
  let lastMeta = null;

  do {
    if (pages >= maxPages) {
      throw new ApiClientError({ message: '已達分頁安全上限，請縮小查詢範圍。', code: 'PAGE_LIMIT_EXCEEDED', retryable: false, requestId: lastMeta && lastMeta.request_id });
    }
    const result = await fetchPage({ cursor, limit, type, signal });
    items.push(...result.data.items);
    cursor = result.data.next_cursor || null;
    lastMeta = result.meta;
    pages += 1;
  } while (cursor);

  return { items, pages, meta: lastMeta };
}

module.exports = { ApiClientError, buildQuery, createPublicApiClient, normalizeBaseUrl };
