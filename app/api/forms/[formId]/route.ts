import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ formId: string }> }

async function ownsForm(coachId: string, formId: string) {
  const supabase = await createClient()
  const { data } = await supabase.from('forms').select('id').eq('id', formId).eq('coach_id', coachId).single()
  return !!data
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { formId } = await params
  const supabase = await createClient()

  const { data: form } = await supabase
    .from('forms')
    .select('id, title, description, type, is_active, coach_id')
    .eq('id', formId)
    .single()

  if (!form) return Response.json({ error: 'Not found' }, { status: 404 })

  const { data: questions } = await supabase
    .from('form_questions')
    .select('id, order_index, label, description, type, options, required')
    .eq('form_id', formId)
    .order('order_index')

  return Response.json({ ...form, questions: questions ?? [] })
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { formId } = await params
  const coachId = await requireCoach()
  if (!coachId || !(await ownsForm(coachId, formId)))
    return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const supabase = await createClient()
  const { error } = await supabase
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

  const supabase = await createClient()
  await supabase.from('forms').delete().eq('id', formId)
  return Response.json({ ok: true })
}
