import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSubscription } from '@/lib/subscription'
import { FEATURES } from '@/lib/features'
import RecipesPageClient from './RecipesPageClient'

export const dynamic = 'force-dynamic'

export default async function RecipesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [sub, { data: coachRel }] = await Promise.all([
    getSubscription(),
    supabase
      .from('coach_clients')
      .select('show_saved_meals')
      .eq('client_id', user.id)
      .eq('status', 'active')
      .maybeSingle(),
  ])

  const isCoached = !!coachRel
  const showSavedMeals = (coachRel?.show_saved_meals as boolean | null) ?? true
  const canUseSavedMeals = sub.canAccess(FEATURES.MEAL_BUILDER) && (!isCoached || showSavedMeals)

  return <RecipesPageClient canUseSavedMeals={canUseSavedMeals} />
}
