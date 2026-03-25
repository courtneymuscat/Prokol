import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ submissionId: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { submissionId } = await params
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: sub } = await supabase
    .from('form_submissions')
    .select('id, form_id, client_id, coach_id, submitted_at')
    .eq('id', submissionId)
    .single()

  if (!sub) return Response.json({ error: 'Not found' }, { status: 404 })
  if (sub.client_id !== session.user.id && sub.coach_id !== session.user.id)
    return Response.json({ error: 'Forbidden' }, { status: 403 })

  const [{ data: answers }, { data: form }] = await Promise.all([
    supabase
      .from('form_answers')
      .select('question_id, value, form_questions(label, type, order_index)')
      .eq('submission_id', submissionId)
      .order('form_questions(order_index)'),
    supabase.from('forms').select('title, type').eq('id', sub.form_id).single(),
  ])

  // Mark as viewed if coach is reading
  if (sub.coach_id === session.user.id) {
    await supabase
      .from('form_submissions')
      .update({ viewed_by_coach: true })
      .eq('id', submissionId)
  }

  return Response.json({
    ...sub,
    form_title: form?.title ?? 'Form',
    form_type: form?.type ?? 'custom',
    answers: (answers ?? []).map((a) => ({
      question_id: a.question_id,
      label: (a.form_questions as { label: string; type: string; order_index: number }[] | undefined)?.[0]?.label ?? '',
      type: (a.form_questions as { label: string; type: string; order_index: number }[] | undefined)?.[0]?.type ?? 'text',
      value: a.value,
    })),
  })
}

export async function PATCH(_req: NextRequest, { params }: Ctx) {
  const { submissionId } = await params
  const supabase = await createClient()
  await supabase.from('form_submissions').update({ viewed_by_coach: true }).eq('id', submissionId)
  return Response.json({ ok: true })
}
