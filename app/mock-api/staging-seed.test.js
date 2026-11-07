import test from 'node:test';
import assert from 'node:assert/strict';
import { stagingSeed, validateStagingSeed, toPublicSchedule } from './staging-seed.js';

test('seed is explicitly synthetic and structurally valid', () => {
  assert.equal(validateStagingSeed().valid, true);
  assert.equal(stagingSeed.environment, 'synthetic-staging');
});

test('seed has two customers and separated admin roles', () => {
  assert.equal(stagingSeed.users.filter((user) => user.role === 'customer').length, 2);
  for (const role of ['super_admin', 'product_admin', 'order_admin', 'payment_admin', 'personal_data_admin']) {
    assert.equal(stagingSeed.users.some((user) => user.role === role), true);
  }
});

test('stall public schedule strips internal price', () => {
  const stall = toPublicSchedule(stagingSeed.schedules.find((item) => item.type === 'stall'));
  assert.equal(Object.hasOwn(stall, 'internalPrice'), false);
  assert.equal(Object.hasOwn(stall, 'publicPrice'), false);
});

test('food truck public schedule retains its public price', () => {
  const truck = toPublicSchedule(stagingSeed.schedules.find((item) => item.type === 'food_truck'));
  assert.equal(truck.publicPrice, 100);
});

test('seed includes expired and revoked guest claim cases', () => {
  assert.equal(stagingSeed.guestClaims.some((claim) => claim.expiresAt.startsWith('2000-')), true);
  assert.equal(stagingSeed.guestClaims.some((claim) => claim.revoked), true);
});

test('seed validator rejects production-like email addresses', () => {
  const invalid = { ...stagingSeed, users: [{ ...stagingSeed.users[0], email: 'real@example.com' }] };
  assert.equal(validateStagingSeed(invalid).valid, false);
});
