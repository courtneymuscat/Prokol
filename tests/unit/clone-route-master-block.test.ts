import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

let responses: Record<string, unknown> = {}

vi.mock('@/lib/coach', () => ({
  requireCoach: async () => 'gym-coach-user',
}))

vi.mock('@/lib/org', () => ({
  getOrgForUser: async () => ({ org_id: 'court-org', org_name: 'COURT', org_slug: 'court', role: 'owner' }),
  getCoachPermissions: async () => ({
    can_view_all_clients: false,
    can_reassign_clients: false,
    can_use_org_templates: true,
    can_message_all_clients: false,
    can_view_org_analytics: false,
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from(table: string) {
      const builder = {
        select: () => builder,
        eq: () => builder,
        limit: () => builder,
        insert: () => builder,
        maybeSingle: async () => ({ data: responses[`${table}__maybeSingle`] ?? null }),
        single: async () => ({ data: responses[`${table}__single`] ?? null, error: null }),
      }
      return builder
    },
  }),
}))

const { POST } = await import('@/app/api/coach/templates/clone/route')

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/coach/templates/clone', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  responses = {}
})

describe('POST /api/coach/templates/clone — master template protection', () => {
  it('blocks cloning a master-published template even when org_id happens to match', async () => {
    // Deliberately set up org_id matching membership.org_id ('court-org')
    // to prove the master-template check fires independently of the
    // org-mismatch check that would otherwise also block this.
    responses.autoflow_templates__single = {
      id: 'template-1', coach_id: 'court-user', org_id: 'court-org', is_org_template: true, name: 'Kickstart',
    }
    responses.master_template_publications__maybeSingle = { id: 'pub-1' }

    const res = await POST(makeRequest({ table: 'autoflow_templates', source_id: 'template-1' }))
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toMatch(/master template/i)
  })

  it('does not apply the master-template block to the template\'s real owner', async () => {
    responses.autoflow_templates__single = {
      id: 'template-1', coach_id: 'gym-coach-user', org_id: 'court-org', is_org_template: true, name: 'Kickstart',
    }
    responses.master_template_publications__maybeSingle = { id: 'pub-1' }
    responses.autoflow_template_steps__single = { data: [] }

    const res = await POST(makeRequest({ table: 'autoflow_templates', source_id: 'template-1' }))
    const body = await res.json()

    // Should NOT be rejected for the master-template reason (may still
    // succeed or fail for unrelated reasons depending on mock fidelity,
    // but must not be the IP-protection 403).
    if (res.status === 403) {
      expect(body.error).not.toMatch(/master template/i)
    }
  })

  it('is unaffected when nothing was ever published (ordinary org clone)', async () => {
    responses.autoflow_templates__single = {
      id: 'template-1', coach_id: 'other-coach', org_id: 'court-org', is_org_template: true, name: 'Kickstart',
    }
    responses.master_template_publications__maybeSingle = null

    const res = await POST(makeRequest({ table: 'autoflow_templates', source_id: 'template-1' }))
    const body = await res.json()

    if (res.status === 403) {
      expect(body.error).not.toMatch(/master template/i)
    }
  })
})
