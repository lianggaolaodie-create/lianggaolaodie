/**
 * Phase 41 screen state models for public customer-facing screens.
 * Framework-independent state transitions; no timers, UI framework, or network calls.
 */
'use strict';

const SCREEN_STATUS = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  EMPTY: 'empty',
  ERROR: 'error',
  REFRESHING: 'refreshing'
});

function isEmptyData(data) {
  if (Array.isArray(data)) return data.length === 0;
  if (data && typeof data === 'object' && Array.isArray(data.items)) return data.items.length === 0;
  return data === null || data === undefined;
}

function createScreenState({ data = null } = {}) {
  const hasData = data !== null && data !== undefined;
  return Object.freeze({
    status: hasData ? (isEmptyData(data) ? SCREEN_STATUS.EMPTY : SCREEN_STATUS.SUCCESS) : SCREEN_STATUS.IDLE,
    data,
    error: null,
    requestId: 0,
    refreshing: false,
    canRetry: false
  });
}

function normalizeError(error) {
  if (!error || typeof error !== 'object') {
    return { code: 'UNKNOWN_ERROR', message: '發生未知錯誤，請稍後再試。', retryable: false };
  }
  return {
    code: typeof error.code === 'string' ? error.code : 'UNKNOWN_ERROR',
    message: typeof error.message === 'string' && error.message.trim()
      ? error.message.trim()
      : '資料載入失敗，請稍後再試。',
    retryable: error.retryable === true
  };
}

function screenReducer(state = createScreenState(), action = {}) {
  switch (action.type) {
    case 'LOAD_START': {
      const requestId = Number.isSafeInteger(action.requestId) && action.requestId > state.requestId
        ? action.requestId
        : state.requestId + 1;
      const hasData = state.data !== null && state.data !== undefined;
      return Object.freeze({
        ...state,
        status: hasData ? SCREEN_STATUS.REFRESHING : SCREEN_STATUS.LOADING,
        error: null,
        requestId,
        refreshing: hasData,
        canRetry: false
      });
    }
    case 'LOAD_SUCCESS': {
      if (action.requestId !== state.requestId) return state;
      const data = action.data === undefined ? null : action.data;
      return Object.freeze({
        status: isEmptyData(data) ? SCREEN_STATUS.EMPTY : SCREEN_STATUS.SUCCESS,
        data,
        error: null,
        requestId: state.requestId,
        refreshing: false,
        canRetry: false
      });
    }
    case 'LOAD_ERROR': {
      if (action.requestId !== state.requestId) return state;
      const error = normalizeError(action.error);
      const hasData = state.data !== null && state.data !== undefined;
      return Object.freeze({
        ...state,
        status: hasData ? SCREEN_STATUS.SUCCESS : SCREEN_STATUS.ERROR,
        error,
        refreshing: false,
        canRetry: error.retryable
      });
    }
    case 'LOAD_CANCEL': {
      if (action.requestId !== state.requestId) return state;
      const hasData = state.data !== null && state.data !== undefined;
      return Object.freeze({
        ...state,
        status: hasData ? (isEmptyData(state.data) ? SCREEN_STATUS.EMPTY : SCREEN_STATUS.SUCCESS) : SCREEN_STATUS.IDLE,
        error: null,
        refreshing: false,
        canRetry: false
      });
    }
    case 'RESET':
      return createScreenState();
    default:
      return state;
  }
}

function createLoadActions(repositoryMethod, mapData = value => value) {
  if (typeof repositoryMethod !== 'function') throw new TypeError('repositoryMethod 必須是函式。');
  if (typeof mapData !== 'function') throw new TypeError('mapData 必須是函式。');
  return async function load({ dispatch, requestId, signal, options } = {}) {
    if (typeof dispatch !== 'function') throw new TypeError('dispatch 必須是函式。');
    dispatch({ type: 'LOAD_START', requestId });
    try {
      const result = await repositoryMethod({ ...(options || {}), signal });
      const source = result && result.data !== undefined ? result.data : result;
      dispatch({ type: 'LOAD_SUCCESS', requestId: requestId || 1, data: mapData(source) });
      return { ok: true };
    } catch (error) {
      const normalized = normalizeError(error);
      if (normalized.code === 'ABORTED' || (signal && signal.aborted)) {
        dispatch({ type: 'LOAD_CANCEL', requestId: requestId || 1 });
        return { ok: false, cancelled: true };
      }
      dispatch({ type: 'LOAD_ERROR', requestId: requestId || 1, error: normalized });
      return { ok: false, error: normalized };
    }
  };
}

function getScreenMessage(state) {
  if (state.status === SCREEN_STATUS.LOADING) return '資料載入中…';
  if (state.status === SCREEN_STATUS.EMPTY) return '目前沒有可顯示的資料';
  if (state.status === SCREEN_STATUS.ERROR) return state.error ? state.error.message : '資料載入失敗，請稍後再試。';
  if (state.status === SCREEN_STATUS.REFRESHING) return '正在更新資料…';
  return '';
}

module.exports = {
  SCREEN_STATUS,
  createLoadActions,
  createScreenState,
  getScreenMessage,
  isEmptyData,
  normalizeError,
  screenReducer
};
