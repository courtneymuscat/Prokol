import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import { getOrgForUser } from '@/lib/org'

export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = await createClient()

  // conversations has no org_id column of its own — a coach who owns more
  // than one org (gym org-switching) is still the same coach_id in every
  // one of them, so conversations must be scoped via coach_clients'
  // (client_id, org_id) instead, otherwise every org's conversations show
  // up regardless of which one is currently active.
  const membership = await getOrgForUser(coachId)
  let orgClientIds: string[] | null = null
  if (membership) {
    const { data: orgClientRows } = await supabase
      .from('coach_clients')
      .select('client_id')
      .eq('coach_id', coachId)
      .eq('org_id', membership.org_id)
    orgClientIds = (orgClientRows ?? []).map((r) => r.client_id)
  }

  let convosQuery = supabase
    .from('conversations')
    .select('id, client_id, last_message_at')
    .eq('coach_id', coachId)
  if (orgClientIds) convosQuery = convosQuery.in('client_id', orgClientIds.length ? orgClientIds : ['__none__'])
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
      .select('conversation_id, body, sender_id, attachment_type')
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

  const latestMap: Record<string, { body: string; sender_id: string; attachment_type?: string | null }> = {}
  for (const m of latestRes.data ?? []) {
    if (!latestMap[m.conversation_id]) latestMap[m.conversation_id] = m
  }

  return Response.json({ coachId, convos: convoList, profileMap, unreadMap, latestMap })
}
