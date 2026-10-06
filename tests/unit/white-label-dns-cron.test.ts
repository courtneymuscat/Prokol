import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

// The daily DNS-check cron must only touch orgs that are white-labelled,
// have a custom domain, and aren't verified yet — and must only email the
// owner when verification actually newly succeeds this run.
const checkedDomains: string[] = []
const sentEmails: { to: string; subject: string }[] = []

vi.mock('@/lib/whitelabel', () => ({
  attemptDomainVerification: vi.fn(async (_orgId: string, domain: string) => {
    checkedDomains.push(domain)
    // Only org-a's domain is "ready" this run.
    if (domain === 'app.a.com') {
      return { verified: true, domain, vercelVerified: true, message: 'ok' }
    }
    return { verified: false, kind: 'dns_not_configured', dnsFound: false, message: 'not yet', instructions: { summary: '', records: [] } }
  }),
}))

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(async (args: { to: string; subject: string }) => {
    sentEmails.push(args)
  }),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      const fixtures: Record<string, Record<string, unknown>[]> = {
        organisations: [
          { id: 'org-a', name: 'Org A', owner_id: 'owner-a', custom_domain: 'app.a.com', is_white_label: true, custom_domain_verified: false },
          { id: 'org-b', name: 'Org B (already verified)', owner_id: 'owner-b', custom_domain: 'app.b.com', is_white_label: true, custom_domain_verified: true },
          { id: 'org-c', name: 'Org C (not white-label)', owner_id: 'owner-c', custom_domain: 'app.c.com', is_white_label: false, custom_domain_verified: false },
          { id: 'org-d', name: 'Org D (no custom domain)', owner_id: 'owner-d', custom_domain: null, is_white_label: true, custom_domain_verified: false },
        ],
        profiles: [
          { id: 'owner-a', email: 'owner-a@test.com', full_name: 'Owner A' },
        ],
      }
      let rows = [...(fixtures[table] ?? [])]
      const builder = {
        select: () => builder,
        eq: (col: string, val: unknown) => { rows = rows.filter((r) => r[col] === val); return builder },
        not: (col: string, _op: string, val: unknown) => { rows = rows.filter((r) => r[col] !== val); return builder },
        single: async () => ({ data: rows[0] ?? null, error: null }),
        then: (resolve: (v: { data: unknown; error: null }) => void) => resolve({ data: rows, error: null }),
      }
      return builder
    },
  }),
}))

process.env.CRON_SECRET = 'test-secret'

const { GET } = await import('@/app/api/cron/white-label-dns-check/route')

function fakeRequest(): NextRequest {
  return {
    headers: { get: (name: string) => (name.toLowerCase() === 'authorization' ? 'Bearer test-secret' : null) },
  } as unknown as NextRequest
}

beforeEach(() => {
  checkedDomains.length = 0
  sentEmails.length = 0
})

describe('white-label DNS check cron', () => {
  it('only checks white-labelled orgs with an unverified custom domain', async () => {
    const res = await GET(fakeRequest())
    const json = await res.json()

    expect(json.ok).toBe(true)
    expect(checkedDomains).toEqual(['app.a.com'])
    expect(json.checked).toBe(1)
  })

  it('emails the owner only when verification newly succeeds', async () => {
    await GET(fakeRequest())
    expect(sentEmails).toHaveLength(1)
    expect(sentEmails[0].to).toBe('owner-a@test.com')
  })
})
