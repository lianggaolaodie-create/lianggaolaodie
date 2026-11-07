import test from "node:test";
import assert from "node:assert/strict";
import {
  authorizeInternalNotification,
  validateOrderIdentifier,
  paymentNotificationLabel,
  shouldSendPaymentNotification,
  buildCustomerShipmentMessage,
  isDuplicateNotification
} from "./notification-security.js";

test("rejects public request without internal secret", () => {
  assert.deepEqual(authorizeInternalNotification({
    method: "POST", secretConfigured: true, suppliedSecret: "", expectedSecret: "server-only",
    timestamp: 1000000, nowMs: 1000000, eventId: "evt_123456789012"
  }), { ok: false, reason: "unauthorized" });
});

test("rejects stale signed notification request", () => {
  assert.equal(authorizeInternalNotification({
    method: "POST", secretConfigured: true, suppliedSecret: "s", expectedSecret: "s",
    timestamp: 1000, nowMs: 900000, eventId: "evt_123456789012"
  }).reason, "stale_timestamp");
});

test("accepts valid internal notification envelope", () => {
  assert.equal(authorizeInternalNotification({
    method: "POST", secretConfigured: true, suppliedSecret: "s", expectedSecret: "s",
    timestamp: 1000000, nowMs: 1001000, eventId: "evt_123456789012"
  }).ok, true);
});

test("validates order identifiers before database access", () => {
  assert.equal(validateOrderIdentifier("f2f1a1c2-1234-4234-8234-123456789abc"), true);
  assert.equal(validateOrderIdentifier("not-an-id"), false);
  assert.equal(validateOrderIdentifier(5, "positive_integer"), true);
  assert.equal(validateOrderIdentifier(-1, "positive_integer"), false);
});

test("proof submitted is never labeled paid", () => {
  assert.equal(paymentNotificationLabel("proof_submitted"), "已提交匯款資料，待管理員核款");
  assert.equal(paymentNotificationLabel("confirmed"), "已確認付款");
});

test("payment notification requires a real proof event and known payment state", () => {
  assert.equal(shouldSendPaymentNotification({ paymentStatus: "proof_submitted", last5: "12345", proofSubmittedEvent: true }), true);
  assert.equal(shouldSendPaymentNotification({ paymentStatus: "unpaid", last5: "12345", proofSubmittedEvent: true }), false);
  assert.equal(shouldSendPaymentNotification({ paymentStatus: "confirmed", last5: "12345", proofSubmittedEvent: false }), false);
});

test("shipment notification ignores forged request recipient and fields", () => {
  const result = buildCustomerShipmentMessage({
    verifiedOrder: {
      tokenValid: true, recipient: "verified-line-user",
      order: { order_number: "LG20261108-ABC123", pickup_type: "seven_eleven", pickup_store: "台北門市" }
    },
    requestBody: { recipient: "attacker", order_number: "OTHER", pickup_store: "偽造門市" }
  });
  assert.equal(result.recipient, "verified-line-user");
  assert.equal(result.order_number, "LG20261108-ABC123");
  assert.equal(result.pickup_store, "台北門市");
});

test("shipment notification refuses missing verified recipient", () => {
  assert.equal(buildCustomerShipmentMessage({ verifiedOrder: { tokenValid: true, recipient: "", order: {} } }).ok, false);
});

test("duplicate event IDs are detected", () => {
  assert.equal(isDuplicateNotification({ eventId: "evt1", processedEventIds: new Set(["evt1"]) }), true);
  assert.equal(isDuplicateNotification({ eventId: "evt2", processedEventIds: new Set(["evt1"]) }), false);
});
