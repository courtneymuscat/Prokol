import { describe, it, expect, vi, beforeEach } from 'vitest'

// Regression test for the exact bug Court hit testing her first gym: the
// SAME coach (her platform-admin account) owns more than one organisation
// now (gym org-switching, lib/admin.ts enterGymOrg), so a coach_clients
// query that filters only by coach_id — not org_id — pulls every org's
// clients into every other org's client list. Unlike the other tests for
// this route (org-clients-last-checkin.test.ts), this mock actually
// honours the org_id filter rather than ignoring it, so it would have
// caught the original bug.

type ClientRow = { client_id: string; coach_id: string; org_id: string; accepted_at: string }

let clientRows: ClientRow[] = []

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'admin-1' } } } }) },
  }),
}))

vi.mock('@/lib/org', () => ({
  requireOrgRole: async (_userId: string, _role: string) => ({ org_id: 'gym-a' }),
  getOrgForUser: async () => null,
  getCoachPermissions: async () => ({ can_view_all_clients: false }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'org_members') {
        return { select: () => ({ eq: () => ({ eq: async () => ({ data: [{ user_id: 'admin-1' }] }) }) }) }
      }
      if (table === 'coach_clients') {
        return {
          select: () => ({
            in: (_col: string, coachIds: string[]) => ({
              eq: (_c1: string, orgId: string) => ({
                eq: async (_c2: string, status: string) => ({
                  data: clientRows.filter((r) => coachIds.includes(r.coach_id) && r.org_id === orgId && status === 'active'),
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'profiles') {
        return { select: () => ({ in: async () => ({ data: [] }) }) }
      }
      if (table === 'check_ins') {
        return { select: () => ({ in: () => ({ or: () => ({ order: async () => ({ data: [] }) }) }) }) }
      }
      if (table === 'autoflow_responses' || table === 'form_submissions') {
        return { select: () => ({ in: () => ({ order: async () => ({ data: [] }) }) }) }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  }),
}))

const { GET } = await import('@/app/api/org/clients/route')

beforeEach(() => {
  // Same coach_id (admin-1) owns both orgs — exactly Court's real situation
  // once she owns more than one gym.
  clientRows = [
    { client_id: 'client-court', coach_id: 'admin-1', org_id: 'court-org', accepted_at: '2026-01-01' },
    { client_id: 'client-gym-a', coach_id: 'admin-1', org_id: 'gym-a', accepted_at: '2026-02-01' },
  ]
})

describe('GET /api/org/clients — does not leak clients across orgs owned by the same coach', () => {
  it('only returns clients tagged to the currently active org, not every org this coach owns', async () => {
    const res = await GET()
    const clients = await res.json()
    expect(clients.map((c: { id: string }) => c.id)).toEqual(['client-gym-a'])
  })
})
