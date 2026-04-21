import { requireCoach } from '@/lib/coach'
import { createAdminClient } from '@/lib/supabase/admin'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ formId: string; submissionId: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { formId, submissionId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: sub } = await admin
    .from('form_submissions')
    .select('id, submitted_at')
    .eq('id', submissionId)
    .eq('form_id', formId)
    .eq('coach_id', coachId)
    .single()

  if (!sub) return Response.json({ error: 'Not found' }, { status: 404 })

  const [{ data: answers }, { data: allQuestions }] = await Promise.all([
    admin.from('form_answers').select('question_id, value').eq('submission_id', submissionId),
    admin.from('form_questions').select('id, label, type, order_index').eq('form_id', formId).order('order_index'),
  ])

  const answeredMap = Object.fromEntries((answers ?? []).map((a) => [a.question_id, a.value]))

  return Response.json({
    submitted_at: sub.submitted_at,
    answers: (allQuestions ?? []).map((q) => ({
      label: q.label,
      type: q.type,
      value: answeredMap[q.id] ?? null,
      answered: q.id in answeredMap,
    })),
  })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { formId, submissionId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: sub } = await admin
    .from('form_submissions')
    .select('id')
    .eq('id', submissionId)
    .eq('form_id', formId)
    .eq('coach_id', coachId)
    .single()
  if (!sub) return Response.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const patch: Record<string, unknown> = {}
  if ('reviewed_by_coach' in body) patch.viewed_by_coach = body.reviewed_by_coach
  if ('coach_feedback' in body) patch.coach_feedback = body.coach_feedback

  if (Object.keys(patch).length > 0) {
    await admin.from('form_submissions').update(patch).eq('id', submissionId)
  }
  return Response.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { formId, submissionId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Verify this submission belongs to a form owned by this coach
  const { data: sub } = await admin
    .from('form_submissions')
    .select('id')
    .eq('id', submissionId)
    .eq('form_id', formId)
    .eq('coach_id', coachId)
    .single()

  if (!sub) return Response.json({ error: 'Not found' }, { status: 404 })

  // Delete answers first, then submission (cascade may handle this, but be explicit)
  await admin.from('form_answers').delete().eq('submission_id', submissionId)
  await admin.from('form_submissions').delete().eq('id', submissionId)

  return Response.json({ ok: true })
}
