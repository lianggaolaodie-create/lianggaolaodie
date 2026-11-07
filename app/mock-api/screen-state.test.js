'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SCREEN_STATUS,
  createLoadActions,
  createScreenState,
  getScreenMessage,
  screenReducer
} = require('./screen-state');

test('initial screen state and loading state are explicit', () => {
  const initial = createScreenState();
  assert.equal(initial.status, SCREEN_STATUS.IDLE);
  const loading = screenReducer(initial, { type: 'LOAD_START', requestId: 1 });
  assert.equal(loading.status, SCREEN_STATUS.LOADING);
  assert.equal(getScreenMessage(loading), '資料載入中…');
});

test('success distinguishes non-empty and empty lists', () => {
  const loading = screenReducer(createScreenState(), { type: 'LOAD_START', requestId: 1 });
  const success = screenReducer(loading, { type: 'LOAD_SUCCESS', requestId: 1, data: [{ id: 'p1' }] });
  const empty = screenReducer(loading, { type: 'LOAD_SUCCESS', requestId: 1, data: [] });
  assert.equal(success.status, SCREEN_STATUS.SUCCESS);
  assert.equal(empty.status, SCREEN_STATUS.EMPTY);
  assert.equal(getScreenMessage(empty), '目前沒有可顯示的資料');
});

test('retryable network failure offers retry; validation failure does not', () => {
  const loading = screenReducer(createScreenState(), { type: 'LOAD_START', requestId: 1 });
  const retry = screenReducer(loading, { type: 'LOAD_ERROR', requestId: 1, error: { code: 'NETWORK_ERROR', message: '離線', retryable: true } });
  const stop = screenReducer(loading, { type: 'LOAD_ERROR', requestId: 1, error: { code: 'VALIDATION_ERROR', message: '資料錯誤', retryable: false } });
  assert.equal(retry.status, SCREEN_STATUS.ERROR);
  assert.equal(retry.canRetry, true);
  assert.equal(stop.canRetry, false);
});

test('refresh retains existing data while updating and on failure', () => {
  const loaded = screenReducer(
    screenReducer(createScreenState(), { type: 'LOAD_START', requestId: 1 }),
    { type: 'LOAD_SUCCESS', requestId: 1, data: [{ id: 'old' }] }
  );
  const refreshing = screenReducer(loaded, { type: 'LOAD_START', requestId: 2 });
  assert.equal(refreshing.status, SCREEN_STATUS.REFRESHING);
  assert.equal(refreshing.data[0].id, 'old');
  const failed = screenReducer(refreshing, { type: 'LOAD_ERROR', requestId: 2, error: { code: 'NETWORK_ERROR', message: '斷線', retryable: true } });
  assert.equal(failed.status, SCREEN_STATUS.SUCCESS);
  assert.equal(failed.data[0].id, 'old');
  assert.equal(failed.error.message, '斷線');
  assert.equal(failed.canRetry, true);
});

test('stale responses from an older request are ignored', () => {
  const first = screenReducer(createScreenState(), { type: 'LOAD_START', requestId: 1 });
  const second = screenReducer(first, { type: 'LOAD_START', requestId: 2 });
  const stale = screenReducer(second, { type: 'LOAD_SUCCESS', requestId: 1, data: ['stale'] });
  assert.equal(stale, second);
  const current = screenReducer(second, { type: 'LOAD_SUCCESS', requestId: 2, data: ['fresh'] });
  assert.deepEqual(current.data, ['fresh']);
});

test('cancel returns to idle or preserves existing data without error', () => {
  const loading = screenReducer(createScreenState(), { type: 'LOAD_START', requestId: 1 });
  const idle = screenReducer(loading, { type: 'LOAD_CANCEL', requestId: 1 });
  assert.equal(idle.status, SCREEN_STATUS.IDLE);
  assert.equal(idle.error, null);
  const loaded = screenReducer(
    screenReducer(createScreenState(), { type: 'LOAD_START', requestId: 1 }),
    { type: 'LOAD_SUCCESS', requestId: 1, data: ['kept'] }
  );
  const refresh = screenReducer(loaded, { type: 'LOAD_START', requestId: 2 });
  const cancelled = screenReducer(refresh, { type: 'LOAD_CANCEL', requestId: 2 });
  assert.equal(cancelled.status, SCREEN_STATUS.SUCCESS);
  assert.deepEqual(cancelled.data, ['kept']);
});

test('reset clears prior content and errors', () => {
  const state = screenReducer(createScreenState(), { type: 'LOAD_START', requestId: 1 });
  const failed = screenReducer(state, { type: 'LOAD_ERROR', requestId: 1, error: { code: 'X', message: 'failed', retryable: true } });
  const reset = screenReducer(failed, { type: 'RESET' });
  assert.equal(reset.status, SCREEN_STATUS.IDLE);
  assert.equal(reset.error, null);
  assert.equal(reset.data, null);
});

test('load action helper dispatches loading then mapped success', async () => {
  const actions = [];
  const load = createLoadActions(async () => ({ data: [{ id: 'raw' }] }), data => data.map(x => ({ ...x, label: 'mapped' })));
  const result = await load({ dispatch: action => actions.push(action), requestId: 7 });
  assert.equal(result.ok, true);
  assert.deepEqual(actions.map(x => x.type), ['LOAD_START', 'LOAD_SUCCESS']);
  assert.equal(actions[1].requestId, 7);
  assert.equal(actions[1].data[0].label, 'mapped');
});

test('load action helper converts errors into state actions and recognizes cancellation', async () => {
  const actions = [];
  const failedLoad = createLoadActions(async () => { throw { code: 'TIMEOUT', message: '逾時', retryable: true }; });
  const failed = await failedLoad({ dispatch: action => actions.push(action), requestId: 3 });
  assert.equal(failed.ok, false);
  assert.equal(actions[1].type, 'LOAD_ERROR');
  assert.equal(actions[1].error.retryable, true);

  const cancelledActions = [];
  const controller = new AbortController();
  controller.abort();
  const cancelledLoad = createLoadActions(async () => { throw { code: 'ABORTED', message: '取消' }; });
  const cancelled = await cancelledLoad({ dispatch: action => cancelledActions.push(action), requestId: 4, signal: controller.signal });
  assert.equal(cancelled.cancelled, true);
  assert.equal(cancelledActions[1].type, 'LOAD_CANCEL');
});

test('unknown actions preserve the existing immutable state', () => {
  const state = createScreenState();
  assert.equal(screenReducer(state, { type: 'NOOP' }), state);
});
