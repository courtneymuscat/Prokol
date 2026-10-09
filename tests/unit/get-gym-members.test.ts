import { describe, it, expect, vi, beforeEach } from 'vitest'

// getGymMembers is the admin gym dashboard's client roster — scoped to
// BOTH the admin (coach_id) and the specific org_id, so a client never
// leaks into the wrong gym's roster if Court owns more than one. Clicking
// a row links straight into the existing /coach/clients/[clientId] page,
// so this function only needs to produce the list, not any client detail.

let coachClientsRows: { client_id: string; accepted_at: string; coach_id: string; org_id: string; status: string }[] = []
let profilesRows: { id: string; email: string; full_name: string | null; first_name: string | null }[] = []
let checkInsRows: { user_id: string; created_at: string }[] = []
let autoflowRespRows: { client_id: string; submitted_at: string }[] = []
let formSubRows: { client_id: string; submitted_at: string }[] = []

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'coach_clients') {
        return {
          select: () => ({
            eq: (col: string, val: string) => {
              const filtered = { col, val }
              return {
                eq: (col2: string, val2: string) => ({
                  eq: (col3: string, val3: string) => ({
                    order: async () => ({
                      data: coachClientsRows.filter((r) =>
                        (r as Record<string, unknown>)[filtered.col] === filtered.val &&
                        (r as Record<string, unknown>)[col2] === val2 &&
                        (r as Record<string, unknown>)[col3] === val3
                      ),
                      error: null,
                    }),
                  }),
                }),
              }
            },
          }),
        }
      }
      if (table === 'profiles') {
        return { select: () => ({ in: async (_col: string, ids: string[]) => ({ data: profilesRows.filter((p) => ids.includes(p.id)), error: null }) }) }
      }
      if (table === 'check_ins') {
        return { select: () => ({ in: () => ({ order: async () => ({ data: checkInsRows, error: null }) }) }) }
      }
      if (table === 'autoflow_responses') {
        return { select: () => ({ in: () => ({ order: async () => ({ data: autoflowRespRows, error: null }) }) }) }
      }
      if (table === 'form_submissions') {
        return { select: () => ({ in: () => ({ order: async () => ({ data: formSubRows, error: null }) }) }) }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  }),
}))

const { getGymMembers } = await import('@/lib/admin')

beforeEach(() => {
  coachClientsRows = [
    { client_id: 'client-1', accepted_at: '2026-01-01', coach_id: 'admin-1', org_id: 'gym-1', status: 'active' },
    { client_id: 'client-2', accepted_at: '2026-01-02', coach_id: 'admin-1', org_id: 'gym-1', status: 'active' },
    // Belongs to a DIFFERENT gym Court also owns — must not leak in.
    { client_id: 'client-3', accepted_at: '2026-01-03', coach_id: 'admin-1', org_id: 'gym-2', status: 'active' },
  ]
  profilesRows = [
    { id: 'client-1', email: 'one@test.com', full_name: 'Client One', first_name: null },
    { id: 'client-2', email: 'two@test.com', full_name: null, first_name: 'Two' },
  ]
  checkInsRows = [{ user_id: 'client-1', created_at: '2026-02-01T00:00:00Z' }]
  autoflowRespRows = [{ client_id: 'client-1', submitted_at: '2026-02-10T00:00:00Z' }]
  formSubRows = []
})

describe('getGymMembers', () => {
  it('only returns members of the specified org, not another gym Court owns', async () => {
    const members = await getGymMembers('gym-1', 'admin-1')
    expect(members.map((m) => m.id).sort()).toEqual(['client-1', 'client-2'])
  })

  it('falls back to first_name when full_name is not set', async () => {
    const members = await getGymMembers('gym-1', 'admin-1')
    expect(members.find((m) => m.id === 'client-2')?.name).toBe('Two')
  })

  it('picks the most recent activity across check-ins and autoflow responses', async () => {
    const members = await getGymMembers('gym-1', 'admin-1')
    expect(members.find((m) => m.id === 'client-1')?.lastActivity).toBe('2026-02-10T00:00:00Z')
  })

  it('reports null lastActivity for a member with no activity at all', async () => {
    const members = await getGymMembers('gym-1', 'admin-1')
    expect(members.find((m) => m.id === 'client-2')?.lastActivity).toBeNull()
  })

  it('returns an empty list when the gym has no members', async () => {
    coachClientsRows = []
    const members = await getGymMembers('gym-1', 'admin-1')
    expect(members).toEqual([])
  })
})
