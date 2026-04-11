import { requireCoach } from '@/lib/coach'
import { createAdminClient } from '@/lib/supabase/admin'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ formId: string; submissionId: string }> }

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
