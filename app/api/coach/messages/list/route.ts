import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import { getOrgForUser } from '@/lib/org'
import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = await createClient()

  // conversations has no org_id column of its own — a coach who owns more
  // than one org (gym org-switching) is still the same coach_id in every
  // one of them, so conversations are scoped via coach_clients'
  // (client_id, org_id) instead.
  //
  // A coach running more than one business may also want to work across
  // them — "show me every 1:1 client I have, in either gym" — so `scope`
  // can widen this to all of their own organisations. It can never reach
  // an organisation they aren't in: the allowed set is built from their own
  // memberships and ownerships, and an unknown value falls back to the
  // active org rather than opening things up.
  const membership = await getOrgForUser(coachId)
  const scope = req.nextUrl.searchParams.get('scope') ?? 'current'
  const tagId = req.nextUrl.searchParams.get('tag')

  // Every org this coach legitimately belongs to, active membership or not —
  // switching businesses flips which membership is active, and the inactive
  // one is still theirs.
  const admin = createAdminClient()
  const [{ data: memberRows }, { data: ownedRows }] = await Promise.all([
    admin.from('org_members').select('org_id').eq('user_id', coachId),
    admin.from('organisations').select('id').eq('owner_id', coachId),
  ])
  const myOrgIds = [...new Set([
    ...(memberRows ?? []).map((r) => r.org_id as string),
    ...(ownedRows ?? []).map((r) => r.id as string),
  ])]

  const { data: orgRows } = myOrgIds.length
    ? await admin.from('organisations').select('id, name').in('id', myOrgIds)
    : { data: [] as { id: string; name: string }[] }
  const orgNameById: Record<string, string> = Object.fromEntries(
    (orgRows ?? []).map((o) => [o.id as string, o.name as string]),
  )

  // Which orgs this request covers.
  let orgFilter: string[] | null = null // null = no org scoping at all (solo coach)
  if (scope === 'all') {
    orgFilter = myOrgIds.length ? myOrgIds : null
  } else if (scope !== 'current' && myOrgIds.includes(scope)) {
    orgFilter = [scope]
  } else if (membership) {
    orgFilter = [membership.org_id]
  }

  // client_id -> org_id, so the list can badge each conversation and filter.
  const { data: rosterRows } = await supabase
    .from('coach_clients')
    .select('client_id, org_id')
    .eq('coach_id', coachId)
  const orgByClient: Record<string, string | null> = {}
  for (const r of rosterRows ?? []) orgByClient[r.client_id as string] = (r.org_id as string | null) ?? null

  let allowedClientIds: string[] | null = null
  if (orgFilter) {
    const set = new Set(orgFilter)
    allowedClientIds = (rosterRows ?? [])
      .filter((r) => r.org_id && set.has(r.org_id as string))
      .map((r) => r.client_id as string)
  }

  if (tagId) {
    const { data: tagged } = await supabase
      .from('client_tag_assignments')
      .select('client_id')
      .eq('coach_id', coachId)
      .eq('tag_id', tagId)
    const taggedIds = new Set((tagged ?? []).map((t) => t.client_id as string))
    allowedClientIds = (allowedClientIds ?? Object.keys(orgByClient)).filter((id) => taggedIds.has(id))
  }

  let convosQuery = supabase
    .from('conversations')
    .select('id, client_id, last_message_at')
    .eq('coach_id', coachId)
  if (allowedClientIds) {
    convosQuery = convosQuery.in('client_id', allowedClientIds.length ? allowedClientIds : ['__none__'])
  }
  const { data: convos } = await convosQuery.order('last_message_at', { ascending: false })

  const convoList = convos ?? []
  const clientIds = convoList.map((c) => c.client_id)
  const convoIds = convoList.map((c) => c.id)

  const [profilesRes, unreadRes, latestRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, full_name, first_name')
      .in('id', clientIds.length ? clientIds : ['none']),
    supabase
      .from('messages')
      .select('conversation_id')
      .in('conversation_id', convoIds.length ? convoIds : ['none'])
      .neq('sender_id', coachId)
      .is('read_at', null),
    supabase
      .from('messages')
      .select('conversation_id, body, sender_id, attachment_type, is_automated')
      .in('conversation_id', convoIds.length ? convoIds : ['none'])
      .order('created_at', { ascending: false }),
  ])

  // Display name, not raw email — falls back to email only if the client
  // has neither a full name nor a first name on file.
  const profileMap: Record<string, string> = Object.fromEntries(
    (profilesRes.data ?? []).map((p) => {
      const row = p as Record<string, unknown>
      const name = (row.full_name as string | null) ?? (row.first_name as string | null) ?? (row.email as string)
      return [p.id, name]
    })
  )

  const unreadMap: Record<string, number> = {}
  for (const m of unreadRes.data ?? []) {
    unreadMap[m.conversation_id] = (unreadMap[m.conversation_id] ?? 0) + 1
  }

  const latestMap: Record<string, { body: string; sender_id: string; attachment_type?: string | null; is_automated?: boolean }> = {}
  for (const m of latestRes.data ?? []) {
    if (!latestMap[m.conversation_id]) latestMap[m.conversation_id] = m
  }

  const { data: tags } = await supabase
    .from('client_tags')
    .select('id, name, color')
    .eq('coach_id', coachId)
    .order('name')

  return Response.json({
    coachId,
    convos: convoList,
    profileMap,
    unreadMap,
    latestMap,
    // Filter context — the switcher only renders when there's more than one
    // business to switch between.
    orgs: (orgRows ?? []).map((o) => ({ id: o.id, name: o.name })),
    currentOrgId: membership?.org_id ?? null,
    orgNameByClient: Object.fromEntries(
      Object.entries(orgByClient).map(([cid, oid]) => [cid, oid ? (orgNameById[oid] ?? null) : null]),
    ),
    tags: tags ?? [],
  })
}
