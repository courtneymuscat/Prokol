import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ eventId: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { eventId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { event_date, feedback_seen } = body as { event_date?: string; feedback_seen?: boolean }

  if (!event_date && feedback_seen === undefined) {
    return Response.json({ error: 'event_date or feedback_seen required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify the event belongs to this user
  const { data: existing } = await admin
    .from('calendar_events')
    .select('id, content')
    .eq('id', eventId)
    .eq('client_id', user.id)
    .single()

  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })

  const patch: Record<string, unknown> = {}
  if (event_date) patch.event_date = event_date
  if (feedback_seen !== undefined) {
    const existingContent = (existing.content as Record<string, unknown>) ?? {}
    patch.content = { ...existingContent, feedback_seen }
  }

  const { data, error } = await admin
    .from('calendar_events')
    .update(patch)
    .eq('id', eventId)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { eventId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('calendar_events')
    .select('id, type')
    .eq('id', eventId)
    .eq('client_id', user.id)
    .single()

  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })
  if (existing.type === 'program_workout_result') {
    return Response.json({ error: 'Cannot delete workout results this way' }, { status: 400 })
  }

  const { error } = await admin
    .from('calendar_events')
    .delete()
    .eq('id', eventId)

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}
