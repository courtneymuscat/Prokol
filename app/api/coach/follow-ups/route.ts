import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

// Outstanding follow-ups across every client, for the Follow-ups section on
// the check-ins page. Per-client note CRUD lives in ../notes/[clientId].

export async function GET(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  // Done follow-ups stay available so the section can show recently handled
  // ones without a second request.
  const includeDone = req.nextUrl.searchParams.get('include_done') === 'true'

  const supabase = await createClient()
  let query = supabase
    .from('coach_notes')
    .select('id, client_id, body, created_at, follow_up_date, follow_up_done, source_label, source_url')
    .eq('coach_id', coachId)
    .not('follow_up_date', 'is', null)
    .order('follow_up_date', { ascending: true })

  if (!includeDone) query = query.eq('follow_up_done', false)

  const { data: notes, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const clientIds = [...new Set((notes ?? []).map((n) => n.client_id as string))]
  const { data: profiles } = clientIds.length
    ? await supabase.from('profiles').select('id, full_name, first_name, email').in('id', clientIds)
    : { data: [] }

  const nameById = Object.fromEntries(
    (profiles ?? []).map((p) => [
      p.id as string,
      (p.full_name as string | null) ?? (p.first_name as string | null) ?? (p.email as string | null) ?? 'Client',
    ]),
  )

  return Response.json(
    (notes ?? []).map((n) => ({ ...n, client_name: nameById[n.client_id as string] ?? 'Client' })),
  )
}

export async function PATCH(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const { noteId, follow_up_done, follow_up_date } = await req.json()
  if (!noteId) return Response.json({ error: 'noteId required' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  if (follow_up_done !== undefined) patch.follow_up_done = !!follow_up_done
  if (follow_up_date !== undefined) patch.follow_up_date = follow_up_date || null
  if (!Object.keys(patch).length) return Response.json({ error: 'Nothing to update' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase
    .from('coach_notes')
    .update(patch)
    .eq('id', noteId)
    .eq('coach_id', coachId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
