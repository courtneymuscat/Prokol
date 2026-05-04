import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ clientId: string }> }

async function verifyCoachClient(coachId: string, clientId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('coach_clients')
    .select('client_id')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .in('status', ['active', 'archived', 'pending_invite'])
    .single()
  return !!data
}

export async function GET(
  _req: NextRequest,
  { params }: Ctx
) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  if (!(await verifyCoachClient(coachId, clientId))) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  const { data: schedules, error } = await admin
    .from('checkin_schedules')
    .select('id, title, form_id, day_of_week, repeat_type, start_date, is_active, created_at')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Fetch form titles for any schedule that has a form_id
  const formIds = [...new Set((schedules ?? []).map((s) => s.form_id).filter(Boolean))] as string[]

  let formTitles: Record<string, string> = {}
  if (formIds.length > 0) {
    const { data: forms } = await admin
      .from('forms')
      .select('id, title')
      .in('id', formIds)
    if (forms) {
      formTitles = Object.fromEntries(forms.map((f) => [f.id, f.title]))
    }
  }

  const result = (schedules ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    form_id: s.form_id ?? null,
    form_title: s.form_id ? (formTitles[s.form_id] ?? null) : null,
    day_of_week: s.day_of_week,
    repeat_type: s.repeat_type,
    start_date: s.start_date,
    is_active: s.is_active,
    created_at: s.created_at,
  }))

  return Response.json(result)
}

export async function POST(
  req: NextRequest,
  { params }: Ctx
) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  if (!(await verifyCoachClient(coachId, clientId))) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { title, day_of_week, repeat_type, start_date } = body
  let { form_id } = body

  if (!title) return Response.json({ error: 'Title is required' }, { status: 400 })
  if (day_of_week == null) return Response.json({ error: 'day_of_week is required' }, { status: 400 })
  if (!repeat_type) return Response.json({ error: 'repeat_type is required' }, { status: 400 })
  if (!start_date) return Response.json({ error: 'start_date is required' }, { status: 400 })

  const admin = createAdminClient()

  if (form_id) {
    // Clone the template form so edits are client-specific and don't affect the original
    const { data: sourceForm } = await admin
      .from('forms')
      .select('title, description, type')
      .eq('id', form_id)
      .single()

    const { data: clonedForm, error: cloneErr } = await admin
      .from('forms')
      .insert({
        coach_id: coachId,
        title: sourceForm?.title ?? title,
        description: sourceForm?.description ?? null,
        type: sourceForm?.type ?? 'weekly_checkin',
        is_client_copy: true,
        client_id: clientId,
      })
      .select('id')
      .single()
    if (cloneErr) return Response.json({ error: cloneErr.message }, { status: 500 })

    // Copy all questions from the template to the clone
    const { data: questions } = await admin
      .from('form_questions')
      .select('order_index, label, description, type, options, required')
      .eq('form_id', form_id)
      .order('order_index')

    if (questions?.length) {
      await admin.from('form_questions').insert(
        questions.map((q) => ({ ...q, form_id: clonedForm.id }))
      )
    }

    form_id = clonedForm.id
  } else {
    // No template — create a blank client-specific form
    const { data: newForm, error: formError } = await admin
      .from('forms')
      .insert({ coach_id: coachId, title, type: 'weekly_checkin', is_client_copy: true, client_id: clientId })
      .select('id')
      .single()
    if (formError) return Response.json({ error: formError.message }, { status: 500 })
    form_id = newForm.id
  }

  const { data, error } = await admin
    .from('checkin_schedules')
    .insert({
      coach_id: coachId,
      client_id: clientId,
      form_id: form_id ?? null,
      title,
      day_of_week,
      repeat_type,
      start_date,
      is_active: true,
    })
    .select('id, title, form_id, day_of_week, repeat_type, start_date, is_active, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(data, { status: 201 })
}
