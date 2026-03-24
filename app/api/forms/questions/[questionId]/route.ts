import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ questionId: string }> }

async function ownsQuestion(coachId: string, questionId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('form_questions')
    .select('id, forms!inner(coach_id)')
    .eq('id', questionId)
    .single()
  const f = data?.forms?.[0] as { coach_id: string } | undefined
  return f?.coach_id === coachId
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { questionId } = await params
  const coachId = await requireCoach()
  if (!coachId || !(await ownsQuestion(coachId, questionId)))
    return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const supabase = await createClient()
  const { error } = await supabase
    .from('form_questions')
    .update({
      label: body.label,
      type: body.type,
      options: body.options ?? null,
      required: body.required ?? false,
      order_index: body.order_index,
    })
    .eq('id', questionId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { questionId } = await params
  const coachId = await requireCoach()
  if (!coachId || !(await ownsQuestion(coachId, questionId)))
    return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = await createClient()
  await supabase.from('form_questions').delete().eq('id', questionId)
  return Response.json({ ok: true })
}
