import { redirect } from 'next/navigation'
import { requireCoach } from '@/lib/coach'
import { createClient } from '@/lib/supabase/server'
import MealPlansList from './MealPlansList'

export default async function MealPlansPage() {
  const coachId = await requireCoach()
  if (!coachId) redirect('/dashboard')

  const supabase = await createClient()
  const { data } = await supabase
    .from('meal_plans')
    .select('*')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false })

  return <MealPlansList plans={data ?? []} />
}
