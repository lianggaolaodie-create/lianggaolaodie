const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function authorizeInternalNotification({ method, secretConfigured, suppliedSecret, expectedSecret, timestamp, nowMs, maxSkewMs = 300000, eventId }) {
  if (method !== "POST") return { ok: false, reason: "method_not_allowed" };
  if (!secretConfigured || !expectedSecret) return { ok: false, reason: "server_misconfigured" };
  if (!suppliedSecret || suppliedSecret !== expectedSecret) return { ok: false, reason: "unauthorized" };
  if (!Number.isFinite(timestamp) || !Number.isFinite(nowMs) || Math.abs(nowMs - timestamp) > maxSkewMs) {
    return { ok: false, reason: "stale_timestamp" };
  }
  if (typeof eventId !== "string" || eventId.trim().length < 12 || eventId.length > 128) {
    return { ok: false, reason: "invalid_event_id" };
  }
  return { ok: true, reason: "authorized" };
}

export function validateOrderIdentifier(orderId, kind = "uuid") {
  if (kind === "uuid") return typeof orderId === "string" && UUID_RE.test(orderId);
  if (kind === "positive_integer") return Number.isSafeInteger(orderId) && orderId > 0;
  return false;
}

export function paymentNotificationLabel(paymentStatus) {
  if (paymentStatus === "confirmed" || paymentStatus === "paid") return "已確認付款";
  if (paymentStatus === "proof_submitted" || paymentStatus === "reviewing") return "已提交匯款資料，待管理員核款";
  if (paymentStatus === "rejected") return "付款資料未通過，請依通知補件";
  return "待付款";
}

export function shouldSendPaymentNotification({ paymentStatus, last5, proofSubmittedEvent }) {
  return Boolean(proofSubmittedEvent) && Boolean(last5) &&
    (paymentStatus === "proof_submitted" || paymentStatus === "reviewing" ||
     paymentStatus === "confirmed" || paymentStatus === "paid");
}

export function buildCustomerShipmentMessage({ verifiedOrder, requestBody = {} }) {
  if (!verifiedOrder || !verifiedOrder.tokenValid || !verifiedOrder.recipient) {
    return { ok: false, reason: "invalid_or_unbound_order" };
  }
  const o = verifiedOrder.order;
  if (!o || !o.order_number) return { ok: false, reason: "order_not_found" };
  // Recipient and all customer-facing fields are sourced only from verified server data.
  return {
    ok: true,
    recipient: verifiedOrder.recipient,
    order_number: o.order_number,
    pickup_type: o.pickup_type,
    pickup_store: o.pickup_store || null
  };
}

export function isDuplicateNotification({ eventId, processedEventIds }) {
  return processedEventIds instanceof Set && processedEventIds.has(eventId);
}
