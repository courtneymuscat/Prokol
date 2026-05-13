import { redirect } from 'next/navigation'
import { requireCoach } from '@/lib/coach'
import { createClient } from '@/lib/supabase/server'
import { fetchOrgTemplatesForCoach, getOrgForUser } from '@/lib/org'
import MealPlansList from './MealPlansList'

export default async function MealPlansPage() {
  const coachId = await requireCoach()
  if (!coachId) redirect('/dashboard')

  const supabase = await createClient()
  const [{ data }, orgItems, membership] = await Promise.all([
    supabase
      .from('meal_plans')
      .select('*')
      .eq('coach_id', coachId)
      .eq('is_org_template', false)
      .order('created_at', { ascending: false }),
    fetchOrgTemplatesForCoach<{ id: string } & Record<string, unknown>>(coachId, 'meal_plans', '*'),
    getOrgForUser(coachId),
  ])

  const own = ((data ?? []) as Record<string, unknown>[]).map((p) => ({ ...p, is_org_template: false }))
  const org = orgItems.map((p) => ({ ...p, is_org_template: true }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <MealPlansList plans={[...org, ...own] as any} orgName={membership?.org_name ?? null} orgRole={membership?.role ?? null} />
}
