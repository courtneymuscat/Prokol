import { redirect } from 'next/navigation'
import { after } from 'next/server'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  FEATURES,
  computeFeatureSet,
  type Feature,
  type SubscriptionTier,
  type UserType,
} from '@/lib/features'
import { getFeatureOverrides } from '@/lib/feature-matrix'
import { logout } from '@/app/actions/auth'
import { headers } from 'next/headers'
import { getBrandingFromHeaders, DEFAULT_BRANDING } from '@/lib/branding'
import { syncProfileFromStripe } from '@/lib/billing'
import { resolveEffectiveTarget } from '@/lib/effectiveTarget'

import DailyCheckIn from './DailyCheckIn'
import WeightLog from './WeightLog'
import WeightChart from './WeightChart'
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
import WeeklyPlanCard from './WeeklyPlanCard'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const headersList = await headers()
  const branding = getBrandingFromHeaders(headersList)

  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const user = session?.user
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Today in local-ish format for the food log default selection. The client
  // component re-fetches if the user picks a different date, but seeding it
  // here means today's meals paint immediately without a post-hydration spinner.
  const todayLocal = (() => {
    // eslint-disable-next-line react-hooks/purity -- server component, runs once per request
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  // ── Top-level parallel batch ────────────────────────────────────────────────
  // Combines the profile, coach relationship, pending org invite, feature
  // overrides, AND the top-of-page panel data (weight history, today's food
  // logs and meal notes) into one round-trip group. Previously the panels
  // refetched everything from the browser after hydration — visible spinner
  // cascade for ~1–2 s on mobile.
  const [
    profileRes,
    coachRelRes,
    pendingInviteRes,
    featureOverrides,
    weightLogsRes,
    foodLogsRes,
    mealNotesRes,
    mealPlanCountRes,
    habitsCountRes,
    feedbackEventsRes,
    serveTargetsRes,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'onboarding_completed, goal, target_calories, target_protein, target_carbs, target_fat, tdee, sex, full_name, subscription_tier, user_type, phone, date_of_birth, payment_failed_at, stripe_customer_id, stripe_last_synced_at',
      )
      .eq('id', user.id)
      .single(),
    // form_id included here so we don't need a second query for it in the
    // coached branch below.
    admin
      .from('coach_clients')
      .select('coach_id, show_daily_targets, show_serve_targets, food_log_access, show_meal_builder, show_saved_meals, targets_source, targets_meal_plan_id, form_id')
      .eq('client_id', user.id)
      .eq('status', 'active')
      .maybeSingle(),
    user.email
      ? admin
          .from('org_invites')
          .select('token, org_id, role')
          .eq('email', user.email.toLowerCase())
          .eq('is_active', true)
          .gt('expires_at', new Date().toISOString())
          .is('accepted_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    getFeatureOverrides().catch(() => ({} as Record<string, Record<string, boolean>>)),
    supabase
      .from('weight_logs')
      .select('id, weight_lbs, weight_unit, logged_at')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false })
      .limit(60),
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
    // Meal plan + habits counts — independent of the coachRel settings row
    // (a client may have a meal plan even if the coach relationship row is
    // momentarily missing), so they live at the top level rather than gated
    // on coachRel below.
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
    // Unseen coach workout feedback — keyed only on client_id, so independent
    // of the coachRel settings row. The original code computed this whenever
    // isCoached, not gated on coachRel, so we mirror that here.
    supabase
      .from('calendar_events')
      .select('id, content, event_date')
      .eq('client_id', user.id)
      .eq('type', 'program_workout_result')
      .order('event_date', { ascending: false })
      .limit(30),
    // Serve targets (set by the coach) — shown here same as in the food log
    // and /cheat-sheet, i.e. whenever they exist, independent of the
    // show_daily_targets toggle (that one's specifically about the
    // calorie/macro numbers, not serve counts).
    supabase
      .from('client_serve_targets')
      .select('protein_serves, carb_serves, fat_serves, veg_unlimited, notes')
      .eq('client_id', user.id)
      .maybeSingle(),
  ])

  const profile = profileRes.data
  const coachRel = coachRelRes.data
  // show_serve_targets defaults true (same fallback as /api/client/serve-targets
  // and the settings route) — only an explicit false actually hides it.
  // This card queries client_serve_targets directly (server component, not
  // the API route) so it needs its own check — missed when the toggle was
  // first built, which is why it was leaking regardless of the toggle.
  const serveTargets = (coachRel as Record<string, unknown> | null)?.show_serve_targets === false ? null : serveTargetsRes.data
  const pendingInvite = pendingInviteRes.data
  const initialWeightLogs = weightLogsRes.data ?? []
  const initialFoodLogs = foodLogsRes.data ?? []
  const initialMealNotes = mealNotesRes.data ?? []
  // For the "Log food" shortcut card's at-a-glance totals below — the full
  // food log itself now lives on /log-food, not inline on this page.
  const todayFoodTotals = initialFoodLogs.reduce(
    (acc, f) => ({
      calories: acc.calories + (f.calories ?? 0),
      protein: acc.protein + (f.protein ?? 0),
      carbs: acc.carbs + (f.carbs ?? 0),
      fat: acc.fat + (f.fat ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
  const hasMealPlan = (mealPlanCountRes.count ?? 0) > 0
  const hasHabits = (habitsCountRes.count ?? 0) > 0
  const pendingFeedbacks: { eventId: string; dayName: string }[] = (feedbackEventsRes.data ?? [])
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

  // Pending org invite — redirect if not already a member. Kept synchronous
  // because a redirect must complete before render; the membership check is
  // only hit on the rare hot-path where an invite is actually present.
  if (pendingInvite) {
    const { data: existingMember } = await admin
      .from('org_members')
      .select('id')
      .eq('org_id', pendingInvite.org_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()
    if (!existingMember) {
      redirect(`/org/invite/${pendingInvite.token}`)
    }
  }

  // Reconcile against Stripe when the profile looks suspicious. Throttled to
  // once per hour and run via `after()` so the dashboard never blocks on
  // Stripe round-trips — the webhook is the primary sync mechanism.
  {
    const looksFree =
      profile?.subscription_tier === 'individual_free' || profile?.subscription_tier == null
    const lastSynced = (profile as Record<string, unknown> | null)?.stripe_last_synced_at as string | null
    // Server component renders once per request — Date.now() is the correct
    // way to read "now". The React purity lint is intended for client renders.
    // eslint-disable-next-line react-hooks/purity
    const nowMs = Date.now()
    const recentlySynced = lastSynced
      ? nowMs - new Date(lastSynced).getTime() < 60 * 60 * 1000
      : false
    if (!recentlySynced && (profile?.stripe_customer_id || looksFree)) {
      after(async () => {
        try {
          await syncProfileFromStripe(user.id)
        } catch (err) {
          console.error('dashboard: syncProfileFromStripe failed', err)
        }
      })
    }
  }

  // Coaches belong on /coach/dashboard, not the tracker page.
  if (profile?.user_type === 'coach' || profile?.user_type === 'business') {
    redirect('/coach/dashboard')
  }

  // ── Inline subscription resolution ──────────────────────────────────────────
  // Replaces getSubscription() which would do another profile + coach_clients
  // read — we already have everything it needs from the parallel batch above.
  const storedTier = (profile?.subscription_tier as SubscriptionTier | null) ?? 'individual_free'
  const userType = (profile?.user_type as UserType | null) ?? 'individual'
  const tier: SubscriptionTier = coachRel ? 'coached' : storedTier
  const isCoach = userType === 'coach'
  const isCoached = tier === 'coached' || !!coachRel

  // Where the "Set up your profile" banner below should send someone who
  // hasn't set up targets yet. Defaults to /onboarding, but if they have an
  // active autoflow step with its own target calculator (see
  // TargetCalculatorWidget) that they haven't completed yet, send them
  // there instead — that's now the primary place signup-link/gym members
  // are expected to do this (see app/actions/auth.ts's signup()), so the
  // banner needs to match or it'd route them straight back to the flow we
  // deliberately skip for them.
  let setupProfileHref = '/onboarding'
  if (!profile?.onboarding_completed && !profile?.target_calories) {
    const { data: activeFlows } = await admin
      .from('client_autoflows')
      .select('id, template_id, start_date')
      .eq('client_id', user.id)
      .eq('status', 'active')
    for (const flow of activeFlows ?? []) {
      const { data: steps } = await admin
        .from('autoflow_template_steps')
        .select('step_number, day_offset, target_calc')
        .eq('template_id', flow.template_id)
        .not('target_calc', 'is', null)
        .order('step_number')
      if (!steps?.length) continue
      const { data: responses } = await admin
        .from('autoflow_responses')
        .select('step_number')
        .eq('client_autoflow_id', flow.id)
      const doneSteps = new Set((responses ?? []).map((r) => r.step_number as number))
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const startDate = new Date(flow.start_date + 'T00:00:00')
      const nextStep = steps.find((s) => {
        if (doneSteps.has(s.step_number)) return false
        const dueDate = new Date(startDate.getTime() + s.day_offset * 86400000)
        dueDate.setHours(0, 0, 0, 0)
        return dueDate <= today
      })
      if (nextStep) {
        setupProfileHref = `/autoflows/${flow.id}/${nextStep.step_number}`
        break
      }
    }
  }

  const featureSet = computeFeatureSet(tier, userType)
  for (const [feature, tierMap] of Object.entries(featureOverrides ?? {})) {
    const tm = tierMap as Record<string, boolean>
    if (tier in tm) {
      if (tm[tier]) featureSet.add(feature as Feature)
      else featureSet.delete(feature as Feature)
    }
  }
  const canAccess = (f: Feature) => featureSet.has(f)
  const canWeightChart = canAccess(FEATURES.WEIGHT_TRACKING)
  const canFullCheckin = canAccess(FEATURES.DAILY_CHECKIN)
  const canAdvancedAnalytics = canAccess(FEATURES.ADVANCED_ANALYTICS)

  let showDailyTargets = true

  let pendingFormId: string | null = null
  let coachBrandColour: string | null = null
  let coachLogoUrl: string | null = null
  let coachBrandName: string | null = null
  let coachEmail: string | null = null

  if (isCoached && coachRel) {
    const rel = coachRel as Record<string, unknown>
    showDailyTargets = (coachRel.show_daily_targets as boolean | null) ?? false
    const coachFormId = (rel.form_id as string | null) ?? null

    // ── Coached-branch parallel batch ──────────────────────────────────────────
    // Three independent coach-relationship-dependent reads. The effective
    // target resolution (meal-plan real totals, or the current week of a
    // visible "Weekly Changes" plan) is delegated to resolveEffectiveTarget
    // — the same single source of truth the coach's own TDEE card and the
    // Serve Guide sync use — instead of this page carrying its own
    // duplicate copy of the meal-plan-override math. `rel`/`profile` are
    // passed in since both are already fetched here, so this adds exactly
    // one new query (and only when targets_source is actually 'meal_plan'
    // or 'weekly_plan' — the common 'tdee' case adds none).
    const [
      coachProfileRes,
      effectiveTarget,
      submissionRes,
    ] = await Promise.all([
      admin
        .from('profiles')
        .select('email, brand_colour, logo_url, brand_name')
        .eq('id', coachRel.coach_id)
        .single(),
      resolveEffectiveTarget(admin, user.id, coachRel.coach_id, {
        rel: {
          targets_source: (rel.targets_source as string | null) ?? null,
          targets_meal_plan_id: (rel.targets_meal_plan_id as string | null) ?? null,
        },
        profile: profile
          ? {
              target_calories: (profile as Record<string, unknown>).target_calories as number | null,
              target_protein: (profile as Record<string, unknown>).target_protein as number | null,
              target_carbs: (profile as Record<string, unknown>).target_carbs as number | null,
              target_fat: (profile as Record<string, unknown>).target_fat as number | null,
            }
          : null,
      }),
      coachFormId
        ? supabase
            .from('form_submissions')
            .select('id')
            .eq('form_id', coachFormId)
            .eq('client_id', user.id)
            .not('submitted_at', 'is', null)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    const coachProfile = coachProfileRes.data
    coachEmail = coachProfile?.email ?? null
    coachBrandColour = (coachProfile as Record<string, unknown>)?.brand_colour as string | null ?? null
    coachLogoUrl = (coachProfile as Record<string, unknown>)?.logo_url as string | null ?? null
    coachBrandName = (coachProfile as Record<string, unknown>)?.brand_name as string | null ?? null

    // Patch profile in memory only — the stored row is untouched.
    if (profile && effectiveTarget.calories > 0) {
      (profile as Record<string, unknown>).target_calories = Math.round(effectiveTarget.calories)
      if (effectiveTarget.protein > 0) (profile as Record<string, unknown>).target_protein = Math.round(effectiveTarget.protein)
      if (effectiveTarget.carbs > 0) (profile as Record<string, unknown>).target_carbs = Math.round(effectiveTarget.carbs)
      if (effectiveTarget.fat > 0) (profile as Record<string, unknown>).target_fat = Math.round(effectiveTarget.fat)
    }

    if (coachFormId && !submissionRes.data) pendingFormId = coachFormId
  }

  // A coach's personal legacy branding (Settings > Branding) only applies
  // when their org isn't white-labelled — it used to take priority over
  // branding.* unconditionally, which meant a coach who'd set a personal
  // logo/colour before their org went white-label would keep overriding
  // the org's actual (paid) white-label branding for their clients.
  const effectiveLogo = branding.isWhiteLabel ? branding.logoUrl : (coachLogoUrl ?? branding.logoUrl)
  const effectiveName = branding.isWhiteLabel ? branding.appName : (coachBrandName ?? branding.appName)
  const effectiveColour = branding.isWhiteLabel ? branding.brandColour : (coachBrandColour ?? branding.brandColour)

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
            <Image src={effectiveLogo} alt={effectiveName} width={36} height={36} className="h-9 w-9 object-cover rounded-full border border-gray-100 flex-shrink-0" />
            <span className="text-[15px] font-bold tracking-tight text-gray-900">{effectiveName}</span>
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
            backgroundColor: isCoach ? '#eff6ff' : tier === 'individual_elite' ? '#f3e8ff' : tier === 'individual_optimiser' || tier === 'coached' ? 'color-mix(in srgb, var(--nc-primary) 8%, transparent)' : '#f3f4f6',
            color: isCoach ? '#1d4ed8' : tier === 'individual_elite' ? '#7c3aed' : tier === 'individual_optimiser' || tier === 'coached' ? 'var(--nc-primary)' : '#6b7280',
            borderColor: isCoach ? '#bfdbfe' : tier === 'individual_elite' ? '#e9d5ff' : tier === 'individual_optimiser' || tier === 'coached' ? 'color-mix(in srgb, var(--nc-primary) 18%, transparent)' : '#e5e7eb',
          }}>
            {isCoach
              ? `Coach — ${tier === 'coach_business' ? 'Business' : tier === 'coach_pro' ? 'Pro' : 'Solo'}`
              : tier === 'individual_elite' ? 'Elite'
              : tier === 'individual_optimiser' ? 'Optimiser'
              : tier === 'coached' ? 'Coached'
              : 'Tracker — Free'}
          </a>
        </div>

        {/* Coach switch banner */}
        {isCoach && (
          <a
            href="/coach/dashboard"
            className="flex items-center justify-between gap-4 rounded-2xl px-5 py-4 transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--nc-primary)' }}
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
            style={{ backgroundColor: 'color-mix(in srgb, var(--nc-primary) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--nc-primary) 18%, transparent)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'color-mix(in srgb, var(--nc-primary) 15%, transparent)' }}>
                <svg className="w-5 h-5" style={{ color: 'var(--nc-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Your coach has sent you a form</p>
                <p className="text-xs text-gray-500 mt-0.5">Tap to fill it in.</p>
              </div>
            </div>
            <svg className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--nc-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

        {/* Anyone who hasn't set up their profile yet — not just individual
            clients. A coached client (incl. signup-link/gym members with no
            coach setting targets manually) can land here too if they bailed
            on /onboarding and haven't gone through their autoflow's own
            target calculator either. Gated on target_calories rather than
            just onboarding_completed so a 1:1 invited client who's simply
            waiting on their coach to set targets manually (onboarding_completed
            is set true immediately on invite acceptance for exactly that
            reason) never sees this. */}
        {!profile?.onboarding_completed && !profile?.target_calories && (
          <a
            href={setupProfileHref}
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

        {/* Weekly plan summary — current week macros + note from coach's plan builder */}
        {isCoached && <WeeklyPlanCard />}

        {/* Goals — set by coach */}
        {isCoached && <GoalsPanel />}
        {isCoached && hasHabits && (
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Daily Habits</p>
            <HabitsPanel />
          </section>
        )}
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
                <p className="text-xl font-bold text-teal-400">{profile.target_protein}g</p>
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
            <a href="/onboarding" className="flex-shrink-0 text-sm font-semibold px-4 py-2 rounded-xl text-gray-900 ml-4" style={{ backgroundColor: 'var(--nc-primary)' }}>
              Set targets →
            </a>
          </div>
        )}

        {/* Daily Serve Targets — same card as /cheat-sheet and the food log,
            shown whenever the coach has set them, independent of the
            calorie/macro targets toggle above. */}
        {serveTargets && (
          <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 space-y-2">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Daily Serve Targets</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: `${serveTargets.protein_serves}P`, color: 'bg-pink-50 text-pink-700' },
                { label: `${serveTargets.carb_serves}C`, color: 'bg-teal-50 text-teal-700' },
                { label: `${serveTargets.fat_serves}F`, color: 'bg-green-50 text-green-700' },
                { label: 'veg ∞', color: 'bg-emerald-50 text-emerald-700' },
              ].map((t) => (
                <span key={t.label} className={`text-base font-bold px-4 py-2 rounded-full ${t.color}`}>{t.label}</span>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Carbs includes fruit — a fruit serve is just 20g carbs, same as any other carb source.
            </p>
            <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2 leading-relaxed">
              Veg is flexible, not calorie-free — a typical day&apos;s veg (~150 kcal) is already factored into your Carbs number above. If you&apos;re eating a lot of veg, that&apos;s already covered — just don&apos;t also max out every carb serve on top of it, or you&apos;ll be eating more than your target.
            </p>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              These are a close estimate, not an exact prescription — real food always has a bit of crossover between categories, so what you actually log will land close to target but rarely exactly on it. That&apos;s by design, to keep tracking simple.
            </p>
            {serveTargets.notes && <p className="text-xs text-gray-500 border-t border-gray-50 pt-2">{serveTargets.notes}</p>}
            <a href="/cheat-sheet" className="block text-[11px] text-blue-500 hover:text-blue-600 underline pt-0.5">
              See your full Cheat Sheet →
            </a>
          </div>
        )}

        {/* Weight — log + chart */}
        <section id="tour-weight" className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
          <WeightLog initialHistory={initialWeightLogs.slice(0, 10)} />
          {canWeightChart
            ? <WeightChart initialLogs={initialWeightLogs} />
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


        {/* Log food — shortcut to the dedicated Log Food page (Food Log,
            Meal Builder, My Meals), which no longer live inline here.
            Keeps the tour-food-log anchor so the onboarding tour still
            highlights it. */}
        <div id="tour-food-log">
          <a
            href="/log-food"
            className="flex items-center gap-4 bg-white rounded-2xl border border-gray-200 px-5 py-4 hover:border-gray-300 transition-colors"
          >
            <span className="text-2xl flex-shrink-0">🍽️</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">Log food</p>
              {todayFoodTotals.calories > 0 ? (
                <p className="text-xs text-gray-400 mt-0.5">
                  {Math.round(todayFoodTotals.calories)} kcal logged today
                  {/* Macro breakdown (P/C/F) and the "of {target}" figure only
                      show when the coach has targets visible for this client —
                      otherwise this card stays at calories-only, since a P/C/F
                      readout reads like a target even though it's just what
                      was logged. */}
                  {(!isCoached || showDailyTargets) && (
                    <>
                      {profile?.target_calories ? ` of ${profile.target_calories}` : ''}
                      {' '}· P{Math.round(todayFoodTotals.protein)} C{Math.round(todayFoodTotals.carbs)} F{Math.round(todayFoodTotals.fat)}
                    </>
                  )}
                </p>
              ) : (
                <p className="text-xs text-gray-400 mt-0.5">Nothing logged yet today — search foods or scan a barcode</p>
              )}
            </div>
            <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>


        {/* Advanced Analytics — teaser for non-Elite */}
        {!canAdvancedAnalytics && (
          <div className="flex items-center gap-4 bg-teal-50 border border-teal-100 rounded-2xl px-5 py-4">
            <span className="text-2xl">📊</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-teal-900">Advanced Analytics</p>
              <p className="text-xs text-teal-600 mt-0.5">Spot trends across your nutrition, training, and recovery — all in one dashboard.</p>
            </div>
            <a href="/pricing" className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg text-teal-900 hover:opacity-90 transition-colors" style={{ backgroundColor: '#e9d5ff' }}>
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
