import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

async function verifyAccess(coachId: string, clientId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('coach_clients')
    .select('id')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .single()
  return !!data
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  if (!(await verifyAccess(coachId, clientId))) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createClient()
  const { data } = await supabase
    .from('coach_notes')
    .select('id, body, created_at, follow_up_date, follow_up_done, source_label, source_url')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  return Response.json(data ?? [])
}

const NOTE_FIELDS = 'id, body, created_at, follow_up_date, follow_up_done, source_label, source_url'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  if (!(await verifyAccess(coachId, clientId))) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { body, follow_up_date, source_label, source_url } = await req.json()
  if (!body?.trim()) return Response.json({ error: 'Note body is required' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('coach_notes')
    .insert({
      coach_id: coachId,
      client_id: clientId,
      body: body.trim(),
      follow_up_date: follow_up_date || null,
      source_label: source_label || null,
      source_url: source_url || null,
    })
    .select(NOTE_FIELDS)
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const { noteId, body, follow_up_date, follow_up_done } = await req.json()
  if (!noteId) return Response.json({ error: 'noteId required' }, { status: 400 })

  // Body stays required when editing the text, but a caller may also just be
  // rescheduling or ticking off a follow-up without touching the note itself.
  const patch: Record<string, unknown> = {}
  if (body !== undefined) {
    if (!body?.trim()) return Response.json({ error: 'Note body cannot be empty' }, { status: 400 })
    patch.body = body.trim()
  }
  if (follow_up_date !== undefined) patch.follow_up_date = follow_up_date || null
  if (follow_up_done !== undefined) patch.follow_up_done = !!follow_up_done
  if (!Object.keys(patch).length) return Response.json({ error: 'Nothing to update' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('coach_notes')
    .update(patch)
    .eq('id', noteId)
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .select(NOTE_FIELDS)
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const { noteId } = await req.json()
  if (!noteId) return Response.json({ error: 'noteId required' }, { status: 400 })

  const supabase = await createClient()
  await supabase
    .from('coach_notes')
    .delete()
    .eq('id', noteId)
    .eq('coach_id', coachId)
    .eq('client_id', clientId)

  return Response.json({ ok: true })
}
