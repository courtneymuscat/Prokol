import { describe, it, expect, vi, beforeEach } from 'vitest'

// Regression test for app/api/coach/messages/list/route.ts, which Court
// reported leaking messages: conversations has no org_id column at all, so
// it must be scoped via coach_clients' (client_id, org_id) instead — a
// coach who owns more than one org (gym org-switching) is still the same
// coach_id in every one of them, so an unscoped query returned every org's
// conversations regardless of which one was active (e.g. Court's real
// COURT clients' DMs showing up while "acting as" a brand-new Arete gym).
// Also covers the second reported bug: the conversation list showed the
// client's raw email instead of their name.

type CoachClientRow = { client_id: string; coach_id: string; org_id: string | null }
type ConvoRow = { id: string; client_id: string; coach_id: string; last_message_at: string }
type ProfileRow = { id: string; email: string; full_name: string | null; first_name: string | null }

let coachClientRows: CoachClientRow[] = []
let convoRows: ConvoRow[] = []
let profileRows: ProfileRow[] = []
let membership: { org_id: string; org_name: string; org_slug: string; role: string } | null = null

vi.mock('@/lib/coach', () => ({ requireCoach: async () => 'admin-1' }))
vi.mock('@/lib/org', () => ({ getOrgForUser: async () => membership }))

function flexChain(resolve: () => { data: unknown[] }) {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'in', 'neq', 'is']) chain[m] = () => chain
  chain.order = async () => resolve()
  return chain
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === 'coach_clients') {
        return {
          select: () => ({
            eq: (_c1: string, coachId: string) => ({
              eq: (_c2: string, orgId: string) =>
                Promise.resolve({ data: coachClientRows.filter((r) => r.coach_id === coachId && r.org_id === orgId) }),
            }),
          }),
        }
      }
      if (table === 'conversations') {
        return {
          select: () => ({
            eq: (_c1: string, coachId: string) => {
              const byCoach = convoRows.filter((r) => r.coach_id === coachId)
              return {
                order: async () => ({ data: byCoach }),
                in: (_c2: string, clientIds: string[]) => ({
                  order: async () => ({ data: byCoach.filter((r) => clientIds.includes(r.client_id)) }),
                }),
              }
            },
          }),
        }
      }
      if (table === 'profiles') {
        return { select: () => ({ in: async (_c: string, ids: string[]) => ({ data: profileRows.filter((p) => ids.includes(p.id)) }) }) }
      }
      if (table === 'messages') {
        return { select: () => flexChain(() => ({ data: [] })) }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  }),
}))

const { GET } = await import('@/app/api/coach/messages/list/route')

beforeEach(() => {
  coachClientRows = [
    { client_id: 'client-court', coach_id: 'admin-1', org_id: 'court-org' },
    { client_id: 'client-arete', coach_id: 'admin-1', org_id: 'arete-org' },
  ]
  convoRows = [
    { id: 'convo-court', client_id: 'client-court', coach_id: 'admin-1', last_message_at: '2026-01-01' },
    { id: 'convo-arete', client_id: 'client-arete', coach_id: 'admin-1', last_message_at: '2026-02-01' },
  ]
  profileRows = [
    { id: 'client-court', email: 'robjo97@icloud.com', full_name: 'Robert Jones', first_name: null },
    { id: 'client-arete', email: 'arete-client@test.com', full_name: null, first_name: 'Alex' },
  ]
})

describe('GET /api/coach/messages/list — does not leak conversations across orgs', () => {
  it('only returns conversations for clients belonging to the currently active org', async () => {
    membership = { org_id: 'arete-org', org_name: 'Arete', org_slug: 'arete', role: 'owner' }
    const res = await GET()
    const body = await res.json()
    expect(body.convos.map((c: { id: string }) => c.id)).toEqual(['convo-arete'])
    expect(body.convos.map((c: { id: string }) => c.id)).not.toContain('convo-court')
  })

  it('returns the other org\'s conversation when acting as that org instead', async () => {
    membership = { org_id: 'court-org', org_name: 'COURT', org_slug: 'court', role: 'owner' }
    const res = await GET()
    const body = await res.json()
    expect(body.convos.map((c: { id: string }) => c.id)).toEqual(['convo-court'])
  })
})

describe('GET /api/coach/messages/list — shows a display name instead of a raw email', () => {
  it('prefers full_name over email', async () => {
    membership = { org_id: 'court-org', org_name: 'COURT', org_slug: 'court', role: 'owner' }
    const res = await GET()
    const body = await res.json()
    expect(body.profileMap['client-court']).toBe('Robert Jones')
  })

  it('falls back to first_name when full_name is missing', async () => {
    membership = { org_id: 'arete-org', org_name: 'Arete', org_slug: 'arete', role: 'owner' }
    const res = await GET()
    const body = await res.json()
    expect(body.profileMap['client-arete']).toBe('Alex')
  })

  it('falls back to email only when neither name is on file', async () => {
    membership = { org_id: 'arete-org', org_name: 'Arete', org_slug: 'arete', role: 'owner' }
    profileRows = [{ id: 'client-arete', email: 'arete-client@test.com', full_name: null, first_name: null }]
    const res = await GET()
    const body = await res.json()
    expect(body.profileMap['client-arete']).toBe('arete-client@test.com')
  })
})
