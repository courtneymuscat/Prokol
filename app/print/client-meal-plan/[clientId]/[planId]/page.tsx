import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import { redirect } from 'next/navigation'
import PrintMealPlan from '@/app/components/PrintMealPlan'

type Props = { params: Promise<{ clientId: string; planId: string }> }

export default async function Page({ params }: Props) {
  const { clientId, planId } = await params
  const coachId = await requireCoach()
  if (!coachId) redirect('/login')

  const admin = createAdminClient()
  const { data: plan } = await admin
    .from('client_meal_plans')
    .select('*')
    .eq('id', planId)
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .single()

  if (!plan) redirect(`/coach/clients/${clientId}`)

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, email')
    .eq('id', clientId)
    .maybeSingle()

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
