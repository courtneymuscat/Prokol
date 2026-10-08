import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WHITE_LABEL_COACH_SEAT_LIMIT, DEFAULT_COACH_SEAT_LIMIT } from '@/lib/billing'

// syncWhiteLabelTierForOwner is the single source of truth for what happens
// to an org's white-label status when its owner's Stripe tier changes —
// shared by the webhook and the self-serve change-plan route specifically
// so a downgrade away from wl_starter/wl_pro reliably turns branding off
// (see lib/whitelabel.ts's doc comment on the function for why a DB-read
// race made the old per-caller duplicated logic unreliable).

type OrgRow = {
  id: string
  owner_id: string
  is_white_label: boolean
  name: string
  white_label_tier: string | null
  coach_seat_limit: number
}

let org: OrgRow | null = null
const sentEmails: { to: string; subject: string }[] = []

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(async (opts: { to: string; subject: string }) => {
    sentEmails.push({ to: opts.to, subject: opts.subject })
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'organisations') {
        return {
          select: () => ({
            eq: (_col: string, ownerId: string) => ({
              maybeSingle: async () => ({
                data: org && org.owner_id === ownerId ? org : null,
                error: null,
              }),
            }),
          }),
          update: (patch: Partial<OrgRow>) => ({
            eq: async () => {
              if (org) Object.assign(org, patch)
              return { error: null }
            },
          }),
        }
      }
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { email: 'owner@test.com', full_name: 'Owner' },
                error: null,
              }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  }),
}))

const { syncWhiteLabelTierForOwner } = await import('@/lib/whitelabel')

beforeEach(() => {
  sentEmails.length = 0
  org = {
    id: 'org-1',
    owner_id: 'owner-1',
    is_white_label: true,
    name: 'COURT',
    white_label_tier: 'starter',
    coach_seat_limit: WHITE_LABEL_COACH_SEAT_LIMIT.starter,
  }
})

describe('syncWhiteLabelTierForOwner', () => {
  it('turns white-label off and emails the owner when downgrading away from a wl tier', async () => {
    await syncWhiteLabelTierForOwner('owner-1', 'wl_starter', 'coach_business')

    expect(org).toMatchObject({
      is_white_label: false,
      white_label_tier: null,
      coach_seat_limit: DEFAULT_COACH_SEAT_LIMIT,
    })
    expect(sentEmails).toHaveLength(1)
    expect(sentEmails[0]).toMatchObject({
      to: 'owner@test.com',
      subject: 'Your white-label branding has been turned off',
    })
  })

  it('syncs the tier (no email) when switching between wl_starter and wl_pro', async () => {
    await syncWhiteLabelTierForOwner('owner-1', 'wl_starter', 'wl_pro')

    expect(org).toMatchObject({
      is_white_label: true,
      white_label_tier: 'pro',
      coach_seat_limit: WHITE_LABEL_COACH_SEAT_LIMIT.pro,
    })
    expect(sentEmails).toHaveLength(0)
  })

  it('does nothing when the org is not actually white-labelled', async () => {
    org!.is_white_label = false
    const before = { ...org! }

    await syncWhiteLabelTierForOwner('owner-1', 'wl_starter', 'coach_business')

    expect(org).toEqual(before)
    expect(sentEmails).toHaveLength(0)
  })

  it('does nothing when neither tier is a white-label tier', async () => {
    const before = { ...org! }

    await syncWhiteLabelTierForOwner('owner-1', 'coach_pro', 'coach_business')

    expect(org).toEqual(before)
    expect(sentEmails).toHaveLength(0)
  })
})
