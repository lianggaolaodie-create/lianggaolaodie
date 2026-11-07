-- PROPOSAL ONLY — DO NOT APPLY TO PRODUCTION YET
-- 老爹．涼糕 App security hardening draft
-- Requires Edge Function callers to be updated to use service_role first.
-- Run only after staging validation and explicit approval.

begin;

-- 1) Private LINE notification payloads: server-to-server only.
revoke execute on function public.get_line_order_notification_payload(uuid)
  from public, anon, authenticated;
grant execute on function public.get_line_order_notification_payload(uuid)
  to service_role;

revoke execute on function public.get_cooling_order_line_notification_payload(bigint)
  from public, anon, authenticated;
grant execute on function public.get_cooling_order_line_notification_payload(bigint)
  to service_role;

-- 2) Notification delivery marker: server-to-server only.
revoke execute on function public.mark_line_payment_notification_sent(uuid)
  from public, anon, authenticated;
grant execute on function public.mark_line_payment_notification_sent(uuid)
  to service_role;

commit;

-- Follow-up (separate reviewed migration, not included in this first patch):
-- * Replace mark_line_payment_notification_sent with a guarded RPC that checks
--   payment_notification_sent=false and a server-created notification attempt.
-- * Remove direct anon INSERT paths on cooling_pickup_orders/items only after
--   confirming all live storefronts call create_cooling_pickup_order().
-- * Do not revoke broad authenticated table grants until admin pages and
--   legacy integrations are migrated and tested.
