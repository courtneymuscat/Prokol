import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import { redirect } from 'next/navigation'
import ClientMealPlanEditor from './ClientMealPlanEditor'

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

  return <ClientMealPlanEditor clientId={clientId} plan={plan} />
}
