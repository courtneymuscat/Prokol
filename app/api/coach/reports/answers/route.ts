import { NextRequest, NextResponse } from 'next/server'
import { requireCoach } from '@/lib/coach'
import { createAdminClient } from '@/lib/supabase/admin'

// Every answer any of the coach's own clients gave to one or more specific
// questions, across every autoflow/step they appear on (a core question
// answered weekly shows up once per check-in it was asked on), optionally
// bounded to a date range. One row per check-in submission that answered
// at least one of the requested questions — answers come back keyed by
// question id so a multi-question report pivots naturally (e.g. "wins" and
// "obstacles" side by side for the same check-in) rather than needing a
// separate run per question. Powers Check-ins > Reports' bulk-pull.
export async function GET(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  // questionIds (plural, comma-separated) is the current param; questionId
  // (singular) kept working too in case anything else ever links here.
  const questionIdsParam = searchParams.get('questionIds') ?? searchParams.get('questionId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (!questionIdsParam) return NextResponse.json({ error: 'questionIds required' }, { status: 400 })
  const questionIds = questionIdsParam.split(',').map((s) => s.trim()).filter(Boolean)
  if (questionIds.length === 0) return NextResponse.json({ error: 'questionIds required' }, { status: 400 })

  const admin = createAdminClient()

  // coach_id already fully scopes to this coach's own clients regardless
  // of org/gym membership — see questions/route.ts's identical comment.
  const { data: flows } = await admin
    .from('client_autoflows')
    .select('id, client_id, name')
    .eq('coach_id', coachId)

  const flowIds = (flows ?? []).map((f) => f.id as string)
  if (flowIds.length === 0) return NextResponse.json([])
  const flowById = Object.fromEntries((flows ?? []).map((f) => [f.id, f]))

  let respQuery = admin
    .from('autoflow_responses')
    .select('client_autoflow_id, client_id, step_number, answers, submitted_at')
    .in('client_autoflow_id', flowIds)
    .not('answers', 'is', null)
    .order('submitted_at', { ascending: false })
  if (from) respQuery = respQuery.gte('submitted_at', from)
  if (to) respQuery = respQuery.lte('submitted_at', `${to}T23:59:59.999Z`)
  const { data: responses } = await respQuery

  const clientIds = [...new Set((flows ?? []).map((f) => f.client_id as string))]
  const { data: profiles } = clientIds.length
    ? await admin.from('profiles').select('id, full_name, first_name, email').in('id', clientIds)
    : { data: [] as never[] }
  const profileById = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, (p.full_name as string | null) ?? (p.first_name as string | null) ?? p.email]),
  )

  const rows = (responses ?? [])
    .filter((r) => r.answers && questionIds.some((qid) => Object.prototype.hasOwnProperty.call(r.answers, qid)))
    .map((r) => {
      const answerSet = r.answers as Record<string, string>
      const answers: Record<string, string | null> = {}
      for (const qid of questionIds) answers[qid] = Object.prototype.hasOwnProperty.call(answerSet, qid) ? answerSet[qid] : null
      return {
        client_id: r.client_id,
        client_name: profileById[r.client_id] ?? 'Unknown',
        flow_name: flowById[r.client_autoflow_id]?.name ?? 'Check-in',
        step_number: r.step_number,
        submitted_at: r.submitted_at,
        answers,
      }
    })

  return NextResponse.json(rows)
}
