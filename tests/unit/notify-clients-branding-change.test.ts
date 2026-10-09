import { describe, it, expect, vi, beforeEach } from 'vitest'

// notifyClientsOfBrandingChange emails every active client of an org when
// its white-label branding goes live, telling them to remove and re-add
// their home-screen icon (the one piece of white-label that can't update
// itself remotely — manifests are snapshotted at install time).
const sentEmails: { to: string; subject: string; html: string }[] = []

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(async (opts: { to: string; subject: string; html: string }) => {
    sentEmails.push(opts)
  }),
}))

let orgRow: Record<string, unknown> | null = null
let orgMembersRows: { user_id: string }[] = []
let coachClientsRows: { client_id: string }[] = []
let profileRows: { id: string; email: string | null; full_name: string | null }[] = []

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'organisations') {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: orgRow, error: null }) }) }) }
      }
      if (table === 'org_members') {
        return { select: () => ({ eq: () => ({ eq: async () => ({ data: orgMembersRows }) }) }) }
      }
      if (table === 'coach_clients') {
        return { select: () => ({ in: () => ({ eq: async () => ({ data: coachClientsRows }) }) }) }
      }
      if (table === 'profiles') {
        return { select: () => ({ in: async () => ({ data: profileRows }) }) }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  }),
}))

const { notifyClientsOfBrandingChange } = await import('@/lib/whitelabel')

beforeEach(() => {
  sentEmails.length = 0
  orgRow = { name: 'Pro Gym Org', app_name: 'Pro Gym' }
  orgMembersRows = [{ user_id: 'coach-1' }]
  coachClientsRows = [{ client_id: 'client-1' }, { client_id: 'client-2' }]
  profileRows = [
    { id: 'client-1', email: 'one@test.com', full_name: 'One' },
    { id: 'client-2', email: 'two@test.com', full_name: 'Two' },
  ]
})

describe('notifyClientsOfBrandingChange', () => {
  it('emails every active client of the org', async () => {
    const result = await notifyClientsOfBrandingChange('org-1')
    expect(result.sent).toBe(2)
    expect(sentEmails).toHaveLength(2)
    expect(sentEmails.map(e => e.to).sort()).toEqual(['one@test.com', 'two@test.com'])
    expect(sentEmails[0].subject).toContain('Pro Gym')
  })

  it('always links to the plain app URL — domains/subdomains were removed entirely', async () => {
    // Branding follows login, so the plain URL already shows the right
    // branding once logged in; no per-org domain needed for this to work.
    await notifyClientsOfBrandingChange('org-1')
    expect(sentEmails[0].html).not.toContain('pro-gym.prokol.io')
  })

  it('sends nothing when the org has no active coaches', async () => {
    orgMembersRows = []
    const result = await notifyClientsOfBrandingChange('org-1')
    expect(result.sent).toBe(0)
    expect(sentEmails).toHaveLength(0)
  })

  it('sends nothing when no clients are active', async () => {
    coachClientsRows = []
    const result = await notifyClientsOfBrandingChange('org-1')
    expect(result.sent).toBe(0)
  })

  it('returns zero when the org cannot be found', async () => {
    orgRow = null
    const result = await notifyClientsOfBrandingChange('org-1')
    expect(result.sent).toBe(0)
    expect(sentEmails).toHaveLength(0)
  })
})
