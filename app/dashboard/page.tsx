import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSubscription } from '@/lib/subscription'
import { FEATURES } from '@/lib/features'
import { logout } from '@/app/actions/auth'
import DailyLog from './DailyLog'
import DailyCheckIn from './DailyCheckIn'
import WeightLog from './WeightLog'
import WeightChart from './WeightChart'
import MealSection from './MealSection'
import CycleTracker from './CycleTracker'
import CyclePhaseBar from './CyclePhaseBar'
import FormsSection from './FormsSection'
import CoachBanner from './CoachBanner'
import ProgressPhotos from './ProgressPhotos'
import UpgradePrompt from '@/components/UpgradePrompt'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const user = session?.user
  if (!user) redirect('/login')

  // Check onboarding status + fetch targets
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed, goal, target_calories, target_protein, target_carbs, target_fat, tdee, sex')
    .eq('id', user.id)
    .single()
  if (profile && profile.onboarding_completed === false) redirect('/onboarding')

  // Subscription feature access
  const sub = await getSubscription()
  const canWeightChart      = sub.canAccess(FEATURES.WEIGHT_TRACKING)
  const canMealBuilder      = sub.canAccess(FEATURES.MEAL_BUILDER)
  const canFullCheckin      = sub.canAccess(FEATURES.DAILY_CHECKIN)
  const canCycleAdv         = sub.canAccess(FEATURES.CYCLE_TRACKER)
  const canMealScanner      = sub.canAccess(FEATURES.MEAL_SCANNER)
  const canProgressPhotos   = sub.canAccess(FEATURES.PROGRESS_PHOTOS)
  const canProgressCompare  = sub.canAccess(FEATURES.PROGRESS_COMPARE)

  // Only show check-in banner for coached users (they have a coach waiting)
  const isCoached = sub.tier === 'coached'
  let showCheckInBanner = false
  let coachEmail: string | null = null

  if (isCoached) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: recentCheckIn } = await supabase
      .from('check_ins')
      .select('id')
      .eq('user_id', user.id)
      .gte('created_at', sevenDaysAgo)
      .limit(1)
      .maybeSingle()
    showCheckInBanner = !recentCheckIn

    const { data: coachRel } = await supabase
      .from('coach_clients')
      .select('coach_id')
      .eq('client_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (coachRel) {
      const { data: coachProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', coachRel.coach_id)
        .single()
      coachEmail = coachProfile?.email ?? null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white px-6 py-3.5 flex justify-between items-center border-b border-gray-100 sticky top-0 z-20">
        <span className="text-[15px] font-bold tracking-tight text-gray-900">NutriCoach</span>
        <div className="flex items-center gap-1">
          {[
            { href: '/workouts', label: 'Workouts' },
            ...(isCoached ? [
              { href: '/messages', label: 'Messages' },
              { href: '/coach/dashboard', label: 'Coach' },
            ] : []),
            { href: '/pricing', label: 'Upgrade' },
            { href: '/settings', label: 'Settings' },
          ].map(({ href, label }) => (
            <a key={href} href={href} className="text-[13px] font-medium text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
              {label}
            </a>
          ))}
          <span className="text-[13px] text-gray-400 px-2 hidden sm:block">{user.email}</span>
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
            <h2 className="text-2xl font-semibold text-gray-900">Welcome back!</h2>
            <p className="text-gray-500 mt-1 text-sm">{user.email}</p>
          </div>
          {/* Tier badge */}
          <a href="/pricing" className="text-xs font-semibold px-3 py-1.5 rounded-full border hover:opacity-80 transition-colors" style={{
            backgroundColor: sub.tier === 'tier_3' ? '#f3e8ff' : sub.tier === 'tier_2' || sub.tier === 'coached' ? '#FFF5D0' : '#f3f4f6',
            color: sub.tier === 'tier_3' ? '#7c3aed' : sub.tier === 'tier_2' || sub.tier === 'coached' ? '#B08000' : '#6b7280',
            borderColor: sub.tier === 'tier_3' ? '#e9d5ff' : sub.tier === 'tier_2' || sub.tier === 'coached' ? '#FFE9A8' : '#e5e7eb',
          }}>
            {sub.tier === 'tier_3' ? 'Elite' : sub.tier === 'tier_2' ? 'Optimiser' : sub.tier === 'coached' ? 'Coached' : 'Tracker — Free'}
          </a>
        </div>

        {/* Coach banner — only shown when actually coached */}
        {coachEmail && <CoachBanner coachEmail={coachEmail} />}

        {/* Daily targets card */}
        {profile?.target_calories ? (
          <div className="bg-white rounded-2xl border px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Daily targets</p>
              <a href="/onboarding" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Recalculate →</a>
            </div>
            <div className="grid grid-cols-4 gap-3 text-center">
              <div>
                <p className="text-xl font-bold text-gray-900">{profile.target_calories}</p>
                <p className="text-xs text-gray-400 mt-0.5">kcal</p>
              </div>
              <div>
                <p className="text-xl font-bold text-blue-600">{profile.target_protein}g</p>
                <p className="text-xs text-gray-400 mt-0.5">protein</p>
              </div>
              <div>
                <p className="text-xl font-bold text-amber-600">{profile.target_carbs}g</p>
                <p className="text-xs text-gray-400 mt-0.5">carbs</p>
              </div>
              <div>
                <p className="text-xl font-bold text-rose-600">{profile.target_fat}g</p>
                <p className="text-xs text-gray-400 mt-0.5">fat</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-dashed px-5 py-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-700">No targets set yet</p>
              <p className="text-xs text-gray-400 mt-0.5">Get personalised calorie & macro targets based on your activity.</p>
            </div>
            <a href="/onboarding" className="flex-shrink-0 text-sm font-semibold px-4 py-2 rounded-xl text-gray-900 ml-4" style={{ backgroundColor: '#FFD885' }}>
              Set targets →
            </a>
          </div>
        )}

        {/* Check-in reminder banner — only for coached users */}
        {showCheckInBanner && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
            <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">Weekly check-in due</p>
              <p className="text-xs text-amber-700 mt-0.5">You haven&apos;t submitted your weekly check-in yet. Your coach is waiting on your update.</p>
            </div>
            <a href="#daily-checkin" className="flex-shrink-0 text-xs font-semibold bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors">
              Check in now
            </a>
          </div>
        )}

        {/* Weight — log + chart */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
          <WeightLog />
          {canWeightChart
            ? <WeightChart />
            : <UpgradePrompt plan="Optimiser" feature="Weight trend chart" />
          }
        </section>

        {/* Daily Food Log */}
        <DailyLog canScanMeal={canMealScanner} />

        {/* Meal Builder + Saved Meals */}
        <section>
          {canMealBuilder
            ? <MealSection />
            : <UpgradePrompt plan="Optimiser" feature="Meal builder & saved meals" />
          }
        </section>

        {/* Cycle Tracker — hidden for male users */}
        {profile?.sex !== 'male' && (
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Cycle Tracker</h3>
            <CycleTracker advancedAccess={canCycleAdv} />
            <CyclePhaseBar />
          </section>
        )}

        {/* Progress Photos */}
        <section>
          {canProgressPhotos
            ? <ProgressPhotos canCompare={canProgressCompare} />
            : <UpgradePrompt plan="Optimiser" feature="Progress photos & comparison" />
          }
        </section>

        {/* Coach Forms */}
        <FormsSection />

        {/* Daily Check-In */}
        <div id="daily-checkin">
          <DailyCheckIn fullAccess={canFullCheckin} />
        </div>
      </main>
    </div>
  )
}
