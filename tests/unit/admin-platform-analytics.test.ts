import { describe, it, expect, vi } from 'vitest'

// computePlatformAnalytics (Admin Mode's top-level Analytics tab — the
// "Prokol umbrella" view) aggregates across every organisation, gym, coach,
// and client on the platform, grouping active clients by organisation
// (with an "Independent coaches" bucket for coaches with no org_id) rather
// than by individual coach — a different shape from computeOrgAnalytics,
// which stays scoped to one org and grouped by coach.
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const fixtures: Record<string, Record<string, unknown>[]> = {
        organisations: [
          { id: 'org-a', name: 'Org A', tenant_type: 'coaching_business', is_active: true, is_white_label: false, created_at: '2026-01-01' },
          { id: 'org-b', name: 'Org B', tenant_type: 'gym', is_active: true, is_white_label: true, created_at: '2026-01-01' },
          { id: 'org-c', name: 'Org C (inactive)', tenant_type: 'coaching_business', is_active: false, is_white_label: false, created_at: '2026-01-01' },
        ],
        profiles: [
          { id: 'coach-org-a', user_type: 'coach', org_id: 'org-a', full_name: 'Coach A', email: 'a@x.com', is_suspended: false },
          { id: 'coach-org-b', user_type: 'coach', org_id: 'org-b', full_name: 'Coach B', email: 'b@x.com', is_suspended: false },
          { id: 'coach-independent', user_type: 'coach', org_id: null, full_name: 'Independent Coach', email: 'c@x.com', is_suspended: false },
        ],
        coach_clients: [
          { coach_id: 'coach-org-a', client_id: 'client-1', accepted_at: '2026-01-01', archived_at: null, status: 'active' },
          { coach_id: 'coach-org-b', client_id: 'client-2', accepted_at: '2026-01-01', archived_at: null, status: 'active' },
          { coach_id: 'coach-independent', client_id: 'client-3', accepted_at: '2026-01-01', archived_at: null, status: 'active' },
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
  it('counts active orgs, gyms, coaches, white-label orgs, and clients platform-wide', async () => {
    const result = await computePlatformAnalytics()
    expect(result.active_orgs).toBe(2) // org-c is inactive, excluded
    expect(result.active_gyms).toBe(1) // only org-b
    expect(result.active_white_label_orgs).toBe(1) // only org-b
    expect(result.active_coaches).toBe(3)
    expect(result.clients.total_active).toBe(3)
  })

  it('groups active clients by organisation, with an Independent coaches bucket', async () => {
    const result = await computePlatformAnalytics()
    const byName = Object.fromEntries(result.clients_by_org.map((c) => [c.name, c.count]))
    expect(byName['Org A']).toBe(1)
    expect(byName['Org B']).toBe(1)
    expect(byName['Independent coaches']).toBe(1)
    expect(result.clients_by_org).toHaveLength(3)
  })
})
