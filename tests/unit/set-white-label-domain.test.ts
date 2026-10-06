import { describe, it, expect, vi, beforeEach } from 'vitest'

// setWhiteLabelDomain is the admin-only replacement for the self-serve
// custom-domain field removed from the application form — Court can still
// assign a domain directly when setting up a gym org herself.
let orgsData: Record<string, unknown>[] = []
const auditInserts: Record<string, unknown>[] = []
let existingDomainOwner: { id: string } | null = null

const addDomainSpy = vi.fn(async (): Promise<{ verified: boolean; error?: string }> => ({ verified: false }))

vi.mock('@/lib/whitelabel', () => ({ notifyClientsOfBrandingChange: vi.fn(async () => ({ sent: 0 })) }))
vi.mock('@/lib/vercel', () => ({
  addDomainToVercel: addDomainSpy,
  removeDomainFromVercel: vi.fn(async () => ({ removed: true })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'organisations') {
        return {
          select: () => ({
            eq: () => ({
              neq: () => ({
                maybeSingle: async () => ({ data: existingDomainOwner, error: null }),
              }),
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
      if (table === 'admin_audit_log') {
        return { insert: async (row: Record<string, unknown>) => { auditInserts.push(row); return { error: null } } }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  }),
}))

const { setWhiteLabelDomain } = await import('@/lib/admin')

beforeEach(() => {
  auditInserts.length = 0
  addDomainSpy.mockClear()
  addDomainSpy.mockResolvedValue({ verified: false })
  existingDomainOwner = null
  orgsData = [{ id: 'org-1', custom_domain: null, custom_domain_verified: false }]
})

describe('setWhiteLabelDomain', () => {
  it('registers the domain with Vercel and saves it unverified, pending the existing DNS check', async () => {
    const result = await setWhiteLabelDomain('org-1', 'App.TheirGym.com', 'admin-1')
    expect(result.success).toBe(true)
    expect(addDomainSpy).toHaveBeenCalledWith('app.theirgym.com')
    expect(orgsData[0].custom_domain).toBe('app.theirgym.com')
    expect(orgsData[0].custom_domain_verified).toBe(false)
  })

  it('writes an audit log entry', async () => {
    await setWhiteLabelDomain('org-1', 'app.theirgym.com', 'admin-1')
    expect(auditInserts[0]).toMatchObject({
      admin_id: 'admin-1',
      action: 'set_white_label_domain',
      target_org_id: 'org-1',
      new_value: 'app.theirgym.com',
    })
  })

  it('rejects an invalid domain format', async () => {
    const result = await setWhiteLabelDomain('org-1', 'not a domain', 'admin-1')
    expect(result.error).toBeTruthy()
    expect(addDomainSpy).not.toHaveBeenCalled()
    expect(orgsData[0].custom_domain).toBeNull()
  })

  it('rejects a domain already used by another org', async () => {
    existingDomainOwner = { id: 'org-2' }
    const result = await setWhiteLabelDomain('org-1', 'app.theirgym.com', 'admin-1')
    expect(result.error).toBeTruthy()
    expect(addDomainSpy).not.toHaveBeenCalled()
    expect(orgsData[0].custom_domain).toBeNull()
  })

  it('errors without saving when Vercel registration fails', async () => {
    addDomainSpy.mockResolvedValue({ verified: false, error: 'Vercel down' })
    const result = await setWhiteLabelDomain('org-1', 'app.theirgym.com', 'admin-1')
    expect(result.error).toContain('Vercel down')
    expect(orgsData[0].custom_domain).toBeNull()
  })
})
