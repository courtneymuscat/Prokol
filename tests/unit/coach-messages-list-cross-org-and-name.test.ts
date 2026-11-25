import { describe, it, expect, vi, beforeEach } from 'vitest'

// Covers app/api/coach/messages/list/route.ts.
//
// Originally a regression test for messages leaking across organisations:
// conversations has no org_id column at all, so it must be scoped via
// coach_clients' (client_id, org_id) — a coach who owns more than one org
// (gym org-switching) is the same coach_id in every one of them, so an
// unscoped query returned every org's conversations regardless of which was
// active. It also covers the list showing a raw email instead of a name.
//
// Court then asked to be able to work ACROSS her businesses deliberately
// ("show me every 1:1 client, in either gym"), so the route gained scope and
// tag filters. Defaulting to the active org is still the behaviour that
// matters most, and widening must never reach an org she isn't in.

type CoachClientRow = { client_id: string; coach_id: string; org_id: string | null }
type ConvoRow = { id: string; client_id: string; coach_id: string; last_message_at: string }
type ProfileRow = { id: string; email: string; full_name: string | null; first_name: string | null }
type TagAssignment = { client_id: string; coach_id: string; tag_id: string }

let coachClientRows: CoachClientRow[] = []
let convoRows: ConvoRow[] = []
let profileRows: ProfileRow[] = []
let tagAssignments: TagAssignment[] = []
let orgMemberRows: { org_id: string; user_id: string }[] = []
let organisationRows: { id: string; name: string; owner_id: string }[] = []
let membership: { org_id: string; org_name: string; org_slug: string; role: string } | null = null

vi.mock('@/lib/coach', () => ({ requireCoach: async () => 'admin-1' }))
vi.mock('@/lib/org', () => ({ getOrgForUser: async () => membership }))

// A query builder that records .eq()/.in() filters and resolves whether it's
// awaited directly or after .order() — the route does both.
function builder(rows: () => Record<string, unknown>[]) {
  const filters: { col: string; val: unknown; op: 'eq' | 'in' }[] = []
  const apply = () => rows().filter((r) =>
    filters.every(({ col, val, op }) =>
      op === 'eq' ? r[col] === val : Array.isArray(val) && (val as unknown[]).includes(r[col])))

  const chain: Record<string, unknown> = {
    select() { return chain },
    eq(col: string, val: unknown) { filters.push({ col, val, op: 'eq' }); return chain },
    in(col: string, val: unknown) { filters.push({ col, val, op: 'in' }); return chain },
    neq() { return chain },
    is() { return chain },
    order: async () => ({ data: apply() }),
    then: (res: (v: { data: unknown[] }) => unknown) => Promise.resolve({ data: apply() }).then(res),
  }
  return chain
}

const serverTables = (table: string) => {
  if (table === 'coach_clients') return builder(() => coachClientRows as unknown as Record<string, unknown>[])
  if (table === 'conversations') return builder(() => convoRows as unknown as Record<string, unknown>[])
  if (table === 'profiles') return builder(() => profileRows as unknown as Record<string, unknown>[])
  if (table === 'messages') return builder(() => [])
  if (table === 'client_tag_assignments') return builder(() => tagAssignments as unknown as Record<string, unknown>[])
  if (table === 'client_tags') return builder(() => [])
  throw new Error(`unexpected table: ${table}`)
}

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: serverTables }) }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'org_members') return builder(() => orgMemberRows as unknown as Record<string, unknown>[])
      if (table === 'organisations') return builder(() => organisationRows as unknown as Record<string, unknown>[])
      throw new Error(`unexpected admin table: ${table}`)
    },
  }),
}))

const { GET } = await import('@/app/api/coach/messages/list/route')

function call(query = '') {
  return GET({ nextUrl: new URL(`http://localhost/api/coach/messages/list${query}`) } as never)
}

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
  tagAssignments = []
  orgMemberRows = [
    { org_id: 'court-org', user_id: 'admin-1' },
    { org_id: 'arete-org', user_id: 'admin-1' },
  ]
  organisationRows = [
    { id: 'court-org', name: 'COURT', owner_id: 'admin-1' },
    { id: 'arete-org', name: 'Arete', owner_id: 'admin-1' },
  ]
  membership = null
})

const ids = (body: { convos: { id: string }[] }) => body.convos.map((c) => c.id)

