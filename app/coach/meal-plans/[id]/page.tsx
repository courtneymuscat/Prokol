import { redirect, notFound } from 'next/navigation'
import { requireCoach } from '@/lib/coach'
import { createClient } from '@/lib/supabase/server'
import { seedCoachTemplates } from '@/lib/seed-coach-templates'
import MealPlanEditor from './MealPlanEditor'

export default async function MealPlanPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const coachId = await requireCoach()
  if (!coachId) redirect('/dashboard')

  // Run seed check so template content (labels, notes) stays up to date
  await seedCoachTemplates(coachId)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('meal_plans')
    .select('*')
    .eq('id', id)
    .eq('coach_id', coachId)
    .single()

  if (error || !data) notFound()

  return <MealPlanEditor plan={data} />
}
