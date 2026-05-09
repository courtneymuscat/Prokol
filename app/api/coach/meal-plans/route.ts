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
      .order('created_at', { ascending: false }),
    fetchOrgTemplatesForCoach<{ id: string }>(
      coachId,
      'meal_plans',
      '*',
    ),
  ])

  const merged = [
    ...orgItems.map((p) => ({ ...p, is_org_template: true })),
    ...((own as Array<{ id: string }> | null) ?? []).map((p) => ({ ...p, is_org_template: false })),
  ]
  return Response.json(merged)
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
