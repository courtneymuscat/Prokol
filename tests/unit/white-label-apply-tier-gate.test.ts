import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

// Applying for white-label now requires already being on the wl_starter or
// wl_pro Stripe tier (paid via the existing self-serve checkout flow) —
// not just coach_business. requested_tier must be derived from whichever
// tier they're actually paying for, not hardcoded.
let profilesData: Record<string, unknown>[] = []
const insertedApplications: Record<string, unknown>[] = []

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'user-1' } } } }) },
  }),
}))

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(async () => {}),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'profiles') {
        let rows = [...profilesData]
        return {
          select: () => ({
            eq: (col: string, val: unknown) => {
              rows = rows.filter((r) => r[col] === val)
              return { single: async () => ({ data: rows[0] ?? null, error: null }) }
            },
          }),
        }
      }
      if (table === 'white_label_applications') {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                limit: () => ({ single: async () => ({ data: null, error: null }) }),
              }),
            }),
          }),
          insert: (row: Record<string, unknown>) => {
            insertedApplications.push(row)
            return { select: () => ({ single: async () => ({ data: { id: 'app-1' }, error: null }) }) }
          },
        }
      }
      if (table === 'organisations') {
        return {
          select: () => ({ eq: () => ({ single: async () => ({ data: { name: 'Test Org' }, error: null }) }) }),
        }
      }
      throw new Error(`unexpected table: ${table}`)
    },
    storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
  }),
}))

const { POST } = await import('@/app/api/org/white-label/apply/route')

function fakeRequest(fields: Record<string, string>): NextRequest {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  return { formData: async () => fd } as unknown as NextRequest
}

const BASE_FIELDS = { appName: 'Test App', brandColour: '#123456', supportEmail: 'support@test.com' }

beforeEach(() => {
  insertedApplications.length = 0
})

describe('POST /api/org/white-label/apply — tier gate', () => {
  it('rejects a coach_business (non-white-label) account', async () => {
    profilesData = [{ id: 'user-1', org_id: 'org-1', subscription_tier: 'coach_business' }]
    const res = await POST(fakeRequest(BASE_FIELDS))
    expect(res.status).toBe(403)
    expect(insertedApplications).toHaveLength(0)
  })

  it('accepts wl_starter and sets requested_tier to "starter"', async () => {
    profilesData = [{ id: 'user-1', org_id: 'org-1', subscription_tier: 'wl_starter' }]
    const res = await POST(fakeRequest(BASE_FIELDS))
    expect(res.status).toBe(200)
    expect(insertedApplications[0].requested_tier).toBe('starter')
  })

  it('accepts wl_pro and sets requested_tier to "pro"', async () => {
    profilesData = [{ id: 'user-1', org_id: 'org-1', subscription_tier: 'wl_pro' }]
    const res = await POST(fakeRequest(BASE_FIELDS))
    expect(res.status).toBe(200)
    expect(insertedApplications[0].requested_tier).toBe('pro')
  })

  it('allows submitting with no custom domain at all (free subdomain only)', async () => {
    profilesData = [{ id: 'user-1', org_id: 'org-1', subscription_tier: 'wl_starter' }]
    const res = await POST(fakeRequest(BASE_FIELDS))
    expect(res.status).toBe(200)
    expect(insertedApplications[0].custom_domain).toBeNull()
  })
})
