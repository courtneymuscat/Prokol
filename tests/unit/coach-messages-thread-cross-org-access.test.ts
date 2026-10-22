import { describe, it, expect, vi, beforeEach } from 'vitest'

// Regression test for app/coach/messages/[conversationId]/page.tsx: since
// conversations has no org_id column, a coach who owns more than one org
// (gym org-switching) could navigate directly to a conversation URL
// belonging to a DIFFERENT org than the one currently active and still
// load it (the coach_id check alone doesn't distinguish orgs). The fix
// cross-references coach_clients (client_id + org_id) to verify the
// conversation's client actually belongs to the currently active org,
// redirecting away otherwise. Also covers showing a display name instead
// of a raw email in the thread header.

let redirectedTo: string[] = []

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    redirectedTo.push(url)
    throw new Error(`REDIRECT:${url}`)
  },
}))

vi.mock('@/lib/coach', () => ({ requireCoach: async () => 'admin-1' }))

type Membership = { org_id: string; org_name: string; org_slug: string; role: string } | null
let membership: Membership = null

vi.mock('@/lib/org', () => ({ getOrgForUser: async () => membership }))

type ConvoRow = { id: string; client_id: string; coach_id: string }
type RelRow = { client_id: string; coach_id: string; org_id: string | null }

let convo: ConvoRow | null = null
let relRows: RelRow[] = []

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === 'conversations') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({ data: convo }),
              }),
            }),
          }),
        }
      }
      if (table === 'coach_clients') {
        return {
          select: () => ({
            eq: (_c1: string, coachId: string) => ({
              eq: (_c2: string, clientId: string) => ({
                eq: (_c3: string, orgId: string) => ({
                  maybeSingle: async () => ({
                    data: relRows.find((r) => r.coach_id === coachId && r.client_id === clientId && r.org_id === orgId) ?? null,
                  }),
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { email: 'robjo97@icloud.com', full_name: 'Robert Jones', first_name: null } }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  }),
}))

vi.mock('@/app/components/ChatView', () => ({ default: (props: Record<string, unknown>) => JSON.stringify(props) }))

const { default: CoachChatPage } = await import('@/app/coach/messages/[conversationId]/page')

beforeEach(() => {
  redirectedTo = []
  convo = { id: 'convo-1', client_id: 'client-court', coach_id: 'admin-1' }
  relRows = [{ client_id: 'client-court', coach_id: 'admin-1', org_id: 'court-org' }]
})

describe('CoachChatPage — blocks direct access to a conversation from a different org', () => {
  it('redirects away when the conversation\'s client does not belong to the active org', async () => {
    membership = { org_id: 'arete-org', org_name: 'Arete', org_slug: 'arete', role: 'owner' }
    await expect(
      CoachChatPage({ params: Promise.resolve({ conversationId: 'convo-1' }) })
    ).rejects.toThrow('REDIRECT:/coach/messages')
  })

  it('allows access when the conversation\'s client does belong to the active org', async () => {
    membership = { org_id: 'court-org', org_name: 'COURT', org_slug: 'court', role: 'owner' }
    const result = await CoachChatPage({ params: Promise.resolve({ conversationId: 'convo-1' }) })
    expect(redirectedTo).toEqual([])
    expect(JSON.stringify(result)).toContain('Robert Jones')
  })

  it('skips the org check entirely for a solo coach with no org membership', async () => {
    membership = null
    const result = await CoachChatPage({ params: Promise.resolve({ conversationId: 'convo-1' }) })
    expect(redirectedTo).toEqual([])
    expect(JSON.stringify(result)).toContain('Robert Jones')
  })
})
