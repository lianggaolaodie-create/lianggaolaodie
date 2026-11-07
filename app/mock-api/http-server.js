/**
 * Phase 36 HTTP transport for the public read mock API.
 * Node.js built-ins only. No database, network dependency, or write routes.
 * Intended for local integration tests and frontend prototyping only.
 */
'use strict';

const { randomUUID } = require('node:crypto');
const { createServer } = require('node:http');
const { URL } = require('node:url');
const { ApiError, buildPublicReadApi } = require('./public-read-api');

function queryOptions(url, allowedKeys) {
  for (const key of url.searchParams.keys()) {
    if (!allowedKeys.has(key)) {
      throw new ApiError(400, 'VALIDATION_ERROR', `不支援的查詢參數：${key}`, [
        { field: key, reason: 'unknown_query_parameter' }
      ]);
    }
    if (url.searchParams.getAll(key).length > 1) {
      throw new ApiError(400, 'VALIDATION_ERROR', `查詢參數不可重複：${key}`, [
        { field: key, reason: 'duplicate_query_parameter' }
      ]);
    }
  }
  return Object.fromEntries(url.searchParams.entries());
}

function writeJson(res, status, body, requestId) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'x-request-id': requestId
  });
  res.end(payload);
}

function success(data, requestId) {
  return {
    data,
    meta: { request_id: requestId, api_version: 'v1' }
  };
}

function failure(error, requestId) {
  const known = error instanceof ApiError;
  const status = known ? error.status : 500;
  return {
    status,
    body: {
      error: {
        code: known ? error.code : 'INTERNAL_ERROR',
        message: known ? error.message : '系統暫時無法處理請求。',
        field_errors: known ? error.field_errors : [],
        retryable: !known || status === 503
      },
      meta: { request_id: requestId, api_version: 'v1' }
    }
  };
}

function createPublicReadHttpServer({ fixtures = {}, api = null } = {}) {
  const readApi = api || buildPublicReadApi(fixtures);

  return createServer((req, res) => {
    const requestId = randomUUID();

    try {
      if (req.method !== 'GET') {
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', '此 API 僅提供 GET 讀取。');
      }

      const url = new URL(req.url || '/', 'http://127.0.0.1');
      let data;

      if (url.pathname === '/api/v1/catalog') {
        const q = queryOptions(url, new Set(['cursor', 'limit']));
        data = readApi.getCatalog({ cursor: q.cursor || null, limit: q.limit === undefined ? 20 : q.limit });
      } else if (url.pathname === '/api/v1/content') {
        queryOptions(url, new Set());
        data = readApi.getContent();
      } else if (url.pathname === '/api/v1/schedules') {
        const q = queryOptions(url, new Set(['type', 'cursor', 'limit']));
        data = readApi.getSchedules({
          type: q.type || undefined,
          cursor: q.cursor || null,
          limit: q.limit === undefined ? 20 : q.limit
        });
      } else {
        throw new ApiError(404, 'NOT_FOUND', '找不到此 API 路徑。');
      }

      writeJson(res, 200, success(data, requestId), requestId);
    } catch (error) {
      const result = failure(error, requestId);
      writeJson(res, result.status, result.body, requestId);
    }
  });
}

module.exports = { createPublicReadHttpServer };
