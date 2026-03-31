import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'

type Ctx = { params: Promise<{ clientId: string; planId: string }> }

export async function POST(
  _req: Request,
  { params }: Ctx
) {
  const { clientId, planId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()

  // Verify the coach owns this client_meal_plans record
  const { data: plan, error: fetchError } = await supabase
    .from('client_meal_plans')
    .select('id, name, total_calories, content, coach_id')
    .eq('id', planId)
    .eq('client_id', clientId)
    .eq('coach_id', coachId)
    .single()

  if (fetchError || !plan) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  // Insert into the meal_plans template table
  const { data: template, error: insertError } = await supabase
    .from('meal_plans')
    .insert({
      coach_id: coachId,
      name: plan.name,
      goal: 'omnivore',
      total_calories: plan.total_calories ?? 0,
      content: plan.content,
    })
    .select('id')
    .single()

  if (insertError || !template) {
    return Response.json({ error: insertError?.message ?? 'Failed to create template' }, { status: 500 })
  }

  return Response.json({ id: template.id })
}
