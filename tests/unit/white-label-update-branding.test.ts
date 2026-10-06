import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

// Editing branding after approval is self-serve and goes live immediately —
// no re-approval needed, since Court already vetted the org once. Only an
// icon/name-relevant change (not a colour tweak) should re-trigger the
// "re-add your home screen icon" client email.
let profilesData: Record<string, unknown>[] = []
let orgCurrent: Record<string, unknown> | null = null
let orgUpdatePatch: Record<string, unknown> | null = null

const notifySpy = vi.fn(async () => ({ sent: 0 }))
vi.mock('@/lib/whitelabel', () => ({ notifyClientsOfBrandingChange: notifySpy }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'user-1' } } } }) },
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'profiles') {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: profilesData[0] ?? null, error: null }) }) }) }
      }
      if (table === 'organisations') {
        return {
          select: () => ({ eq: () => ({ single: async () => ({ data: orgCurrent, error: null }) }) }),
          update: (patch: Record<string, unknown>) => ({
            eq: async () => { orgUpdatePatch = patch; return { error: null } },
          }),
        }
      }
      throw new Error(`unexpected table: ${table}`)
    },
    storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: 'https://cdn.test/new-asset.png' } }) }) },
  }),
}))

const { POST } = await import('@/app/api/org/white-label/update-branding/route')

function fakeRequest(fields: Record<string, string>): NextRequest {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  return { formData: async () => fd } as unknown as NextRequest
}

const BASE_FIELDS = { appName: 'Updated Name', brandColour: '#654321', supportEmail: 'support@test.com' }

beforeEach(() => {
  orgUpdatePatch = null
  notifySpy.mockClear()
  profilesData = [{ id: 'user-1', org_id: 'org-1' }]
  orgCurrent = {
    is_white_label: true,
    app_name: 'Old Name',
    logo_url: 'https://cdn.test/old-logo.png',
    favicon_url: 'https://cdn.test/old-favicon.png',
    app_icon_url: 'https://cdn.test/old-icon.png',
  }
})

describe('POST /api/org/white-label/update-branding', () => {
  it('rejects when the org is not white-labelled', async () => {
    orgCurrent = { ...orgCurrent, is_white_label: false }
    const res = await POST(fakeRequest(BASE_FIELDS))
    expect(res.status).toBe(403)
    expect(orgUpdatePatch).toBeNull()
  })

  it('saves the new fields', async () => {
    const res = await POST(fakeRequest(BASE_FIELDS))
    expect(res.status).toBe(200)
    expect(orgUpdatePatch).toMatchObject({ app_name: 'Updated Name', brand_colour: '#654321', support_email: 'support@test.com' })
  })

  it('keeps existing asset URLs when no new file is uploaded', async () => {
    await POST(fakeRequest(BASE_FIELDS))
    expect(orgUpdatePatch).toMatchObject({
      logo_url: 'https://cdn.test/old-logo.png',
      favicon_url: 'https://cdn.test/old-favicon.png',
      app_icon_url: 'https://cdn.test/old-icon.png',
    })
  })

  it('notifies clients when the app name changes', async () => {
    await POST(fakeRequest(BASE_FIELDS))
    expect(notifySpy).toHaveBeenCalledWith('org-1')
  })

  it('does not notify clients for a colour-only change', async () => {
    await POST(fakeRequest({ ...BASE_FIELDS, appName: 'Old Name' }))
    expect(notifySpy).not.toHaveBeenCalled()
  })
})
