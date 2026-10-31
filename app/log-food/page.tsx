import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSubscription } from '@/lib/subscription'
import { FEATURES } from '@/lib/features'
import DailyLog from '@/app/dashboard/DailyLog'
import MealSection from '@/app/dashboard/MealSection'
import UpgradePrompt from '@/components/UpgradePrompt'

export const dynamic = 'force-dynamic'

export default async function LogFoodPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Today in local-ish format — same derivation as app/dashboard/page.tsx,
  // so "today's" food log lines up between the two pages.
  const todayLocal = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  const [sub, { data: profile }, { data: coachRel }, { data: foodLogsRaw }, { data: mealNotesRaw }] = await Promise.all([
    getSubscription(),
    supabase
      .from('profiles')
      .select('target_calories, target_protein, target_carbs, target_fat')
      .eq('id', user.id)
      .single(),
    supabase
      .from('coach_clients')
      .select('show_daily_targets, food_log_access, show_meal_builder, show_saved_meals')
      .eq('client_id', user.id)
      .eq('status', 'active')
      .maybeSingle(),
    supabase
      .from('food_logs')
      .select('id, food_name, calories, protein, carbs, fat, notes, meal_notes, meal_photo_url, meal_type, serving_description')
      .eq('user_id', user.id)
      .eq('log_date', todayLocal)
      .order('created_at', { ascending: true }),
    supabase
      .from('meal_notes')
      .select('meal_type, note, photo_url')
      .eq('user_id', user.id)
      .eq('log_date', todayLocal),
  ])

  const isCoached = !!coachRel
  const showDailyTargets = (coachRel?.show_daily_targets as boolean | null) ?? false
  const foodLogAccess = (coachRel?.food_log_access as 'full' | 'no_scan' | 'note_only' | 'off' | null) ?? 'full'
  const showMealBuilder = (coachRel?.show_meal_builder as boolean | null) ?? true
  const showSavedMeals = (coachRel?.show_saved_meals as boolean | null) ?? true

  const canMealScanner = sub.canAccess(FEATURES.MEAL_SCANNER)
  const canMealBuilder = sub.canAccess(FEATURES.MEAL_BUILDER)
  const canUseSavedMeals = canMealBuilder && (!isCoached || showSavedMeals)

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-3.5 flex items-center gap-3 sticky top-0 z-20">
        <a href="/dashboard" className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </a>
        <h1 className="text-[15px] font-bold tracking-tight text-gray-900">Log Food</h1>
      </nav>

      <main className="max-w-2xl mx-auto p-6 space-y-6">
        <DailyLog
          canScanMeal={canMealScanner && foodLogAccess !== 'no_scan' && foodLogAccess !== 'note_only' && foodLogAccess !== 'off'}
          canUseSavedMeals={canUseSavedMeals}
          foodLogAccess={isCoached ? foodLogAccess : 'full'}
          targetCalories={(!isCoached || showDailyTargets) ? (profile?.target_calories ?? null) : null}
          targetProtein={(!isCoached || showDailyTargets) ? (profile?.target_protein ?? null) : null}
          targetCarbs={(!isCoached || showDailyTargets) ? (profile?.target_carbs ?? null) : null}
          targetFat={(!isCoached || showDailyTargets) ? (profile?.target_fat ?? null) : null}
          initialDate={todayLocal}
          initialFoodLogs={foodLogsRaw ?? []}
          initialMealNotes={mealNotesRaw ?? []}
        />

        {!canMealScanner && (
          <div className="flex items-center gap-4 bg-teal-50 border border-teal-100 rounded-2xl px-5 py-4">
            <span className="text-2xl">📸</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-teal-900">Log meals instantly with AI</p>
              <p className="text-xs text-teal-600 mt-0.5">Take a photo of your meal and let AI detect and log the foods automatically.</p>
            </div>
            <a href="/pricing" className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg text-teal-900 hover:opacity-90 transition-colors" style={{ backgroundColor: '#e9d5ff' }}>
              Try Elite →
            </a>
          </div>
        )}

        {(!isCoached || showMealBuilder) && (
          <section>
            {canMealBuilder
              ? <MealSection showMealBuilder={!isCoached || showMealBuilder} />
              : <UpgradePrompt plan="Optimiser" feature="Meal builder" />
            }
          </section>
        )}
      </main>
    </div>
  )
}
