import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PrintMealPlan from '@/app/components/PrintMealPlan'

// Client-facing counterpart to app/print/client-meal-plan/[clientId]/[planId]
// (which is coach-only) — lets a client download/print their own assigned
// meal plan. Same PrintMealPlan component, just scoped to the signed-in
// client's own plan instead of requiring coach access.
export default async function MyMealPlanPrintPage({
  params,
}: {
  params: Promise<{ planId: string }>
}) {
  const { planId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: plan }, { data: profile }] = await Promise.all([
    supabase
      .from('client_meal_plans')
      .select('name, total_calories, content, notes, start_date, end_date, show_macros')
      .eq('id', planId)
      .eq('client_id', user.id)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle(),
  ])

  if (!plan) notFound()

  const clientName = profile?.full_name?.trim() || profile?.email || null

  return (
    <PrintMealPlan
      plan={{
        name: plan.name,
        total_calories: plan.total_calories,
        content: Array.isArray(plan.content) ? plan.content : [],
        notes: plan.notes,
        start_date: plan.start_date,
        end_date: plan.end_date,
        show_macros: plan.show_macros,
      }}
      clientName={clientName}
    />
  )
}
