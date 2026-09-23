// Reserved Corestore namespace names. ic-designs/pg-workflows/brand-kits are
// live via catalog-store.cjs. progress stays deliberately un-namespaced
// (namespacing it now would orphan every existing user's saved data).
// identity/profile/rooms are still reserved but unused.
module.exports = {
  IDENTITY_NS: 'identity',
  PROFILE_NS: 'profile',
  PROGRESS_NS: 'progress',
  IC_DESIGNS_NS: 'ic-designs',
  PG_WORKFLOWS_NS: 'pg-workflows',
  BRAND_KITS_NS: 'brand-kits',
  roomNamespace(id) {
    return `rooms/${id}`;
  },
};
