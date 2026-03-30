import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSubscription } from '@/lib/subscription'
import { FEATURES } from '@/lib/features'
import CycleTracker from '@/app/dashboard/CycleTracker'
import CyclePhaseBar from '@/app/dashboard/CyclePhaseBar'
import UpgradePrompt from '@/components/UpgradePrompt'

export const dynamic = 'force-dynamic'

export default async function CyclePage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('sex')
    .eq('id', session.user.id)
    .single()

  // Male users don't use cycle tracking
  if (profile?.sex === 'male') redirect('/dashboard')

  const sub = await getSubscription()
  const canCycleAdv = sub.canAccess(FEATURES.CYCLE_TRACKER)
  const canCycleIntelligence = sub.canAccess(FEATURES.CYCLE_INTELLIGENCE)

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-3.5 sticky top-0 z-20">
        <span className="text-[15px] font-bold tracking-tight text-gray-900">NutriCoach</span>
      </nav>

      <main className="max-w-lg mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cycle Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">Track your cycle and sync nutrition with your phases.</p>
        </div>

        <CycleTracker advancedAccess={canCycleAdv} />
        <CyclePhaseBar />

        {!canCycleIntelligence && (
          <div className="flex items-center gap-4 bg-purple-50 border border-purple-100 rounded-2xl px-5 py-4">
            <span className="text-2xl">🔮</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-purple-900">Cycle Intelligence</p>
              <p className="text-xs text-purple-600 mt-0.5">
                Predict your next period, ovulation &amp; phase windows — plus personalised insights based on your data.
              </p>
            </div>
            <a
              href="/pricing"
              className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg text-purple-900 hover:opacity-90 transition-colors"
              style={{ backgroundColor: '#e9d5ff' }}
            >
              Try Elite →
            </a>
          </div>
        )}
      </main>
    </div>
  )
}
