import { describe, it, expect, vi, beforeEach } from 'vitest'

// enterGymOrg/exitToHomeOrg let the platform admin "become" the real
// owner-coach of a gym she owns, reusing the entire coach dashboard.
// Exactly one org_members row stays is_active at a time, which is what
// keeps getOrgForUser()'s existing `.single()` query working unmodified
// across every one of the 24+ files that already call it.

type OrgMemberRow = { org_id: string; user_id: string; role: string; is_active: boolean }

let orgsData: Record<string, unknown>[] = []
let orgMembersData: OrgMemberRow[] = []
let profilesData: Record<string, unknown>[] = []
const auditInserts: Record<string, unknown>[] = []

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'organisations') {
        return {
          select: () => ({
            eq: (_col: string, id: string) => ({
              maybeSingle: async () => ({ data: orgsData.find((o) => o.id === id) ?? null, error: null }),
            }),
          }),
        }
      }
      if (table === 'org_members') {
        return {
          update: (patch: Partial<OrgMemberRow>) => ({
            eq: async (_col: string, userId: string) => {
              for (const row of orgMembersData) {
                if (row.user_id === userId) Object.assign(row, patch)
              }
              return { error: null }
            },
          }),
          upsert: async (row: OrgMemberRow) => {
            const existing = orgMembersData.find((r) => r.org_id === row.org_id && r.user_id === row.user_id)
            if (existing) Object.assign(existing, row)
            else orgMembersData.push({ ...row })
            return { error: null }
          },
        }
      }
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: (_col: string, id: string) => ({
              maybeSingle: async () => ({ data: profilesData.find((p) => p.id === id) ?? null, error: null }),
            }),
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: async (_col: string, id: string) => {
              const row = profilesData.find((p) => p.id === id)
              if (row) Object.assign(row, patch)
              return { error: null }
            },
          }),
        }
      }
      if (table === 'admin_audit_log') {
        return { insert: async (row: Record<string, unknown>) => { auditInserts.push(row); return { error: null } } }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  }),
}))

const { enterGymOrg, exitToHomeOrg } = await import('@/lib/admin')

beforeEach(() => {
  auditInserts.length = 0
  orgsData = [
    { id: 'court-org', name: 'COURT', owner_id: 'admin-1' },
    { id: 'gym-a', name: 'Gym A', owner_id: 'admin-1' },
    { id: 'gym-b', name: 'Gym B', owner_id: 'someone-else' },
  ]
  orgMembersData = [
    { org_id: 'court-org', user_id: 'admin-1', role: 'owner', is_active: true },
  ]
  profilesData = [
    { id: 'admin-1', org_id: 'court-org', home_org_id: 'court-org' },
  ]
})

describe('enterGymOrg', () => {
  it('rejects entering an org the admin does not own', async () => {
    const result = await enterGymOrg('gym-b', 'admin-1')
    expect(result.error).toBeTruthy()
    expect(profilesData[0].org_id).toBe('court-org')
  })

  it('deactivates every other membership and activates the target org', async () => {
    await enterGymOrg('gym-a', 'admin-1')
    const active = orgMembersData.filter((r) => r.user_id === 'admin-1' && r.is_active)
    expect(active).toHaveLength(1)
    expect(active[0].org_id).toBe('gym-a')
  })

  it('creates the org_members row if it does not already exist', async () => {
    orgMembersData = [{ org_id: 'court-org', user_id: 'admin-1', role: 'owner', is_active: true }]
    await enterGymOrg('gym-a', 'admin-1')
    expect(orgMembersData.find((r) => r.org_id === 'gym-a' && r.user_id === 'admin-1')).toMatchObject({ role: 'owner', is_active: true })
  })

  it('updates profiles.org_id to the entered gym', async () => {
    await enterGymOrg('gym-a', 'admin-1')
    expect(profilesData[0].org_id).toBe('gym-a')
  })

  it('writes an audit log entry', async () => {
    await enterGymOrg('gym-a', 'admin-1')
    expect(auditInserts[0]).toMatchObject({ admin_id: 'admin-1', action: 'enter_gym_org', target_org_id: 'gym-a' })
  })
})

describe('exitToHomeOrg', () => {
  it('errors cleanly when home_org_id is not set', async () => {
    profilesData[0].home_org_id = null
    const result = await exitToHomeOrg('admin-1')
    expect(result.error).toBeTruthy()
  })

  it('restores the home org as the single active membership and resets profiles.org_id', async () => {
    await enterGymOrg('gym-a', 'admin-1')
    await exitToHomeOrg('admin-1')
    const active = orgMembersData.filter((r) => r.user_id === 'admin-1' && r.is_active)
    expect(active).toHaveLength(1)
    expect(active[0].org_id).toBe('court-org')
    expect(profilesData[0].org_id).toBe('court-org')
  })
})
