import { describe, it, expect, vi, beforeEach } from 'vitest'

// Regression test for the exact risk flagged when designing gym
// org-switching (enterGymOrg/exitToHomeOrg in lib/admin.ts): the platform
// admin's profiles.org_id is now mutable — it points at whichever gym she
// currently happens to be "acting as." canPublishMasterTemplate used to
// compare the template's org_id directly against profiles.org_id, which
// would make publishing intermittently fail depending on which gym she was
// "inside" at that moment, even though she owns both the template's org
// and the target org. It must resolve ownership via organisations.owner_id
// instead — this test never even provides a profiles.org_id value, to
// prove the function doesn't depend on it at all.

let profileRow: { role: string } | null = null
let templateRow: { org_id: string | null } | null = null
let orgOwnerId: string | null = null

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'profiles') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profileRow, error: null }) }) }) }
      }
      if (table === 'autoflow_templates') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: templateRow, error: null }) }) }) }
      }
      if (table === 'organisations') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: orgOwnerId ? { owner_id: orgOwnerId } : null, error: null }) }) }) }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  }),
}))

const { canPublishMasterTemplate } = await import('@/lib/org')

beforeEach(() => {
  profileRow = { role: 'platform_admin' }
  templateRow = { org_id: 'home-org-a' }
  orgOwnerId = 'admin-1'
})

describe('canPublishMasterTemplate — robust to the admin currently acting as a different org', () => {
  it('succeeds when the admin owns the template\'s org, regardless of any other org context', async () => {
    const allowed = await canPublishMasterTemplate('admin-1', 'template-1', 'autoflow_templates')
    expect(allowed).toBe(true)
  })

  it('fails when the template\'s org is owned by someone else', async () => {
    orgOwnerId = 'someone-else'
    const allowed = await canPublishMasterTemplate('admin-1', 'template-1', 'autoflow_templates')
    expect(allowed).toBe(false)
  })

  it('fails for a non-platform-admin even if they own the org', async () => {
    profileRow = { role: 'coach' }
    const allowed = await canPublishMasterTemplate('admin-1', 'template-1', 'autoflow_templates')
    expect(allowed).toBe(false)
  })

  it('fails when the template has no org_id at all', async () => {
    templateRow = { org_id: null }
    const allowed = await canPublishMasterTemplate('admin-1', 'template-1', 'autoflow_templates')
    expect(allowed).toBe(false)
  })
})
