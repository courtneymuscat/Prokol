import { describe, it, expect, vi } from 'vitest'

// computePlatformAnalytics (Admin Mode's top-level Analytics tab — the
// "Prokol umbrella" view) must aggregate across every coach regardless of
// org, unlike computeOrgAnalytics which is scoped to one org. This fixture
// has coaches in two different orgs plus an independent coach — all three
// must be counted.
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const fixtures: Record<string, Record<string, unknown>[]> = {
        coach_clients: [
          { coach_id: 'coach-org-a', client_id: 'client-1', accepted_at: '2026-01-01', archived_at: null, status: 'active' },
          { coach_id: 'coach-org-b', client_id: 'client-2', accepted_at: '2026-01-01', archived_at: null, status: 'active' },
          { coach_id: 'coach-independent', client_id: 'client-3', accepted_at: '2026-01-01', archived_at: null, status: 'active' },
        ],
        profiles: [
          { id: 'coach-org-a', user_type: 'coach', full_name: 'Coach A', email: 'a@x.com' },
          { id: 'coach-org-b', user_type: 'coach', full_name: 'Coach B', email: 'b@x.com' },
          { id: 'coach-independent', user_type: 'coach', full_name: 'Independent Coach', email: 'c@x.com' },
        ],
      }
      let rows = [...(fixtures[table] ?? [])]
      const builder = {
        select: () => builder,
        eq: (col: string, val: unknown) => { rows = rows.filter((r) => r[col] === val); return builder },
        in: (col: string, vals: unknown[]) => { rows = rows.filter((r) => vals.includes(r[col])); return builder },
        then: (resolve: (v: { data: unknown; error: null }) => void) => resolve({ data: rows, error: null }),
      }
      return builder
    },
  }),
}))

const { computePlatformAnalytics } = await import('@/lib/admin')

describe('computePlatformAnalytics', () => {
  it('counts active clients across every coach, regardless of org membership', async () => {
    const result = await computePlatformAnalytics()
    expect(result.total_active).toBe(3)
    expect(result.clients_by_coach.map((c) => c.name).sort()).toEqual(['Coach A', 'Coach B', 'Independent Coach'])
  })
})