describe('defaults to the active organisation', () => {
  it('only returns conversations for clients in the currently active org', async () => {
    membership = { org_id: 'arete-org', org_name: 'Arete', org_slug: 'arete', role: 'owner' }
    const body = await (await call()).json()
    expect(ids(body)).toEqual(['convo-arete'])
    expect(ids(body)).not.toContain('convo-court')
  })

  it('returns the other org\'s conversation when acting as that org instead', async () => {
    membership = { org_id: 'court-org', org_name: 'COURT', org_slug: 'court', role: 'owner' }
    const body = await (await call()).json()
    expect(ids(body)).toEqual(['convo-court'])
  })
})

describe('deliberately working across businesses', () => {
  it('scope=all returns every org this coach belongs to', async () => {
    membership = { org_id: 'arete-org', org_name: 'Arete', org_slug: 'arete', role: 'owner' }
    const body = await (await call('?scope=all')).json()
    expect(ids(body).sort()).toEqual(['convo-arete', 'convo-court'])
  })

  it('scope=<orgId> pins to that one business', async () => {
    membership = { org_id: 'arete-org', org_name: 'Arete', org_slug: 'arete', role: 'owner' }
    const body = await (await call('?scope=court-org')).json()
    expect(ids(body)).toEqual(['convo-court'])
  })

  it('an org the coach does not belong to falls back to the active org', async () => {
    membership = { org_id: 'arete-org', org_name: 'Arete', org_slug: 'arete', role: 'owner' }
    const body = await (await call('?scope=someone-elses-gym')).json()
    expect(ids(body)).toEqual(['convo-arete'])
  })

  it('scope=all still only covers this coach\'s own orgs', async () => {
    orgMemberRows = [{ org_id: 'arete-org', user_id: 'admin-1' }]
    organisationRows = [{ id: 'arete-org', name: 'Arete', owner_id: 'admin-1' }]
    membership = { org_id: 'arete-org', org_name: 'Arete', org_slug: 'arete', role: 'owner' }
    const body = await (await call('?scope=all')).json()
    expect(ids(body)).toEqual(['convo-arete'])
  })

  it('a tag filter spans businesses — every 1:1 client in either gym', async () => {
    tagAssignments = [
      { client_id: 'client-court', coach_id: 'admin-1', tag_id: 'tag-1to1' },
      { client_id: 'client-arete', coach_id: 'admin-1', tag_id: 'tag-1to1' },
    ]
    membership = { org_id: 'arete-org', org_name: 'Arete', org_slug: 'arete', role: 'owner' }
    const body = await (await call('?scope=all&tag=tag-1to1')).json()
    expect(ids(body).sort()).toEqual(['convo-arete', 'convo-court'])
  })

  it('a tag filter excludes untagged clients', async () => {
    tagAssignments = [{ client_id: 'client-court', coach_id: 'admin-1', tag_id: 'tag-1to1' }]
    membership = { org_id: 'arete-org', org_name: 'Arete', org_slug: 'arete', role: 'owner' }
    const body = await (await call('?scope=all&tag=tag-1to1')).json()
    expect(ids(body)).toEqual(['convo-court'])
  })

  it('reports which business each client belongs to, for the badge', async () => {
    membership = { org_id: 'arete-org', org_name: 'Arete', org_slug: 'arete', role: 'owner' }
    const body = await (await call('?scope=all')).json()
    expect(body.orgNameByClient).toMatchObject({ 'client-court': 'COURT', 'client-arete': 'Arete' })
  })
})

describe('shows a display name instead of a raw email', () => {
  it('prefers full_name over email', async () => {
    membership = { org_id: 'court-org', org_name: 'COURT', org_slug: 'court', role: 'owner' }
    const body = await (await call()).json()
    expect(body.profileMap['client-court']).toBe('Robert Jones')
  })

  it('falls back to first_name when full_name is missing', async () => {
    membership = { org_id: 'arete-org', org_name: 'Arete', org_slug: 'arete', role: 'owner' }
    const body = await (await call()).json()
    expect(body.profileMap['client-arete']).toBe('Alex')
  })

  it('falls back to email only when neither name is on file', async () => {
    membership = { org_id: 'arete-org', org_name: 'Arete', org_slug: 'arete', role: 'owner' }
    profileRows = [{ id: 'client-arete', email: 'arete-client@test.com', full_name: null, first_name: null }]
    const body = await (await call()).json()
    expect(body.profileMap['client-arete']).toBe('arete-client@test.com')
  })
})
