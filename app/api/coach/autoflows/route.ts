import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import { fetchOrgTemplatesForCoach } from '@/lib/org'
import type { NextRequest } from 'next/server'

type AutoflowRow = {
  id: string
  name: string
  description: string | null
  type: string | null
  total_steps: number | null
  created_at: string
  archived_at?: string | null
}

export async function GET(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const archivedView = new URL(req.url).searchParams.get('archived') === '1'
  const [{ data: own }, orgItems] = await Promise.all([
    supabase
      .from('autoflow_templates')
      .select('id, name, description, type, total_steps, created_at, archived_at')
      .eq('coach_id', coachId)
      // Hide per-client forked templates from the main library — they're
      // bespoke clones tied to one client only.
      .eq('is_client_only', false)
      .filter('archived_at', archivedView ? 'not.is' : 'is', null)
      .order('created_at', { ascending: false }),
    archivedView
      ? Promise.resolve([] as AutoflowRow[])
      : fetchOrgTemplatesForCoach<AutoflowRow>(
          coachId,
          'autoflow_templates',
          'id, name, description, type, total_steps, created_at',
        ),
  ])

  // Dedupe by id — see comment in /api/forms route.
  const byId = new Map<string, AutoflowRow & { is_org_template: boolean }>()
  for (const t of (own as AutoflowRow[] | null) ?? []) {
    byId.set(t.id, { ...t, is_org_template: false })
  }
  for (const t of orgItems) {
    byId.set(t.id, { ...t, is_org_template: true })
  }
  return Response.json(Array.from(byId.values()))
}

export async function POST(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description, type, total_steps } = await req.json()
  if (!name) return Response.json({ error: 'Name required' }, { status: 400 })

  const supabase = await createClient()
  const steps = parseInt(total_steps) || (type === 'onboarding' ? 4 : 12)

  const { data: template, error } = await supabase
    .from('autoflow_templates')
    .insert({ coach_id: coachId, name, description: description ?? null, type: type ?? 'weekly_checkin', total_steps: steps })
    .select('id')
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Create empty steps with sensible defaults
  const defaultOffsets = type === 'onboarding' ? [0, 3, 7, 14] : null
  const stepRows = Array.from({ length: steps }, (_, i) => ({
    template_id: template.id,
    step_number: i + 1,
    title: type === 'onboarding'
      ? `Day ${defaultOffsets ? defaultOffsets[i] ?? (i + 1) * 7 : (i + 1) * 7}`
      : `Week ${i + 1}`,
    questions: [],
    day_offset: defaultOffsets ? (defaultOffsets[i] ?? (i + 1) * 7) : i * 7,
  }))
  await supabase.from('autoflow_template_steps').insert(stepRows)

  return Response.json({ id: template.id })
}
