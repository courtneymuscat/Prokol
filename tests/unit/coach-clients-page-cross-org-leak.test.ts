import { describe, it, expect, vi, beforeEach } from 'vitest'

// Regression test for the same bug as org-clients-cross-org-leak.test.ts,
// on a different page: the sidebar's own "Clients" list
// (app/coach/clients/page.tsx) filtered coach_clients by coach_id alone,
// so a coach who owns more than one org (gym org-switching, lib/admin.ts
// enterGymOrg) saw every org's clients while "acting as" any one of them —
// exactly what Court saw (her real COURT clients showing up inside Arete).

type ClientRow = { client_id: string; coach_id: string; org_id: string | null; accepted_at: string; status: string }

let clientRows: ClientRow[] = []
let membership: { org_id: string; org_name: string; org_slug: string; role: string } | null = null

vi.mock('@/lib/coach', () => ({ requireCoach: async () => 'admin-1' }))
vi.mock('@/lib/org', () => ({ getOrgForUser: async () => membership }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === 'coach_clients') {
        return {
          select: () => ({
            eq: (_c1: string, coachId: string) => ({
              in: (_c2: string, statuses: string[]) => {
                // No org_id filter chained yet — simulates the exact
                // pre-fix shape if someone reverts the .eq('org_id', ...)
                // call: resolving here would return every org's rows.
                const base = clientRows.filter((r) => r.coach_id === coachId && statuses.includes(r.status))
                const withOrgFilter = (orgId: string) => ({
                  order: async () => ({ data: base.filter((r) => r.org_id === orgId) }),
                })
                return {
                  eq: (_c3: string, orgId: string) => withOrgFilter(orgId),
                  order: async () => ({ data: base }),
                }
              },
            }),
          }),
        }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'profiles') return { select: () => ({ in: async () => ({ data: [] }) }) }
      if (table === 'coach_invites' || table === 'check_ins' || table === 'autoflow_responses' || table === 'form_submissions') {
        // Generic flexible chain — every method returns itself and resolves
        // empty data, regardless of call shape (these tables' exact query
        // shape isn't what this test is verifying; coach_clients is).
        const chain: Record<string, unknown> = {}
        for (const m of ['select', 'eq', 'in', 'or', 'gt']) chain[m] = () => chain
        chain.order = async () => ({ data: [] })
        return chain
      }
      throw new Error(`unexpected table: ${table}`)
    },
  }),
}))

const { default: CoachClientsPage } = await import('@/app/coach/clients/page')

beforeEach(() => {
  clientRows = [
    { client_id: 'client-court', coach_id: 'admin-1', org_id: 'court-org', accepted_at: '2026-01-01', status: 'active' },
    { client_id: 'client-arete', coach_id: 'admin-1', org_id: 'arete-org', accepted_at: '2026-02-01', status: 'active' },
  ]
})

describe('CoachClientsPage — does not leak clients across orgs owned by the same coach', () => {
  it('only shows clients tagged to the currently active org', async () => {
    membership = { org_id: 'arete-org', org_name: 'Arete', org_slug: 'arete', role: 'owner' }
    const result = await CoachClientsPage()
    const html = JSON.stringify(result)
    expect(html).toContain('client-arete')
    expect(html).not.toContain('client-court')
  })

  it('shows the other org\'s clients when acting as that org instead', async () => {
    membership = { org_id: 'court-org', org_name: 'COURT', org_slug: 'court', role: 'owner' }
    const result = await CoachClientsPage()
    const html = JSON.stringify(result)
    expect(html).toContain('client-court')
    expect(html).not.toContain('client-arete')
  })
})
