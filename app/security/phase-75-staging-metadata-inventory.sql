-- Phase 75: READ-ONLY metadata inventory for an isolated Supabase staging project.
-- Review the project ref manually before connecting a SQL client.
-- This script inspects metadata only. It does not SELECT business rows or personal data.
-- Execute ONLY in a verified staging SQL editor. Never paste into production.
BEGIN TRANSACTION READ ONLY;

-- 1) Confirm database identity (metadata only).
SELECT current_database() AS database_name,
       current_user AS database_role,
       current_setting('transaction_read_only') AS transaction_read_only;

-- 2) Table existence, schema and RLS flags for the reviewed scope.
WITH target_tables(table_name) AS (
  VALUES ('flavors'),('daily_order_settings'),('daily_order_regions'),
         ('daily_order_flavors'),('food_truck_schedules'),
         ('food_truck_schedule_flavors'),('merch_products'),
         ('merch_categories'),('orders'),('order_items'),('transfer_proofs')
)
SELECT n.nspname AS schema_name, c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN target_tables t ON t.table_name = c.relname
WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
ORDER BY c.relname;

-- 3) Column metadata only (no row values).
SELECT table_name, ordinal_position, column_name, data_type,
       is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name IN ('flavors','daily_order_settings','daily_order_regions',
    'daily_order_flavors','food_truck_schedules','food_truck_schedule_flavors',
    'merch_products','merch_categories','orders','order_items','transfer_proofs')
ORDER BY table_name, ordinal_position;

-- 4) Every policy, including permissive/restrictive mode and predicates.
SELECT schemaname, tablename, policyname, permissive, roles, cmd,
       qual AS using_expression, with_check
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('flavors','daily_order_settings','daily_order_regions',
    'daily_order_flavors','food_truck_schedules','food_truck_schedule_flavors',
    'merch_products','merch_categories','orders','order_items','transfer_proofs')
ORDER BY tablename, policyname;

-- 5) Table privileges (metadata only).
SELECT table_schema, table_name, grantee, privilege_type, is_grantable
FROM information_schema.table_privileges
WHERE table_schema='public'
  AND table_name IN ('flavors','daily_order_settings','daily_order_regions',
    'daily_order_flavors','food_truck_schedules','food_truck_schedule_flavors',
    'merch_products','merch_categories','orders','order_items','transfer_proofs')
ORDER BY table_name, grantee, privilege_type;

-- 6) Function metadata and execute grants for functions in public schema.
-- Review each SECURITY DEFINER function individually; do not mass-revoke.
SELECT n.nspname AS schema_name, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS identity_arguments,
       p.prosecdef AS security_definer,
       p.proconfig AS function_settings,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
ORDER BY p.proname, identity_arguments;

-- 7) Foreign-key metadata for ownership and relationship review.
SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name,
       ccu.column_name AS foreign_column_name, tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name=tc.constraint_name AND ccu.table_schema=tc.table_schema
WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'
  AND tc.table_name IN ('flavors','daily_order_settings','daily_order_regions',
    'daily_order_flavors','food_truck_schedules','food_truck_schedule_flavors',
    'merch_products','merch_categories','orders','order_items','transfer_proofs')
ORDER BY tc.table_name, tc.constraint_name;

-- 8) Storage bucket metadata and policies (never inspect object contents).
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id IN ('transfer-proofs','product-images','site-images',
             'merch-images','merchandise-images')
ORDER BY id;

SELECT schemaname, tablename, policyname, permissive, roles, cmd,
       qual AS using_expression, with_check
FROM pg_policies
WHERE schemaname='storage' AND tablename='objects'
ORDER BY policyname;

ROLLBACK;
