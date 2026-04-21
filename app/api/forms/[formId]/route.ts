import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ formId: string }> }

async function ownsForm(coachId: string, formId: string) {
  // Use admin client — client copies have client_id set, which may block RLS reads
  const admin = createAdminClient()
  const { data } = await admin.from('forms').select('id').eq('id', formId).eq('coach_id', coachId).single()
  return !!data
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { formId } = await params
  // Use admin client — clients filling in forms are reading their coach's data, RLS blocks them
  const admin = createAdminClient()

  const { data: form } = await admin
    .from('forms')
    .select('id, title, description, type, is_active, coach_id, is_client_copy, client_id')
    .eq('id', formId)
    .single()

  if (!form) return Response.json({ error: 'Not found' }, { status: 404 })

  const { data: questions } = await admin
    .from('form_questions')
    .select('id, order_index, label, description, type, options, required')
    .eq('form_id', formId)
    .order('order_index')

  // Attach client name when this is a client-specific copy
  let clientName: string | null = null
  if (form.is_client_copy && form.client_id) {
    const { data: clientProfile } = await admin
      .from('profiles')
      .select('full_name, email')
      .eq('id', form.client_id)
      .single()
    clientName = clientProfile?.full_name ?? clientProfile?.email ?? null
  }

  return Response.json({ ...form, questions: questions ?? [], client_name: clientName })
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { formId } = await params
  const coachId = await requireCoach()
  if (!coachId || !(await ownsForm(coachId, formId)))
    return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const admin = createAdminClient()
  const { error } = await admin
    .from('forms')
    .update({ title: body.title, description: body.description ?? null, type: body.type, is_active: body.is_active })
    .eq('id', formId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { formId } = await params
  const coachId = await requireCoach()
  if (!coachId || !(await ownsForm(coachId, formId)))
    return Response.json({ error: 'Unauthorised' }, { status: 401 })

  // Use admin client to bypass RLS for cascading deletes
  const admin = createAdminClient()

  // Delete child records first to avoid FK constraint failures
  const submissionIds = await admin
    .from('form_submissions')
    .select('id')
    .eq('form_id', formId)
  const ids = (submissionIds.data ?? []).map(s => s.id)
  if (ids.length > 0) {
    await admin.from('form_answers').delete().in('submission_id', ids)
  }
  await admin.from('form_submissions').delete().eq('form_id', formId)
  await admin.from('form_questions').delete().eq('form_id', formId)

  const { error } = await admin.from('forms').delete().eq('id', formId)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
