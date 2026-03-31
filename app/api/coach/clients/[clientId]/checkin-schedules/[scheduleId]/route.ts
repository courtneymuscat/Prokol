import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ clientId: string; scheduleId: string }> }

async function verifyOwnership(coachId: string, scheduleId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('checkin_schedules')
    .select('id')
    .eq('id', scheduleId)
    .eq('coach_id', coachId)
    .single()
  return !!data
}

export async function PATCH(
  req: NextRequest,
  { params }: Ctx
) {
  const { scheduleId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  if (!(await verifyOwnership(coachId, scheduleId))) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const allowed = ['title', 'form_id', 'day_of_week', 'repeat_type', 'start_date', 'is_active'] as const
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('checkin_schedules')
    .update(updates)
    .eq('id', scheduleId)
    .select('id, title, form_id, day_of_week, repeat_type, start_date, is_active, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: Ctx
) {
  const { scheduleId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  if (!(await verifyOwnership(coachId, scheduleId))) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('checkin_schedules')
    .delete()
    .eq('id', scheduleId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
