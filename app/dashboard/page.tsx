import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const user = session?.user
  if (!user) redirect('/login')

  // Check onboarding status
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', user.id)
    .single()
  if (profile && profile.onboarding_completed === false) redirect('/onboarding')

  // Check if client has submitted a check-in in the last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recentCheckIn } = await supabase
    .from('check_ins')
    .select('id')
    .eq('user_id', user.id)
    .gte('created_at', sevenDaysAgo)
    .limit(1)
    .maybeSingle()

  const showCheckInBanner = !recentCheckIn

  // Check if this user is currently coached
  let coachEmail: string | null = null
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white px-6 py-3.5 flex justify-between items-center border-b border-gray-100 sticky top-0 z-20">
        <span className="text-[15px] font-bold tracking-tight text-gray-900">NutriCoach</span>
        <div className="flex items-center gap-1">
          {[
            { href: '/workouts', label: 'Workouts' },
            { href: '/messages', label: 'Messages' },
            { href: '/coach/dashboard', label: 'Coach' },
            { href: '/pricing', label: 'Pricing' },
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
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Welcome back!</h2>
          <p className="text-gray-500 mt-1 text-sm">{user.email}</p>
        </div>

        {/* Coach banner */}
        {coachEmail && <CoachBanner coachEmail={coachEmail} />}

        {/* Check-in reminder banner */}
        {showCheckInBanner && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
            <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">Weekly check-in due</p>
              <p className="text-xs text-amber-700 mt-0.5">You haven't submitted your weekly check-in yet. Your coach is waiting on your update.</p>
            </div>
            <a
              href="#daily-checkin"
              className="flex-shrink-0 text-xs font-semibold bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors"
            >
              Check in now
            </a>
          </div>
        )}

        {/* Weight — log + chart side by side */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
          <WeightLog />
          <WeightChart />
        </section>

        {/* Daily Food Log */}
        <DailyLog />

        {/* Meal Builder + Saved Meals */}
        <section>
          <MealSection />
        </section>

        {/* Cycle Tracker */}
        <section>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cycle Tracker</h3>
          <CycleTracker />
          <CyclePhaseBar />
        </section>

        {/* Coach Forms */}
        <FormsSection />

        {/* Daily Check-In + Latest */}
        <div id="daily-checkin">
          <DailyCheckIn />
        </div>
      </main>
    </div>
  )
}
