// Reserved Corestore namespace names. pg-workflows is live via catalog-store.cjs. progress stays deliberately un-namespaced
// (namespacing it now would orphan every existing user's saved data).
// identity/profile/rooms are still reserved but unused.
module.exports = {
  IDENTITY_NS: 'identity',
  PROFILE_NS: 'profile',
  PROGRESS_NS: 'progress',
  PG_WORKFLOWS_NS: 'pg-workflows',
  roomNamespace(id) {
    return `rooms/${id}`;
  },
};
