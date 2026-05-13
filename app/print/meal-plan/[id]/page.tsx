import { redirect, notFound } from 'next/navigation'
import { requireCoach } from '@/lib/coach'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrgForUser } from '@/lib/org'
import PrintMealPlan from '@/app/components/PrintMealPlan'

export default async function MealPlanPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const coachId = await requireCoach()
  if (!coachId) redirect('/dashboard')

  const supabase = await createClient()
  const { data: own } = await supabase
    .from('meal_plans')
    .select('*')
    .eq('id', id)
    .eq('coach_id', coachId)
    .maybeSingle()

  let plan = own
  if (!plan) {
    const membership = await getOrgForUser(coachId)
    if (membership && membership.role !== 'owner') {
      const admin = createAdminClient()
      const { data: orgPlan } = await admin
        .from('meal_plans')
        .select('*')
        .eq('id', id)
        .eq('org_id', membership.org_id)
        .eq('is_org_template', true)
        .maybeSingle()
      plan = orgPlan
    }
  }

  if (!plan) notFound()

  return (
    <PrintMealPlan
      plan={{
        name: plan.name,
        total_calories: plan.total_calories,
        content: Array.isArray(plan.content) ? plan.content : [],
      }}
    />
  )
}
