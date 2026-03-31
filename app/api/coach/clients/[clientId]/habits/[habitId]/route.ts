import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string; habitId: string }> }
) {
  const { clientId, habitId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const body = await req.json()
  const { name, target, unit, icon, active } = body

  const { data, error } = await supabase
    .from('habits')
    .update({ name, target, unit, icon, active, updated_at: new Date().toISOString() })
    .eq('id', habitId)
    .eq('client_id', clientId)
    .eq('coach_id', coachId)
    .select()
    .single()

  if (error || !data) return Response.json({ error: error?.message ?? 'Not found' }, { status: 400 })
  return Response.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string; habitId: string }> }
) {
  const { clientId, habitId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { error } = await supabase
    .from('habits')
    .delete()
    .eq('id', habitId)
    .eq('client_id', clientId)
    .eq('coach_id', coachId)

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}
