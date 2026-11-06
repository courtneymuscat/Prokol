import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/coach'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrgForUser } from '@/lib/org'

type Question = { id: string; type: string; label: string; reportable?: boolean }

// Lists every question across the coach's own autoflows (any template
// actually assigned to one of their clients, owned or org-shared alike)
// that's been marked "Include in reports" in the builder — whatever
// autoflow/step it lives on. Powers the question picker on
// Check-ins > Reports.
export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const membership = await getOrgForUser(coachId)

  let flowsQuery = admin
    .from('client_autoflows')
    .select('template_id')
    .eq('coach_id', coachId)
  if (membership) flowsQuery = flowsQuery.eq('org_id', membership.org_id)
  const { data: flows } = await flowsQuery

  const templateIds = [...new Set((flows ?? []).map((f) => f.template_id as string))]
  if (templateIds.length === 0) return NextResponse.json([])

  const [{ data: templates }, { data: steps }] = await Promise.all([
    admin.from('autoflow_templates').select('id, name, core_questions').in('id', templateIds),
    admin.from('autoflow_template_steps').select('template_id, questions').in('template_id', templateIds),
  ])

  const templateNameById = Object.fromEntries((templates ?? []).map((t) => [t.id, t.name as string]))

  type Result = { id: string; label: string; type: string; templateName: string }
  const byId = new Map<string, Result>()

  for (const t of templates ?? []) {
    const coreQuestions = Array.isArray(t.core_questions) ? (t.core_questions as Question[]) : []
    for (const q of coreQuestions) {
      if (q.reportable && !byId.has(q.id)) {
        byId.set(q.id, { id: q.id, label: q.label, type: q.type, templateName: templateNameById[t.id] ?? 'Untitled' })
      }
    }
  }
  for (const s of steps ?? []) {
    const questions = Array.isArray(s.questions) ? (s.questions as Question[]) : []
    for (const q of questions) {
      if (q.reportable && !byId.has(q.id)) {
        byId.set(q.id, { id: q.id, label: q.label, type: q.type, templateName: templateNameById[s.template_id] ?? 'Untitled' })
      }
    }
  }

  return NextResponse.json([...byId.values()])
}
