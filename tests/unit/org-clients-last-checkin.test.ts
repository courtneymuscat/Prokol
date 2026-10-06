import { describe, it, expect, vi, beforeEach } from 'vitest'

// GET /api/org/clients used to compute "last check-in" from the raw daily
// check_ins table alone, so a client who only ever submits via a form
// (the primary way most coaches actually run check-ins) showed "Never"
// even with a recent submission. Must merge check_ins + autoflow_responses
// + form_submissions, same as the coach's own /coach/clients list.

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'owner-1' } } } }) },
  }),
}))

vi.mock('@/lib/org', () => ({
  requireOrgRole: async () => ({ org_id: 'org-1' }),
  getOrgForUser: async () => null,
  getCoachPermissions: async () => ({ can_view_all_clients: false }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'org_members') {
        return { select: () => ({ eq: () => ({ eq: async () => ({ data: [{ user_id: 'coach-1' }] }) }) }) }
      }
      if (table === 'coach_clients') {
        return {
          select: () => ({
            in: () => ({
              eq: async () => ({
                data: [
                  { client_id: 'client-form-only', coach_id: 'coach-1', accepted_at: '2026-01-01' },
                  { client_id: 'client-daily-only', coach_id: 'coach-1', accepted_at: '2026-01-01' },
                  { client_id: 'client-never', coach_id: 'coach-1', accepted_at: '2026-01-01' },
                ],
              }),
            }),
          }),
        }
      }
      if (table === 'profiles') {
        return { select: () => ({ in: async () => ({ data: [] }) }) }
      }
      if (table === 'check_ins') {
        return {
          select: () => ({
            in: () => ({
              or: () => ({
                order: async () => ({ data: [{ user_id: 'client-daily-only', created_at: '2026-10-05T00:00:00Z' }] }),
              }),
            }),
          }),
        }
      }
      if (table === 'autoflow_responses') {
        return { select: () => ({ in: () => ({ order: async () => ({ data: [] }) }) }) }
      }
      if (table === 'form_submissions') {
        return {
          select: () => ({
            in: () => ({
              order: async () => ({ data: [{ client_id: 'client-form-only', submitted_at: '2026-10-05T00:00:00Z' }] }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  }),
}))

const { GET } = await import('@/app/api/org/clients/route')

describe('GET /api/org/clients — last check-in sources', () => {
  it('counts a form submission as a check-in, not just the daily check_ins table', async () => {
    const res = await GET()
    const clients = await res.json()
    const formOnly = clients.find((c: { id: string }) => c.id === 'client-form-only')
    expect(formOnly.last_checkin_at).toBe('2026-10-05T00:00:00Z')
  })

  it('still counts a daily check_ins row', async () => {
    const res = await GET()
    const clients = await res.json()
    const dailyOnly = clients.find((c: { id: string }) => c.id === 'client-daily-only')
    expect(dailyOnly.last_checkin_at).toBe('2026-10-05T00:00:00Z')
  })

  it('shows null (never) only when no source has a submission', async () => {
    const res = await GET()
    const clients = await res.json()
    const never = clients.find((c: { id: string }) => c.id === 'client-never')
    expect(never.last_checkin_at).toBeNull()
  })
})
