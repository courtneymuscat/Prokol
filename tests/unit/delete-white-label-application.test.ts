import { describe, it, expect, vi, beforeEach } from 'vitest'

// deleteWhiteLabelApplication is the permanent, destructive reset — used to
// test the apply -> pay -> approve flow from a clean slate, or fully clear
// a gym partnership that fell through. Unlike revokeWhiteLabel (reversible),
// this deletes the application rows and nulls every branding field.
let orgsData: Record<string, unknown>[] = []
let applicationsData: Record<string, unknown>[] = []
const auditInserts: Record<string, unknown>[] = []
const removeDomainSpy = vi.fn(async (): Promise<{ removed: boolean; error?: string }> => ({ removed: true }))

vi.mock('@/lib/whitelabel', () => ({ notifyClientsOfBrandingChange: vi.fn(async () => ({ sent: 0 })) }))
vi.mock('@/lib/vercel', () => ({
  addDomainToVercel: vi.fn(async () => ({ verified: false })),
  removeDomainFromVercel: removeDomainSpy,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'organisations') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => {
                const row = orgsData[0]
                return { data: row ? { ...row } : null, error: null }
              },
            }),
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: async (_col: string, id: string) => {
              const row = orgsData.find((r) => r.id === id)
              if (row) Object.assign(row, patch)
              return { error: null }
            },
          }),
        }
      }
      if (table === 'white_label_applications') {
        return {
          delete: () => ({
            eq: async (_col: string, orgId: string) => {
              applicationsData = applicationsData.filter((a) => a.org_id !== orgId)
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

const { deleteWhiteLabelApplication } = await import('@/lib/admin')

beforeEach(() => {
  auditInserts.length = 0
  removeDomainSpy.mockClear()
  removeDomainSpy.mockResolvedValue({ removed: true })
  orgsData = [{
    id: 'org-1',
    name: 'Test Gym',
    is_white_label: true,
    white_label_tier: 'pro',
    app_name: 'Test Gym App',
    brand_colour: '#111',
    brand_colour_secondary: '#222',
    logo_url: 'https://cdn.test/logo.png',
    favicon_url: 'https://cdn.test/favicon.png',
    app_icon_url: 'https://cdn.test/icon.png',
    support_email: 'support@testgym.com',
    custom_domain: 'app.testgym.com',
    custom_domain_verified: true,
  }]
  applicationsData = [{ id: 'app-1', org_id: 'org-1', status: 'approved' }]
})

describe('deleteWhiteLabelApplication', () => {
  it('nulls every white-label field on the organisation', async () => {
    const result = await deleteWhiteLabelApplication('org-1', 'admin-1')
    expect(result.success).toBe(true)
    expect(orgsData[0]).toMatchObject({
      is_white_label: false,
      white_label_tier: null,
      app_name: null,
      brand_colour: null,
      brand_colour_secondary: null,
      logo_url: null,
      favicon_url: null,
      app_icon_url: null,
      support_email: null,
      custom_domain: null,
      custom_domain_verified: false,
      coach_seat_limit: 3,
    })
  })

  it('deletes the application row(s) for the org', async () => {
    await deleteWhiteLabelApplication('org-1', 'admin-1')
    expect(applicationsData.find((a) => a.org_id === 'org-1')).toBeUndefined()
  })

  it('unregisters the custom domain from Vercel when one is set', async () => {
    await deleteWhiteLabelApplication('org-1', 'admin-1')
    expect(removeDomainSpy).toHaveBeenCalledWith('app.testgym.com')
  })

  it('skips the Vercel call when there is no custom domain', async () => {
    orgsData[0].custom_domain = null
    await deleteWhiteLabelApplication('org-1', 'admin-1')
    expect(removeDomainSpy).not.toHaveBeenCalled()
  })

  it('writes an audit log entry recording the org name', async () => {
    await deleteWhiteLabelApplication('org-1', 'admin-1')
    expect(auditInserts[0]).toMatchObject({
      admin_id: 'admin-1',
      action: 'delete_white_label_application',
      target_org_id: 'org-1',
      old_value: 'Test Gym',
      new_value: null,
    })
  })

  it('errors without deleting anything when Vercel removal fails', async () => {
    removeDomainSpy.mockResolvedValue({ removed: false, error: 'Vercel down' })
    const result = await deleteWhiteLabelApplication('org-1', 'admin-1')
    expect(result.error).toBe('Vercel down')
    expect(applicationsData).toHaveLength(1)
    expect(orgsData[0].is_white_label).toBe(true)
  })
})
