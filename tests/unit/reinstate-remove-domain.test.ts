import { describe, it, expect, vi, beforeEach } from 'vitest'

let orgsData: Record<string, unknown>[] = []
const auditInserts: Record<string, unknown>[] = []
let latestApprovedApp: { requested_tier: string } | null = null

const notifySpy = vi.fn(async () => ({ sent: 0 }))
const removeDomainSpy = vi.fn(async (): Promise<{ removed: boolean; error?: string }> => ({ removed: true }))

vi.mock('@/lib/whitelabel', () => ({ notifyClientsOfBrandingChange: notifySpy }))
vi.mock('@/lib/vercel', () => ({ removeDomainFromVercel: removeDomainSpy }))

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
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({ data: latestApprovedApp, error: null }),
                  }),
                }),
              }),
            }),
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

const { reinstateWhiteLabel, removeWhiteLabelDomain } = await import('@/lib/admin')

beforeEach(() => {
  auditInserts.length = 0
  notifySpy.mockClear()
  removeDomainSpy.mockClear()
  removeDomainSpy.mockResolvedValue({ removed: true })
  latestApprovedApp = { requested_tier: 'pro' }
  orgsData = [{
    id: 'org-1',
    is_white_label: false,
    white_label_tier: null,
    custom_domain: 'app.gym.com',
    custom_domain_verified: true,
  }]
})

describe('reinstateWhiteLabel', () => {
  it('turns is_white_label back on using the org\'s latest approved application tier', async () => {
    const result = await reinstateWhiteLabel('org-1', 'admin-1')
    expect(result.success).toBe(true)
    expect(orgsData[0].is_white_label).toBe(true)
    expect(orgsData[0].white_label_tier).toBe('pro')
  })

  it('notifies active clients that branding is live again', async () => {
    await reinstateWhiteLabel('org-1', 'admin-1')
    expect(notifySpy).toHaveBeenCalledWith('org-1')
  })

  it('writes an audit log entry', async () => {
    await reinstateWhiteLabel('org-1', 'admin-1')
    expect(auditInserts).toHaveLength(1)
    expect(auditInserts[0]).toMatchObject({
      admin_id: 'admin-1',
      action: 'reinstate_white_label',
      target_org_id: 'org-1',
      new_value: 'pro',
    })
  })

  it('errors without reinstating when there is no approved application', async () => {
    latestApprovedApp = null
    const result = await reinstateWhiteLabel('org-1', 'admin-1')
    expect(result.error).toBeTruthy()
    expect(orgsData[0].is_white_label).toBe(false)
    expect(notifySpy).not.toHaveBeenCalled()
  })
})

describe('removeWhiteLabelDomain', () => {
  it('clears the custom domain and unregisters it from Vercel', async () => {
    const result = await removeWhiteLabelDomain('org-1', 'admin-1')
    expect(result.success).toBe(true)
    expect(removeDomainSpy).toHaveBeenCalledWith('app.gym.com')
    expect(orgsData[0].custom_domain).toBeNull()
    expect(orgsData[0].custom_domain_verified).toBe(false)
  })

  it('writes an audit log entry recording the removed domain', async () => {
    await removeWhiteLabelDomain('org-1', 'admin-1')
    expect(auditInserts[0]).toMatchObject({
      action: 'remove_white_label_domain',
      target_org_id: 'org-1',
      old_value: 'app.gym.com',
      new_value: null,
    })
  })

  it('errors when the org has no custom domain to remove', async () => {
    orgsData[0].custom_domain = null
    const result = await removeWhiteLabelDomain('org-1', 'admin-1')
    expect(result.error).toBeTruthy()
    expect(removeDomainSpy).not.toHaveBeenCalled()
  })

  it('errors without touching the database when the Vercel removal fails', async () => {
    removeDomainSpy.mockResolvedValue({ removed: false, error: 'Vercel down' })
    const result = await removeWhiteLabelDomain('org-1', 'admin-1')
    expect(result.error).toBe('Vercel down')
    expect(orgsData[0].custom_domain).toBe('app.gym.com')
  })
})
