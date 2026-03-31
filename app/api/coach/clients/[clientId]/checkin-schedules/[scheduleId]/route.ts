import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ clientId: string; scheduleId: string }> }

async function getSchedule(coachId: string, scheduleId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('checkin_schedules')
    .select('id, coach_id, client_id, form_id')
    .eq('id', scheduleId)
    .eq('coach_id', coachId)
    .single()
  return data
}

async function cloneForm(coachId: string, clientId: string, templateFormId: string): Promise<string> {
  const admin = createAdminClient()

  const { data: source } = await admin
    .from('forms')
    .select('title, description, type')
    .eq('id', templateFormId)
    .single()

  const { data: clone } = await admin
    .from('forms')
    .insert({
      coach_id: coachId,
      title: source?.title ?? 'Check-in',
      description: source?.description ?? null,
      type: source?.type ?? 'weekly_checkin',
      is_client_copy: true,
      client_id: clientId,
    })
    .select('id')
    .single()

  const { data: questions } = await admin
    .from('form_questions')
    .select('order_index, label, description, type, options, required')
    .eq('form_id', templateFormId)
    .order('order_index')

  if (questions?.length && clone) {
    await admin.from('form_questions').insert(
      questions.map((q) => ({ ...q, form_id: clone.id }))
    )
  }

  return clone!.id
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { scheduleId, clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const existing = await getSchedule(coachId, scheduleId)
  if (!existing) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const allowed = ['title', 'day_of_week', 'repeat_type', 'start_date', 'is_active'] as const
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  // If caller is switching to a different template form, clone it
  if ('form_id' in body && body.form_id && body.form_id !== existing.form_id) {
    const admin = createAdminClient()
    // Delete old client copy if it was one
    if (existing.form_id) {
      await admin
        .from('forms')
        .delete()
        .eq('id', existing.form_id)
        .eq('is_client_copy', true)
    }
    updates.form_id = await cloneForm(coachId, clientId, body.form_id)
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

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { scheduleId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const existing = await getSchedule(coachId, scheduleId)
  if (!existing) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  // Delete the client-specific form copy along with the schedule
  if (existing.form_id) {
    await admin
      .from('forms')
      .delete()
      .eq('id', existing.form_id)
      .eq('is_client_copy', true)
  }

  const { error } = await admin
    .from('checkin_schedules')
    .delete()
    .eq('id', scheduleId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
