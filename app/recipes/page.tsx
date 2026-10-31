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
  // Coached clients always see the Meal Library (their coach's recipes,
  // plus platform recipes once PLATFORM_RECIPE_LIBRARY is on for 'coached'
  // tier) — individual users need Optimiser+ to see it at all.
  const canAccessLibrary = isCoached || sub.canAccess(FEATURES.PLATFORM_RECIPE_LIBRARY)

  return <RecipesPageClient canUseSavedMeals={canUseSavedMeals} canAccessLibrary={canAccessLibrary} />
}
