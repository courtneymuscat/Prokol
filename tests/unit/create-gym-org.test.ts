import { describe, it, expect, vi, beforeEach } from 'vitest'

// createGymOrg is used instead of the self-serve app/api/org/setup/route.ts
// (hard-wired to the calling session's own user id) to let a platform admin
// create an organisation owned by themselves, marked white-label
// immediately with no Stripe/billing involved — see lib/admin.ts's doc
// comment on the function.

const orgRows: Record<string, unknown>[] = []
const orgMemberRows: Record<string, unknown>[] = []
const auditLogRows: Record<string, unknown>[] = []
let existingSlug: string | null = null

vi.mock('@/lib/billing', () => ({
  WHITE_LABEL_COACH_SEAT_LIMIT: { starter: 5, pro: 10 },
  DEFAULT_COACH_SEAT_LIMIT: 3,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'organisations') {
        return {
          select: () => ({
            eq: (_col: string, slug: string) => ({
              maybeSingle: async () => ({ data: slug === existingSlug ? { id: 'existing-org' } : null, error: null }),
            }),
          }),
          insert: (row: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                orgRows.push(row)
                return { data: { id: 'org-new', slug: row.slug as string }, error: null }
              },
            }),
          }),
        }
      }
      if (table === 'org_members') {
        return { insert: async (row: Record<string, unknown>) => { orgMemberRows.push(row); return { error: null } } }
      }
      if (table === 'admin_audit_log') {
        return { insert: async (row: Record<string, unknown>) => { auditLogRows.push(row); return { error: null } } }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  }),
}))

const { createGymOrg } = await import('@/lib/admin')

beforeEach(() => {
  orgRows.length = 0
  orgMemberRows.length = 0
  auditLogRows.length = 0
  existingSlug = null
})

describe('createGymOrg', () => {
  it('creates an org owned by the admin, white-labelled, with the starter coach seat limit', async () => {
    const result = await createGymOrg({ name: 'Peak Performance Gym' }, 'admin-1')
    expect(result.data).toEqual({ id: 'org-new', slug: 'peak-performance-gym' })
    expect(orgRows[0]).toMatchObject({
      owner_id: 'admin-1',
      tenant_type: 'coaching_business',
      is_white_label: true,
      white_label_tier: 'starter',
      coach_seat_limit: 5,
      app_name: 'Peak Performance Gym',
    })
  })

  it('adds the admin as the owner org_member', async () => {
    await createGymOrg({ name: 'Peak Performance Gym' }, 'admin-1')
    expect(orgMemberRows[0]).toMatchObject({ org_id: 'org-new', user_id: 'admin-1', role: 'owner', is_active: true })
  })

  it('writes an admin_audit_log entry', async () => {
    await createGymOrg({ name: 'Peak Performance Gym' }, 'admin-1')
    expect(auditLogRows[0]).toMatchObject({ admin_id: 'admin-1', action: 'create_gym_org', target_org_id: 'org-new' })
  })

  it('appends a random suffix when the slug already exists', async () => {
    existingSlug = 'peak-performance-gym'
    await createGymOrg({ name: 'Peak Performance Gym' }, 'admin-1')
    expect(orgRows[0].slug).not.toBe('peak-performance-gym')
    expect(orgRows[0].slug).toMatch(/^peak-performance-gym-/)
  })

  it('rejects an empty name', async () => {
    const result = await createGymOrg({ name: '   ' }, 'admin-1')
    expect(result.error).toBeTruthy()
    expect(orgRows).toHaveLength(0)
  })

  it('uses the provided appName/brandColour over the gym name default', async () => {
    await createGymOrg({ name: 'Peak Performance Gym', appName: 'PP Fitness', brandColour: '#FF0000' }, 'admin-1')
    expect(orgRows[0]).toMatchObject({ app_name: 'PP Fitness', brand_colour: '#FF0000' })
  })
})
