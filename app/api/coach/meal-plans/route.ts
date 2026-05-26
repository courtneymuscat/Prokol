import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import { seedCoachTemplates } from '@/lib/seed-coach-templates'
import { fetchOrgTemplatesForCoach } from '@/lib/org'
import type { NextRequest } from 'next/server'

export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()

  // Auto-seed starter templates if they haven't been added yet
  await seedCoachTemplates(coachId)

  const [{ data: own }, orgItems] = await Promise.all([
    supabase
      .from('meal_plans')
      .select('*')
      .eq('coach_id', coachId)
      .is('archived_at', null)
      .order('created_at', { ascending: false }),
    fetchOrgTemplatesForCoach<{ id: string }>(
      coachId,
      'meal_plans',
      '*',
    ),
  ])

  // Dedupe by id — the coach who publishes an org template also owns the
  // underlying row, so it would otherwise appear once in 'own' and once
  // in orgItems. Prefer the org-template entry so the UI keeps its badge.
  const byId = new Map<string, Record<string, unknown> & { id: string; is_org_template: boolean }>()
  for (const p of ((own as Array<{ id: string }> | null) ?? [])) {
    byId.set(p.id, { ...p, is_org_template: false })
  }
  for (const p of orgItems) {
    byId.set(p.id, { ...p, is_org_template: true })
  }
  return Response.json(Array.from(byId.values()))
}

export async function POST(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const body = await req.json()
  const { data, error } = await supabase
    .from('meal_plans')
    .insert({ ...body, coach_id: coachId })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}
