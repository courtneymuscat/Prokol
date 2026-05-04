import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSubscription } from '@/lib/subscription'
import { FEATURES } from '@/lib/features'
import { logout } from '@/app/actions/auth'
import { headers } from 'next/headers'
import { getBrandingFromHeaders, DEFAULT_BRANDING } from '@/lib/branding'

import DailyLog from './DailyLog'
import DailyCheckIn from './DailyCheckIn'
import WeightLog from './WeightLog'
import WeightChart from './WeightChart'
import MealSection from './MealSection'
import FormsSection from './FormsSection'
import CoachBanner from './CoachBanner'
import UpgradePrompt from '@/components/UpgradePrompt'
import MealPlanView from './MealPlanView'
import HabitsPanel from './HabitsPanel'
import GoalsPanel from './GoalsPanel'
import CoachingSection from './CoachingSection'
import DashboardTour from './DashboardTour'
import ProfileCompletionPrompt from './ProfileCompletionPrompt'
import SupplementsPanel from './SupplementsPanel'
import ProtocolPanel from './ProtocolPanel'
import PaymentFailedBanner from './PaymentFailedBanner'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const headersList = await headers()
  const branding = getBrandingFromHeaders(headersList)

  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const user = session?.user
  if (!user) redirect('/login')

  // Check onboarding status + fetch targets
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed, goal, target_calories, target_protein, target_carbs, target_fat, tdee, sex, full_name, subscription_tier, phone, date_of_birth, payment_failed_at')
    .eq('id', user.id)
    .single()
  // Everyone reaches the dashboard — profile setup for individuals is prompted inline.

  // Subscription feature access
  const sub = await getSubscription()
  const canWeightChart      = sub.canAccess(FEATURES.WEIGHT_TRACKING)
  const canMealBuilder      = sub.canAccess(FEATURES.MEAL_BUILDER)
  const canFullCheckin      = sub.canAccess(FEATURES.DAILY_CHECKIN)
  const canMealScanner        = sub.canAccess(FEATURES.MEAL_SCANNER)
  const canAdvancedAnalytics  = sub.canAccess(FEATURES.ADVANCED_ANALYTICS)

  const isCoach   = sub.userType === 'coach'
  const isCoached = sub.tier === 'coached'
  let coachEmail: string | null = null

  let showDailyTargets = true
  let foodLogAccess = 'full'
  let showMealBuilder = true
  let showSavedMeals = true
  let hasMealPlan = false
  let hasHabits = false

  let pendingFormId: string | null = null
  let pendingFeedbacks: { eventId: string; dayName: string }[] = []
  let coachBrandColour: string | null = null
  let coachLogoUrl: string | null = null
  let coachBrandName: string | null = null

  if (isCoached) {
    const { data: coachRel } = await supabase
      .from('coach_clients')
      .select('coach_id, show_daily_targets, food_log_access, show_meal_builder, show_saved_meals, targets_source, targets_meal_plan_id')
      .eq('client_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (coachRel) {
      const rel = coachRel as Record<string, unknown>
      showDailyTargets = coachRel.show_daily_targets ?? true
      foodLogAccess = (coachRel.food_log_access as string) ?? 'full'
      showMealBuilder = rel.show_meal_builder as boolean ?? true
      showSavedMeals = rel.show_saved_meals as boolean ?? true

      // If coach has selected meal plan as target source, override profile targets with plan macros
      if (rel.targets_source === 'meal_plan' && rel.targets_meal_plan_id) {
        try {
          const admin = createAdminClient()
          const { data: plan } = await admin
            .from('client_meal_plans')
            .select('content, total_calories')
            .eq('id', rel.targets_meal_plan_id as string)
            .single()
          if (plan) {
            type MealFood = { calories?: number; protein?: number; carbs?: number; fat?: number }
            type MealSlot = { foods?: MealFood[] }
            let cal = 0, pro = 0, carb = 0, fat = 0
            for (const slot of (Array.isArray(plan.content) ? plan.content : []) as MealSlot[]) {
              for (const food of (Array.isArray(slot?.foods) ? slot.foods : []) as MealFood[]) {
                cal  += Number(food?.calories) || 0
                pro  += Number(food?.protein)  || 0
                carb += Number(food?.carbs)    || 0
                fat  += Number(food?.fat)      || 0
              }
            }
            if (cal > 0 || (plan.total_calories ?? 0) > 0) {
              // Patch the profile object with meal plan targets (only in memory, no DB write)
              if (profile) {
                (profile as Record<string, unknown>).target_calories = cal > 0 ? Math.round(cal) : plan.total_calories
                if (pro > 0) (profile as Record<string, unknown>).target_protein = Math.round(pro)
                if (carb > 0) (profile as Record<string, unknown>).target_carbs = Math.round(carb)
                if (fat > 0) (profile as Record<string, unknown>).target_fat = Math.round(fat)
              }
            }
          }
        } catch { /* meal plan fetch failed, fall back to profile targets */ }
      }

      const admin = createAdminClient()
      const { data: coachProfile } = await admin
        .from('profiles')
        .select('email, brand_colour, logo_url, brand_name')
        .eq('id', coachRel.coach_id)
        .single()
      coachEmail = coachProfile?.email ?? null
      coachBrandColour = (coachProfile as Record<string, unknown>)?.brand_colour as string | null ?? null
      coachLogoUrl = (coachProfile as Record<string, unknown>)?.logo_url as string | null ?? null
      coachBrandName = (coachProfile as Record<string, unknown>)?.brand_name as string | null ?? null
    }

    // Check for a pending coach-assigned form (not yet submitted by this client)
    try {
      const { data: formRow } = await supabase
        .from('coach_clients')
        .select('form_id')
        .eq('client_id', user.id)
        .eq('status', 'active')
        .maybeSingle()
      const coachFormId = (formRow as Record<string, unknown>)?.form_id as string | null ?? null
      if (coachFormId) {
        const { data: submission } = await supabase
          .from('form_submissions')
          .select('id')
          .eq('form_id', coachFormId)
          .eq('client_id', user.id)
          .not('submitted_at', 'is', null)
          .maybeSingle()
        if (!submission) pendingFormId = coachFormId
      }
    } catch { /* form_id column may not exist yet */ }

    // Check for unseen coach feedback on workout results — collect ALL unseen, not just the first
    try {
      const { data: feedbackEvents } = await supabase
        .from('calendar_events')
        .select('id, content, event_date')
        .eq('client_id', user.id)
        .eq('type', 'program_workout_result')
        .order('event_date', { ascending: false })
        .limit(30)
      pendingFeedbacks = (feedbackEvents ?? [])
        .filter((e) => {
          const c = e.content as Record<string, unknown>
          return c.feedback_left_at && !c.feedback_seen
        })
        .map((e) => {
          const c = e.content as Record<string, unknown>
          return {
            eventId: e.id,
            dayName: (c.day_name as string | undefined) ?? 'your workout',
          }
        })
    } catch { /* silent */ }

    const [mealPlanResult, habitsResult] = await Promise.all([
      supabase
        .from('client_meal_plans')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', user.id)
        .eq('status', 'active'),
      supabase
        .from('habits')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', user.id)
        .eq('active', true),
    ])
    hasMealPlan = (mealPlanResult.count ?? 0) > 0
    hasHabits = (habitsResult.count ?? 0) > 0
  }

  // For coached clients on the main domain, apply coach's branding over defaults
  const effectiveLogo = coachLogoUrl ?? branding.logoUrl
  const effectiveName = coachBrandName ?? branding.appName
  const effectiveColour = coachBrandColour ?? branding.brandColour

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Inject coach brand colour override for coached clients */}
      {isCoached && !branding.isWhiteLabel && coachBrandColour && (
        <style dangerouslySetInnerHTML={{ __html: `:root { --brand-primary: ${coachBrandColour}; }` }} />
      )}
      <DashboardTour />
      {/* Payment failure banner — shown when Stripe couldn't charge the card */}
      {!isCoached && !!((profile as Record<string, unknown>)?.payment_failed_at) && (
        <PaymentFailedBanner paymentFailedAt={(profile as Record<string, unknown>).payment_failed_at as string} />
      )}
      {/* Nav */}
      <nav className="bg-white px-6 py-3.5 flex justify-between items-center border-b border-gray-100 sticky top-0 z-20">
        {effectiveLogo ? (
          <div className="flex items-center gap-2.5">
            <img src={effectiveLogo} alt={effectiveName} className="h-9 w-9 object-cover rounded-full border border-gray-100 flex-shrink-0" />
            {coachBrandName && (
              <span className="text-[15px] font-bold tracking-tight text-gray-900">{coachBrandName}</span>
            )}
          </div>
        ) : (
          <span className="text-[15px] font-bold tracking-tight text-gray-900"
            style={{ color: coachBrandColour ?? undefined }}>
            {effectiveName}
          </span>
        )}
        <div className="flex items-center gap-1">
          {/* Desktop-only nav links — bottom tab bar handles mobile */}
          <div className="hidden md:flex items-center gap-1">
            {[
              ...(isCoached ? [{ href: '/calendar', label: 'Calendar', id: undefined }] : [{ href: '/workouts', label: 'Workouts', id: undefined }]),
              ...(profile?.sex !== 'male' ? [{ href: '/cycle', label: 'Cycle', id: undefined }] : []),
              { href: '/progress', label: 'Progress Photos', id: undefined },
              ...(isCoach ? [{ href: '/coach/dashboard', label: 'Coach Dashboard', id: undefined }] : []),
              ...(isCoached ? [{ href: '/messages', label: 'Messages', id: undefined }] : []),
              ...(isCoached ? [{ href: '/cheat-sheet', label: 'Cheat Sheet', id: undefined }] : []),
              ...(!isCoach && !branding.isWhiteLabel && !coachBrandName && !coachLogoUrl ? [{ href: '/pricing', label: 'Upgrade', id: undefined }] : []),
              { href: '/settings', label: 'Settings', id: 'tour-settings' },
            ].map(({ href, label, id }) => (
              <a key={href} href={href} id={id} className="text-[13px] font-medium text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                {label}
              </a>
            ))}
          </div>
          <span className="text-[13px] text-gray-400 px-2 hidden md:block">
            {(profile as Record<string, unknown>)?.full_name as string || user.email}
          </span>
          <form action={logout}>
            <button type="submit" className="text-[13px] font-medium text-gray-500 hover:text-red-500 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
              Log out
            </button>
          </form>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto p-6 space-y-8">
        {/* Welcome */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">
              Welcome back{(profile as Record<string, unknown>)?.full_name ? `, ${(profile as Record<string, unknown>).full_name}` : ''}!
            </h2>
            <p className="text-gray-500 mt-1 text-sm">{user.email}</p>
          </div>
          {/* Tier badge */}
          <a href="/pricing" className="text-xs font-semibold px-3 py-1.5 rounded-full border hover:opacity-80 transition-colors" style={{
            backgroundColor: isCoach ? '#eff6ff' : sub.tier === 'individual_elite' ? '#f3e8ff' : sub.tier === 'individual_optimiser' || sub.tier === 'coached' ? 'rgba(29,158,117,0.08)' : '#f3f4f6',
            color: isCoach ? '#1d4ed8' : sub.tier === 'individual_elite' ? '#7c3aed' : sub.tier === 'individual_optimiser' || sub.tier === 'coached' ? '#1D9E75' : '#6b7280',
            borderColor: isCoach ? '#bfdbfe' : sub.tier === 'individual_elite' ? '#e9d5ff' : sub.tier === 'individual_optimiser' || sub.tier === 'coached' ? 'rgba(29,158,117,0.18)' : '#e5e7eb',
          }}>
            {isCoach
              ? `Coach — ${sub.tier === 'coach_business' ? 'Business' : sub.tier === 'coach_pro' ? 'Pro' : 'Solo'}`
              : sub.tier === 'individual_elite' ? 'Elite'
              : sub.tier === 'individual_optimiser' ? 'Optimiser'
              : sub.tier === 'coached' ? 'Coached'
              : 'Tracker — Free'}
          </a>
        </div>

        {/* Coach switch banner */}
        {isCoach && (
          <a
            href="/coach/dashboard"
            className="flex items-center justify-between gap-4 rounded-2xl px-5 py-4 transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#1D9E75' }}
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 flex-shrink-0 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-white">Go to Coach Dashboard</p>
                <p className="text-xs mt-0.5 text-white/70">Manage your clients, check-ins, and forms</p>
              </div>
            </div>
            <svg className="w-4 h-4 flex-shrink-0 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        )}

        {/* Coach banner removed — branding shown in nav instead */}

        {/* Coach-assigned form — shown at top until submitted */}
        {pendingFormId && (
          <a
            href={`/forms/${pendingFormId}`}
            className="flex items-center justify-between rounded-2xl px-5 py-4 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'rgba(29,158,117,0.08)', border: '1px solid rgba(29,158,117,0.18)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(29,158,117,0.15)' }}>
                <svg className="w-5 h-5" style={{ color: '#1D9E75' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Your coach has sent you a form</p>
                <p className="text-xs text-gray-500 mt-0.5">Tap to fill it in.</p>
              </div>
            </div>
            <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#1D9E75' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        )}

        {/* Coach workout feedback notifications — one per unseen workout */}
        {pendingFeedbacks.map((fb) => (
          <a
            key={fb.eventId}
            href={`/calendar?event=${fb.eventId}`}
            className="flex items-center justify-between rounded-2xl px-5 py-4 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(245,158,11,0.15)' }}>
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Your coach left feedback</p>
                <p className="text-xs text-gray-500 mt-0.5">On {fb.dayName} — tap to view</p>
              </div>
            </div>
            <svg className="w-4 h-4 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        ))}

        {/* Individual clients who haven't set up their profile yet */}
        {!isCoached && !profile?.onboarding_completed && (
          <a
            href="/onboarding"
            className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 hover:bg-blue-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-200 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-blue-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-blue-900">Set up your profile</p>
                <p className="text-xs text-blue-700 mt-0.5">Get personalised calorie and macro targets based on your goal and activity.</p>
              </div>
            </div>
            <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        )}

        {/* Profile completion prompt — coached clients who haven't set their name */}
        {isCoached && !(profile as Record<string, unknown>)?.full_name && (
          <ProfileCompletionPrompt
            initialName=""
            initialPhone={(profile as Record<string, unknown>)?.phone as string ?? ''}
            initialDob={(profile as Record<string, unknown>)?.date_of_birth as string ?? ''}
          />
        )}

        {/* Tasks, check-ins — coached clients only; shows "all caught up" when nothing is due */}
        {isCoached && <CoachingSection />}

        {/* Goals — set by coach */}
        {isCoached && <GoalsPanel />}
        {isCoached && <ProtocolPanel />}
        {isCoached && <SupplementsPanel />}

        {/* Daily targets card */}
        {(!isCoached || showDailyTargets) && profile?.target_calories ? (
          <div id="tour-targets" className="bg-white rounded-2xl border px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Daily targets</p>
              {!isCoached && <a href="/onboarding" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Recalculate →</a>}
            </div>
            <div className="grid grid-cols-4 gap-3 text-center">
              <div>
                <p className="text-xl font-bold text-gray-900">{profile.target_calories}</p>
                <p className="text-xs text-gray-400 mt-0.5">kcal</p>
              </div>
              <div>
                <p className="text-xl font-bold text-purple-400">{profile.target_protein}g</p>
                <p className="text-xs text-gray-400 mt-0.5">protein</p>
              </div>
              <div>
                <p className="text-xl font-bold text-green-400">{profile.target_carbs}g</p>
                <p className="text-xs text-gray-400 mt-0.5">carbs</p>
              </div>
              <div>
                <p className="text-xl font-bold text-blue-400">{profile.target_fat}g</p>
                <p className="text-xs text-gray-400 mt-0.5">fat</p>
              </div>
            </div>
          </div>
        ) : !isCoached && (
          <div className="bg-white rounded-2xl border border-dashed px-5 py-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-700">No targets set yet</p>
              <p className="text-xs text-gray-400 mt-0.5">Get personalised calorie & macro targets based on your activity.</p>
            </div>
            <a href="/onboarding" className="flex-shrink-0 text-sm font-semibold px-4 py-2 rounded-xl text-gray-900 ml-4" style={{ backgroundColor: '#1D9E75' }}>
              Set targets →
            </a>
          </div>
        )}

        {/* Weight — log + chart */}
        <section id="tour-weight" className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
          <WeightLog />
          {canWeightChart
            ? <WeightChart />
            : <UpgradePrompt plan="Optimiser" feature="Weight trend chart" />
          }
        </section>

        {/* Coached-only sections: Meal Plan, Habits */}
        {isCoached && hasMealPlan && (
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">My Meal Plan</p>
            <MealPlanView />
          </section>
        )}

        {isCoached && hasHabits && (
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Daily Habits</p>
            <HabitsPanel />
          </section>
        )}

        {/* Daily Food Log */}
        <div id="tour-food-log">
        <DailyLog
          canScanMeal={canMealScanner && foodLogAccess !== 'no_scan' && foodLogAccess !== 'note_only' && foodLogAccess !== 'off'}
          foodLogAccess={isCoached ? foodLogAccess as 'full' | 'no_scan' | 'note_only' | 'off' : 'full'}
          targetCalories={(!isCoached || showDailyTargets) ? (profile?.target_calories ?? null) : null}
          targetProtein={(!isCoached || showDailyTargets) ? (profile?.target_protein ?? null) : null}
          targetCarbs={(!isCoached || showDailyTargets) ? (profile?.target_carbs ?? null) : null}
          targetFat={(!isCoached || showDailyTargets) ? (profile?.target_fat ?? null) : null}
        />
        </div>

        {/* Elite teaser — AI meal scanner */}
        {!canMealScanner && (
          <div className="flex items-center gap-4 bg-purple-50 border border-purple-100 rounded-2xl px-5 py-4">
            <span className="text-2xl">📸</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-purple-900">Log meals instantly with AI</p>
              <p className="text-xs text-purple-600 mt-0.5">Take a photo of your meal and let AI detect and log the foods automatically.</p>
            </div>
            <a href="/pricing" className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg text-purple-900 hover:opacity-90 transition-colors" style={{ backgroundColor: '#e9d5ff' }}>
              Try Elite →
            </a>
          </div>
        )}

        {/* Meal Builder + Saved Meals */}
        {(!isCoached || showMealBuilder || showSavedMeals) && (
          <section>
            {canMealBuilder
              ? <MealSection showMealBuilder={!isCoached || showMealBuilder} showSavedMeals={!isCoached || showSavedMeals} />
              : <UpgradePrompt plan="Optimiser" feature="Meal builder & saved meals" />
            }
          </section>
        )}


        {/* Advanced Analytics — teaser for non-Elite */}
        {!canAdvancedAnalytics && (
          <div className="flex items-center gap-4 bg-purple-50 border border-purple-100 rounded-2xl px-5 py-4">
            <span className="text-2xl">📊</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-purple-900">Advanced Analytics</p>
              <p className="text-xs text-purple-600 mt-0.5">Spot trends across your nutrition, training, and recovery — all in one dashboard.</p>
            </div>
            <a href="/pricing" className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg text-purple-900 hover:opacity-90 transition-colors" style={{ backgroundColor: '#e9d5ff' }}>
              Try Elite →
            </a>
          </div>
        )}

        {/* Coach Forms — coached clients use ScheduledCheckIns instead */}
        {!isCoached && <FormsSection />}

        {/* Daily Check-In — hidden for coached clients (they use coach-assigned check-in forms) */}
        {!isCoached && (
          <div id="daily-checkin">
            <DailyCheckIn fullAccess={canFullCheckin} />
          </div>
        )}
      </main>
    </div>
  )
}
