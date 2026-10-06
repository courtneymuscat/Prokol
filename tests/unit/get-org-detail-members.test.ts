import { describe, it, expect, vi } from 'vitest'

// Regression test: getOrgDetail's members query used to embed profiles(...)
// directly off org_members, which PostgREST can't resolve (org_members.user_id
// has no discoverable FK to public.profiles — it's keyed to auth.users). That
// embed silently errored and returned null, so every org appeared to have
// zero members — and, since archived-clients lookup depends on the member
// list's user_ids, zero archived clients too — regardless of real data.
vi.mock('@/lib/org', () => ({
  listOrgPublications: async () => [],
  listCoachGrantsForTemplate: async () => [],
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const fixtures: Record<string, Record<string, unknown>[]> = {
        organisations: [{
          id: 'org-1', name: 'Test Org', slug: 'test-org', tenant_type: 'coaching_business',
          billing_status: 'active', subscription_tier: 'org_enterprise', is_active: true,
          logo_url: null, brand_colour: null, brand_colour_secondary: null, app_name: null,
          created_at: '2026-01-01', is_white_label: false, white_label_tier: null,
          custom_domain: null, custom_domain_verified: false, support_email: null, favicon_url: null,
        }],
        org_members: [{ id: 'member-1', org_id: 'org-1', user_id: 'owner-user', role: 'owner', is_active: true }],
        white_label_applications: [],
        profiles: [{ id: 'owner-user', full_name: 'Org Owner', email: 'owner@example.com' }],
        coach_clients: [
          { coach_id: 'owner-user', client_id: 'client-1', archived_at: '2026-02-01', status: 'archived' },
        ],
      }
      let rows = [...(fixtures[table] ?? [])]
      const builder = {
        select: () => builder,
        eq: (col: string, val: unknown) => { rows = rows.filter((r) => r[col] === val); return builder },
        in: (col: string, vals: unknown[]) => { rows = rows.filter((r) => vals.includes(r[col])); return builder },
        order: () => builder,
        limit: (n: number) => { rows = rows.slice(0, n); return builder },
        single: async () => ({ data: rows[0] ?? null, error: null }),
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        then: (resolve: (v: { data: unknown; error: null }) => void) => resolve({ data: rows, error: null }),
      }
      return builder
    },
  }),
}))

const { getOrgDetail } = await import('@/lib/admin')

describe('getOrgDetail', () => {
  it('resolves member profile info and archived clients without relying on a broken embedded join', async () => {
    const result = await getOrgDetail('org-1')

    expect(result.members).toHaveLength(1)
    expect(result.members[0]).toMatchObject({
      user_id: 'owner-user',
      role: 'owner',
      full_name: 'Org Owner',
      email: 'owner@example.com',
    })
    expect(result.archivedClients).toHaveLength(1)
    expect(result.archivedClients[0].client_id).toBe('client-1')
  })
})
