/**
 * Phase 71 role authorization reference policy.
 * Pure in-memory decision model; not a Supabase RLS policy or production auth.
 */
export const ACTIONS = Object.freeze([
  'public.catalog.read',
  'customer.profile.read.self',
  'customer.profile.read.other',
  'customer.order.read.self',
  'customer.order.read.other',
  'guest.order.claim.read',
  'catalog.manage',
  'daily_menu.manage',
  'order.manage',
  'payment.review',
  'fulfillment.manage',
  'personal_data.read',
  'security.roles.manage',
]);

const permissions = {
  customer: new Set(['public.catalog.read','customer.profile.read.self','customer.order.read.self','guest.order.claim.read']),
  super_admin: new Set(ACTIONS),
  product_admin: new Set(['public.catalog.read','catalog.manage','daily_menu.manage']),
  order_admin: new Set(['public.catalog.read','order.manage','fulfillment.manage']),
  payment_admin: new Set(['public.catalog.read','payment.review']),
  personal_data_admin: new Set(['public.catalog.read','personal_data.read']),
};

export function authorize(role, action, context = {}) {
  if (!role || !permissions[role]) return { allowed:false, reason:'UNKNOWN_ROLE' };
  if (!ACTIONS.includes(action)) return { allowed:false, reason:'UNKNOWN_ACTION' };
  if (action === 'customer.profile.read.self' || action === 'customer.order.read.self') {
    if (!context.subjectId || context.subjectId !== context.ownerId) {
      return { allowed:false, reason:'OWNER_MISMATCH' };
    }
  }
  if (action === 'customer.profile.read.other' || action === 'customer.order.read.other') {
    return { allowed:false, reason:'SELF_ONLY' };
  }
  if (action === 'guest.order.claim.read' && context.validGuestClaim !== true) {
    return { allowed:false, reason:'INVALID_GUEST_CLAIM' };
  }
  if (!permissions[role].has(action)) return { allowed:false, reason:'ROLE_FORBIDDEN' };
  return { allowed:true, reason:'ALLOWED' };
}

export function listPermissions(role) {
  return permissions[role] ? [...permissions[role]].sort() : [];
}
