/**
 * Phase 59 member profile and customer order lookup reference model.
 * Synthetic in-memory only. Authentication must be verified by a real auth provider.
 * Never accepts passwords, issues sessions, or connects to production data.
 */
'use strict';
const { createHash, randomBytes } = require('node:crypto');
const hash = value => createHash('sha256').update(value, 'utf8').digest('hex');
const fail = reason => Object.freeze({ ok: false, reason });
const text = value => typeof value === 'string' ? value.trim() : '';

function createMemberOrderStore() {
  return { members: new Map(), orders: new Map(), guestClaims: new Map() };
}

function syncVerifiedMember({ store, verifiedIdentity, profile = {}, now } = {}) {
  if (!store || !(store.members instanceof Map)) return fail('STORE_INVALID');
  if (!verifiedIdentity || verifiedIdentity.verified !== true) return fail('IDENTITY_NOT_VERIFIED');
  const subject = text(verifiedIdentity.subject);
  if (!subject || subject.length > 200) return fail('IDENTITY_SUBJECT_INVALID');
  if (!Number.isSafeInteger(now) || now < 0) return fail('TIME_INVALID');
  const previous = store.members.get(subject);
  const member = Object.freeze({
    subject,
    displayName: text(profile.displayName).slice(0, 80) || previous?.displayName || '',
    phoneVerified: verifiedIdentity.phoneVerified === true,
    emailVerified: verifiedIdentity.emailVerified === true,
    phoneMasked: text(verifiedIdentity.phoneMasked).slice(0, 32),
    emailMasked: text(verifiedIdentity.emailMasked).slice(0, 120),
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    version: (previous?.version ?? 0) + 1
  });
  store.members.set(subject, member);
  return Object.freeze({ ok: true, member });
}

function issueGuestOrderClaim({ store, orderId, now, ttlMs = 7 * 24 * 60 * 60 * 1000 } = {}) {
  if (!store || !(store.orders instanceof Map) || !(store.guestClaims instanceof Map)) return fail('STORE_INVALID');
  if (!store.orders.has(orderId)) return fail('ORDER_NOT_FOUND');
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(ttlMs) || ttlMs < 60000 || ttlMs > 30 * 24 * 60 * 60 * 1000) return fail('CLAIM_TTL_INVALID');
  const token = randomBytes(32).toString('hex');
  const tokenHash = hash(token);
  store.guestClaims.set(tokenHash, Object.freeze({ orderId, expiresAt: now + ttlMs, revoked: false }));
  return Object.freeze({ ok: true, token, expiresAt: now + ttlMs });
}

function registerSyntheticOrder({ store, order, guestClaimToken, now } = {}) {
  if (!store || !(store.orders instanceof Map) || !(store.guestClaims instanceof Map)) return fail('STORE_INVALID');
  if (!order || !text(order.orderId) || store.orders.has(order.orderId)) return fail('ORDER_INVALID');
  if (!Number.isSafeInteger(now) || !['awaiting_payment', 'confirmed', 'preparing', 'ready_to_ship', 'shipped', 'delivered', 'cancelled'].includes(order.status)) return fail('ORDER_INVALID');
  const safeOrder = Object.freeze({
    orderId: text(order.orderId),
    ownerSubject: text(order.ownerSubject) || null,
    status: order.status,
    paymentStatus: ['unpaid', 'proof_submitted', 'confirmed', 'rejected', 'refunded'].includes(order.paymentStatus) ? order.paymentStatus : 'unpaid',
    fulfillmentType: text(order.fulfillmentType),
    itemSummary: Array.isArray(order.itemSummary) ? order.itemSummary.slice(0, 10).map(item => ({
      name: text(item?.name).slice(0, 80), quantity: Number.isSafeInteger(item?.quantity) && item.quantity > 0 ? item.quantity : 1
    })) : [],
    createdAt: now,
    updatedAt: now
  });
  store.orders.set(safeOrder.orderId, safeOrder);
  if (guestClaimToken && safeOrder.ownerSubject === null) {
    const tokenHash = hash(guestClaimToken);
    store.guestClaims.set(tokenHash, Object.freeze({ orderId: safeOrder.orderId, expiresAt: now + 7 * 24 * 60 * 60 * 1000, revoked: false }));
  }
  return Object.freeze({ ok: true, order: safeOrder });
}

function lookupCustomerOrder({ store, orderId, principal, guestClaimToken, now } = {}) {
  if (!store || !(store.orders instanceof Map) || !(store.guestClaims instanceof Map)) return fail('STORE_INVALID');
  if (!Number.isSafeInteger(now)) return fail('TIME_INVALID');
  const order = store.orders.get(text(orderId));
  if (!order) return fail('ORDER_NOT_FOUND');
  const subject = principal?.verified === true ? text(principal.subject) : '';
  const memberAuthorized = Boolean(subject && order.ownerSubject && subject === order.ownerSubject);
  let guestAuthorized = false;
  if (typeof guestClaimToken === 'string' && guestClaimToken.length === 64) {
    const claim = store.guestClaims.get(hash(guestClaimToken));
    guestAuthorized = Boolean(claim && claim.orderId === order.orderId && !claim.revoked && now < claim.expiresAt);
  }
  if (!memberAuthorized && !guestAuthorized) return fail('ORDER_ACCESS_DENIED');
  return Object.freeze({ ok: true, order: Object.freeze({
    orderId: order.orderId,
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillmentType: order.fulfillmentType,
    itemSummary: order.itemSummary,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  }) });
}

function revokeGuestOrderClaim({ store, token, now } = {}) {
  if (!store || !(store.guestClaims instanceof Map)) return fail('STORE_INVALID');
  if (typeof token !== 'string' || token.length !== 64) return fail('CLAIM_INVALID');
  const key = hash(token);
  const claim = store.guestClaims.get(key);
  if (!claim || !Number.isSafeInteger(now)) return fail('CLAIM_NOT_FOUND');
  store.guestClaims.set(key, Object.freeze({ ...claim, revoked: true }));
  return Object.freeze({ ok: true });
}

module.exports = {
  createMemberOrderStore,
  lookupCustomerOrder,
  issueGuestOrderClaim,
  registerSyntheticOrder,
  revokeGuestOrderClaim,
  syncVerifiedMember
};
