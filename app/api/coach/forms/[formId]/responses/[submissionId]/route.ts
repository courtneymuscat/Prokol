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

  const { data: answers } = await admin
    .from('form_answers')
    .select('value, form_questions(label, type, order_index)')
    .eq('submission_id', submissionId)

  type FQ = { label: string; type: string; order_index: number } | null

  const sorted = (answers ?? []).sort((a, b) => {
    const oa = (a.form_questions as unknown as FQ)?.order_index ?? 0
    const ob = (b.form_questions as unknown as FQ)?.order_index ?? 0
    return oa - ob
  })

  return Response.json({
    submitted_at: sub.submitted_at,
    answers: sorted.map((a) => {
      const fq = a.form_questions as unknown as FQ
      return { label: fq?.label ?? 'Question', type: fq?.type ?? 'text', value: a.value }
    }),
  })
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
