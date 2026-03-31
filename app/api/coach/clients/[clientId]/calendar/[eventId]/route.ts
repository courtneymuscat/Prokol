import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string; eventId: string }> }
) {
  const { clientId, eventId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const body = await req.json()
  const { title, content, type } = body

  const { data, error } = await supabase
    .from('calendar_events')
    .update({ title, content, type, updated_at: new Date().toISOString() })
    .eq('id', eventId)
    .eq('client_id', clientId)
    .eq('coach_id', coachId)
    .select()
    .single()

  if (error || !data) return Response.json({ error: error?.message ?? 'Not found' }, { status: 400 })
  return Response.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string; eventId: string }> }
) {
  const { clientId, eventId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { error } = await supabase
    .from('calendar_events')
    .delete()
    .eq('id', eventId)
    .eq('client_id', clientId)
    .eq('coach_id', coachId)

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}
