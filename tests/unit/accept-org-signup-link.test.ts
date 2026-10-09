import { describe, it, expect, vi, beforeEach } from 'vitest'

// acceptOrgSignupLink mirrors acceptInvite's proven autoflow-enrollment
// logic, but for a gym's reusable signup link rather than a per-recipient
// coach_invites token: no single-use gate (every distinct signup runs full
// enrollment), coach_id is always the org's owner, and it can enroll
// multiple autoflows plus an optional protocol. Deliberately does NOT set
// onboarding_completed or any macro targets — a gym has no coaching staff
// to set those manually, so the member gets their own targets from the
// self-service TDEE onboarding flow they complete right after signing up.

type Link = {
  id: string
  org_id: string
  protocol_sections: unknown
  is_active: boolean
}

let link: Link | null = null
const orgOwnerId = 'owner-1'
const coachClientRows: Record<string, unknown>[] = []
const profileUpdates: Record<string, unknown>[] = []
const clientAutoflowRows: Record<string, unknown>[] = []
const calendarEventRows: Record<string, unknown>[] = []
const protocolUpserts: Record<string, unknown>[] = []
const linkAutoflowIds: string[] = []

const TEMPLATE = { id: 'autoflow-1', name: 'Nutrition Check-in', total_steps: 2 }
const STEPS = [
  { step_number: 1, title: 'Welcome', day_offset: 0, trigger_type: 'automated' },
  { step_number: 2, title: 'Week 1', day_offset: 7, trigger_type: 'on_step_complete' },
]

vi.mock('@/lib/billing', () => ({
  reportSeatUsage: vi.fn(async () => {}),
  reportWhiteLabelClientSeatUsage: vi.fn(async () => {}),
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
        return {
          select: () => ({ eq: () => ({ single: async () => ({ data: { owner_id: orgOwnerId }, error: null }) }) }),
        }
      }
      if (table === 'coach_clients') {
        return {
          // Every test signs up a brand-new client, so the update-then-insert
          // pattern always falls through to insert — matching real behaviour
          // for a genuinely new signup (no pre-existing coach_clients row).
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
        return {
          select: () => ({
            eq: async () => ({ data: linkAutoflowIds.map((autoflow_id) => ({ autoflow_id })), error: null }),
          }),
        }
      }
      if (table === 'autoflow_templates') {
        return {
          select: () => ({
            eq: (_col: string, id: string) => ({
              single: async () => ({ data: id === TEMPLATE.id ? TEMPLATE : null, error: null }),
            }),
          }),
        }
      }
      if (table === 'client_autoflows') {
        return {
          insert: (row: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                clientAutoflowRows.push(row)
                return { data: { id: `flow-${clientAutoflowRows.length}` }, error: null }
              },
            }),
          }),
        }
      }
      if (table === 'autoflow_template_steps') {
        return {
          select: () => ({ eq: () => ({ order: async () => ({ data: STEPS, error: null }) }) }),
        }
      }
      if (table === 'calendar_events') {
        return { insert: async (rows: Record<string, unknown>[]) => { calendarEventRows.push(...rows); return { error: null } } }
      }
      if (table === 'client_protocol') {
        return { upsert: async (row: Record<string, unknown>) => { protocolUpserts.push(row); return { error: null } } }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  }),
}))

const { acceptOrgSignupLink } = await import('@/lib/coach')

beforeEach(() => {
  coachClientRows.length = 0
  profileUpdates.length = 0
  clientAutoflowRows.length = 0
  calendarEventRows.length = 0
  protocolUpserts.length = 0
  linkAutoflowIds.length = 0
  link = {
    id: 'link-1',
    org_id: 'gym-org-1',
    protocol_sections: null,
    is_active: true,
  }
})

describe('acceptOrgSignupLink', () => {
  it('does nothing when the link code is not found', async () => {
    link = null
    await acceptOrgSignupLink('bad-code', 'client-1')
    expect(coachClientRows).toHaveLength(0)
  })

  it('does nothing when the link is inactive', async () => {
    link!.is_active = false
    await acceptOrgSignupLink('code-1', 'client-1')
    expect(coachClientRows).toHaveLength(0)
  })

  it('creates a coach_clients row with the org owner as coach_id', async () => {
    await acceptOrgSignupLink('code-1', 'client-1')
    expect(coachClientRows[0]).toMatchObject({ coach_id: orgOwnerId, client_id: 'client-1', status: 'active', org_id: 'gym-org-1' })
  })

  it('sets profile org_id and subscription_tier, but leaves onboarding_completed untouched', async () => {
    await acceptOrgSignupLink('code-1', 'client-1')
    expect(profileUpdates[0]).toMatchObject({ id: 'client-1', org_id: 'gym-org-1', subscription_tier: 'coached' })
    expect(profileUpdates[0]).not.toHaveProperty('onboarding_completed')
  })

  it('enrolls every autoflow attached to the link, each starting today', async () => {
    linkAutoflowIds.push(TEMPLATE.id)
    await acceptOrgSignupLink('code-1', 'client-1')
    const today = new Date().toISOString().split('T')[0]
    expect(clientAutoflowRows).toHaveLength(1)
    expect(clientAutoflowRows[0]).toMatchObject({ coach_id: orgOwnerId, client_id: 'client-1', template_id: TEMPLATE.id, start_date: today })
  })

  it('creates calendar_events only for non on_step_complete steps', async () => {
    linkAutoflowIds.push(TEMPLATE.id)
    await acceptOrgSignupLink('code-1', 'client-1')
    expect(calendarEventRows).toHaveLength(1)
    expect(calendarEventRows[0]).toMatchObject({ client_id: 'client-1', type: 'autoflow' })
  })

  it('upserts client_protocol only when the link has protocol_sections', async () => {
    link!.protocol_sections = [{ title: 'Supplements' }]
    await acceptOrgSignupLink('code-1', 'client-1')
    expect(protocolUpserts).toHaveLength(1)
    expect(protocolUpserts[0]).toMatchObject({ client_id: 'client-1', coach_id: orgOwnerId, sections: [{ title: 'Supplements' }] })
  })

  it('does not touch client_protocol when none is set on the link', async () => {
    await acceptOrgSignupLink('code-1', 'client-1')
    expect(protocolUpserts).toHaveLength(0)
  })

  it('never writes macro target fields — those come from the member\'s own onboarding', async () => {
    await acceptOrgSignupLink('code-1', 'client-1')
    const macroUpdate = profileUpdates.find((u) => 'target_calories' in u)
    expect(macroUpdate).toBeUndefined()
  })

  it('is reusable — a second, different signup against the same code also fully enrolls', async () => {
    linkAutoflowIds.push(TEMPLATE.id)
    await acceptOrgSignupLink('code-1', 'client-1')
    await acceptOrgSignupLink('code-1', 'client-2')
    expect(coachClientRows.map((r) => r.client_id)).toEqual(['client-1', 'client-2'])
    expect(clientAutoflowRows.map((r) => r.client_id)).toEqual(['client-1', 'client-2'])
  })
})
