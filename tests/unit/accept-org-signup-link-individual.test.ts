import { describe, it, expect, vi, beforeEach } from 'vitest'

// Companion to accept-org-signup-link.test.ts, covering the new
// individual-link branch (org_id null, coach_id set directly instead of
// resolved via organisations.owner_id) added when org_signup_links was
// unified to support both gym links and Court's own paid program links.

type Link = {
  id: string
  org_id: string | null
  coach_id: string | null
  protocol_sections: unknown
  is_active: boolean
}

let link: Link | null = null
const coachClientRows: Record<string, unknown>[] = []
const profileUpdates: Record<string, unknown>[] = []
let organisationsQueried = false
let whiteLabelSeatReportCalled = false

vi.mock('@/lib/billing', () => ({
  reportSeatUsage: vi.fn(async () => {}),
  reportWhiteLabelClientSeatUsage: vi.fn(async () => { whiteLabelSeatReportCalled = true }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'org_signup_links') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: link, error: link ? null : { code: 'PGRST116' } }),
            }),
          }),
        }
      }
      if (table === 'organisations') {
        organisationsQueried = true
        return { select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) }
      }
      if (table === 'coach_clients') {
        return {
          update: () => ({
            eq: () => ({ eq: () => ({ select: async () => ({ data: [], error: null }) }) }),
          }),
          insert: async (row: Record<string, unknown>) => { coachClientRows.push(row); return { error: null } },
        }
      }
      if (table === 'profiles') {
        return {
          update: (patch: Record<string, unknown>) => ({
            eq: async (_col: string, id: string) => { profileUpdates.push({ id, ...patch }); return { error: null } },
          }),
        }
      }
      if (table === 'org_signup_link_autoflows') {
        return { select: () => ({ eq: async () => ({ data: [], error: null }) }) }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  }),
}))

const { acceptOrgSignupLink } = await import('@/lib/coach')

beforeEach(() => {
  coachClientRows.length = 0
  profileUpdates.length = 0
  organisationsQueried = false
  whiteLabelSeatReportCalled = false
  link = {
    id: 'link-1',
    org_id: null,
    coach_id: 'court-coach-1',
    protocol_sections: null,
    is_active: true,
  }
})

describe('acceptOrgSignupLink — individual (non-gym) link', () => {
  it('resolves coach_id directly from the link, without querying organisations', async () => {
    await acceptOrgSignupLink('code-1', 'client-1')
    expect(organisationsQueried).toBe(false)
    expect(coachClientRows[0]).toMatchObject({ coach_id: 'court-coach-1', client_id: 'client-1', status: 'active' })
  })

  it('does not write org_id onto coach_clients or profiles', async () => {
    await acceptOrgSignupLink('code-1', 'client-1')
    expect(coachClientRows[0]).not.toHaveProperty('org_id')
    expect(profileUpdates[0]).not.toHaveProperty('org_id')
    expect(profileUpdates[0]).toMatchObject({ id: 'client-1', subscription_tier: 'coached' })
  })

  it('skips the white-label seat report — there is no org to report against', async () => {
    await acceptOrgSignupLink('code-1', 'client-1')
    expect(whiteLabelSeatReportCalled).toBe(false)
  })

  it('does nothing when the link has neither org_id nor coach_id', async () => {
    link!.coach_id = null
    await acceptOrgSignupLink('code-1', 'client-1')
    expect(coachClientRows).toHaveLength(0)
  })
})
