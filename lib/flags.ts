// Feature flags. Phase 1 of the gym-partnerships build keeps every new
// route/behavior behind this single flag so nothing is reachable for
// existing coaches/clients until it's deliberately switched on.
//
// Env var, not DB-driven, for now — simplest thing that works for a single
// pilot. Can move to a per-org DB flag later without changing call sites.
export function isGymPartnershipsEnabled(): boolean {
  return process.env.GYM_PARTNERSHIPS_ENABLED === '1'
}
