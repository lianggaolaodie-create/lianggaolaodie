/**
 * Phase 72 RLS policy test specification model.
 * Synthetic policy evaluator only; not executable SQL and not a Supabase client.
 */
export const TABLES = Object.freeze([
  'flavors','daily_order_settings','daily_order_regions','daily_order_flavors',
  'food_truck_schedules','food_truck_schedule_flavors','merch_products',
  'merch_categories','orders','order_items','transfer_proofs'
]);

const adminRoles = new Set(['super_admin']);
const productRoles = new Set(['super_admin','product_admin']);
const orderRoles = new Set(['super_admin','order_admin']);
const paymentRoles = new Set(['super_admin','payment_admin']);
const personalRoles = new Set(['super_admin','personal_data_admin']);

export function canSelect({ table, role='anon', subjectId=null, ownerId=null, isPublic=true }) {
  if (!TABLES.includes(table)) return false;
  if (['flavors','food_truck_schedules'].includes(table)) return isPublic || adminRoles.has(role);
  if (['daily_order_settings','daily_order_regions','daily_order_flavors'].includes(table)) {
    return adminRoles.has(role) || productRoles.has(role) || (role === 'customer' && isPublic);
  }
  if (['merch_products','merch_categories'].includes(table)) return isPublic || productRoles.has(role);
  if (['orders','order_items'].includes(table)) {
    return (role === 'customer' && !!subjectId && subjectId === ownerId) || orderRoles.has(role) || personalRoles.has(role);
  }
  if (table === 'transfer_proofs') return paymentRoles.has(role) || (role === 'customer' && !!subjectId && subjectId === ownerId);
  return false;
}

export function canWrite({ table, role='anon', operation='insert' }) {
  if (!TABLES.includes(table)) return false;
  if (['flavors','daily_order_settings','daily_order_regions','daily_order_flavors','merch_products','merch_categories'].includes(table)) {
    return productRoles.has(role);
  }
  if (['orders','order_items'].includes(table)) return orderRoles.has(role);
  if (table === 'transfer_proofs') return paymentRoles.has(role);
  if (table === 'food_truck_schedules' || table === 'food_truck_schedule_flavors') return adminRoles.has(role) || productRoles.has(role);
  return false;
}

export function expectedPolicyMatrix() {
  return {
    customerCanReadOwnOrder: canSelect({table:'orders',role:'customer',subjectId:'member-a',ownerId:'member-a'}),
    customerCannotReadOtherOrder: !canSelect({table:'orders',role:'customer',subjectId:'member-a',ownerId:'member-b'}),
    customerCannotWriteMerch: !canWrite({table:'merch_products',role:'customer'}),
    productAdminCanWriteCatalog: canWrite({table:'flavors',role:'product_admin'}),
    productAdminCannotReviewProof: !canWrite({table:'transfer_proofs',role:'product_admin'}),
    paymentAdminCanWriteProofReview: canWrite({table:'transfer_proofs',role:'payment_admin'}),
    orderAdminCannotWriteCatalog: !canWrite({table:'merch_products',role:'order_admin'}),
    personalDataAdminCannotFulfill: !canWrite({table:'orders',role:'personal_data_admin'}),
    anonCannotReadPrivateProof: !canSelect({table:'transfer_proofs',role:'anon'}),
  };
}
