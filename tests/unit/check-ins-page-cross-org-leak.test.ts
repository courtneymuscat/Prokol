import { describe, it, expect, vi, beforeEach } from 'vitest'

// Regression test for the same bug class as org-clients-cross-org-leak.test.ts
// and coach-clients-page-cross-org-leak.test.ts, on the check-ins review
// queue (app/coach/check-ins/page.tsx): it filtered coach_clients by
// coach_id alone, so a coach who owns more than one org (gym org-switching,
// lib/admin.ts enterGymOrg) saw every org's clients' check-ins while
// "acting as" any one of them — e.g. Court's real COURT client Jessica
// Massheder showing up in a brand-new, otherwise-empty Arete gym.

type ClientRow = { client_id: string; coach_id: string; org_id: string | null; status: string }

let clientRows: ClientRow[] = []
let membership: { org_id: string; org_name: string; org_slug: string; role: string } | null = null
let profilesInCalledWith: string[] | null = null

vi.mock('@/lib/coach', () => ({ requireCoach: async () => 'admin-1' }))
vi.mock('@/lib/org', () => ({ getOrgForUser: async () => membership }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === 'coach_clients') {
        return {
          select: () => ({
            eq: (_c1: string, coachId: string) => ({
              eq: (_c2: string, status: string) => {
                const base = clientRows.filter((r) => r.coach_id === coachId && r.status === status)
                const result = { data: base }
                return {
                  eq: (_c3: string, orgId: string) => Promise.resolve({ data: base.filter((r) => r.org_id === orgId) }),
                  then: (resolve: (v: typeof result) => void) => resolve(result),
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
      if (table === 'profiles') {
        return {
          select: () => ({
            in: async (_col: string, ids: string[]) => {
              profilesInCalledWith = ids
              return { data: [] }
            },
          }),
        }
      }
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'in', 'or']) chain[m] = () => chain
      chain.order = () => chain
      chain.limit = async () => ({ data: [] })
      return chain
    },
  }),
}))

const { default: CoachCheckInsPage } = await import('@/app/coach/check-ins/page')

beforeEach(() => {
  profilesInCalledWith = null
  clientRows = [
    { client_id: 'client-court', coach_id: 'admin-1', org_id: 'court-org', status: 'active' },
    { client_id: 'client-arete', coach_id: 'admin-1', org_id: 'arete-org', status: 'active' },
  ]
})

describe('CoachCheckInsPage — does not leak clients across orgs owned by the same coach', () => {
  it('only resolves client IDs belonging to the currently active org', async () => {
    membership = { org_id: 'arete-org', org_name: 'Arete', org_slug: 'arete', role: 'owner' }
    await CoachCheckInsPage()
    expect(profilesInCalledWith).toEqual(['client-arete'])
  })

  it('resolves the other org\'s client when acting as that org instead', async () => {
    membership = { org_id: 'court-org', org_name: 'COURT', org_slug: 'court', role: 'owner' }
    await CoachCheckInsPage()
    expect(profilesInCalledWith).toEqual(['client-court'])
  })
})
