import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/actions/auth'
import DeleteAccount from './DeleteAccount'
import TimezoneSelector from '@/app/components/TimezoneSelector'
import ProfileDetails from '@/app/components/ProfileDetails'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, email, subscription_tier, target_calories, target_protein, target_carbs, target_fat, tdee, goal, weight_kg')
    .eq('id', session.user.id)
    .single()

  const hasMacros = profile?.target_calories

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white px-6 py-3.5 flex justify-between items-center border-b border-gray-100 sticky top-0 z-20">
        <a href="/dashboard" className="text-[15px] font-bold tracking-tight text-gray-900">Prokol</a>
        <form action={logout}>
          <button type="submit" className="text-[13px] font-medium text-gray-500 hover:text-red-500 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
            Log out
          </button>
        </form>
      </nav>

      <main className="max-w-lg mx-auto p-6 space-y-6">
        <div>
          <a href="/dashboard" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-4">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to dashboard
          </a>
          <h1 className="text-2xl font-bold text-gray-900">Account settings</h1>
          <p className="text-sm text-gray-500 mt-1">{session.user.email}</p>
        </div>

        {/* Macro targets */}
        {hasMacros && (
          <div className="bg-white rounded-2xl border p-5 space-y-4">
            <p className="text-sm font-semibold text-gray-900">Your daily targets</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="rounded-xl bg-gray-50 py-3">
                <p className="text-lg font-bold text-gray-900">{profile.target_calories}</p>
                <p className="text-xs text-gray-400">kcal</p>
              </div>
              <div className="rounded-xl bg-purple-50 py-3">
                <p className="text-lg font-bold text-purple-400">{profile.target_protein}g</p>
                <p className="text-xs text-purple-400">protein</p>
              </div>
              <div className="rounded-xl bg-green-50 py-3">
                <p className="text-lg font-bold text-green-400">{profile.target_carbs}g</p>
                <p className="text-xs text-green-400">carbs</p>
              </div>
              <div className="rounded-xl bg-blue-50 py-3">
                <p className="text-lg font-bold text-blue-400">{profile.target_fat}g</p>
                <p className="text-xs text-blue-400">fat</p>
              </div>
            </div>
            {profile.tdee && profile.subscription_tier !== 'coached' && (
              <p className="text-xs text-gray-400">TDEE estimate: {profile.tdee} kcal/day</p>
            )}
            {profile.subscription_tier === 'coached' ? (
              <p className="text-xs text-gray-400 italic">Your targets are managed by your coach.</p>
            ) : (
              <a
                href="/onboarding"
                className="inline-block text-xs font-semibold px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:border-gray-400 transition-colors"
              >
                Recalculate targets
              </a>
            )}
          </div>
        )}

        {!hasMacros && (
          <div className="bg-white rounded-2xl border border-dashed p-5 text-center space-y-3">
            <p className="text-sm font-semibold text-gray-700">No targets set yet</p>
            {profile?.subscription_tier === 'coached' ? (
              <p className="text-xs text-gray-400">Your coach will set your nutrition targets for you.</p>
            ) : (
              <>
                <p className="text-xs text-gray-400">Complete onboarding to get personalised calorie and macro targets.</p>
                <a
                  href="/onboarding"
                  className="inline-block text-xs font-semibold px-4 py-2 rounded-xl text-gray-900"
                  style={{ backgroundColor: '#FFD885' }}
                >
                  Set my targets →
                </a>
              </>
            )}
          </div>
        )}

        {/* Resources — only for coached clients */}
        {profile?.subscription_tier === 'coached' && (
          <a
            href="/resources"
            className="bg-white rounded-2xl border p-5 flex items-center justify-between hover:bg-gray-50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">My Resources</p>
                <p className="text-xs text-gray-400 mt-0.5">Guides, videos and links from your coach.</p>
              </div>
            </div>
            <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        )}

        {/* Progress Photos */}
        <a
          href="/progress"
          className="bg-white rounded-2xl border p-5 flex items-center justify-between hover:bg-gray-50 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Progress Photos</p>
              <p className="text-xs text-gray-400 mt-0.5">Track your visual transformation over time.</p>
            </div>
          </div>
          <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>

        {/* Profile details */}
        <div className="bg-white rounded-2xl border p-5 space-y-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Profile details</p>
            <p className="text-xs text-gray-400 mt-0.5">Your name and contact info — visible to your coach.</p>
          </div>
          <ProfileDetails />
        </div>

        {/* Timezone */}
        <div className="bg-white rounded-2xl border p-5 space-y-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Timezone</p>
            <p className="text-xs text-gray-400 mt-0.5">Used to display your logs and check-ins in the correct local time.</p>
          </div>
          <TimezoneSelector apiUrl="/api/settings" />
        </div>

        {/* Danger zone */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Danger zone</p>
          <DeleteAccount />
        </div>
      </main>
    </div>
  )
}
