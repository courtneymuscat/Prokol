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
        <a href="/dashboard" className="text-[15px] font-bold tracking-tight text-gray-900">NutriCoach</a>
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
            {profile.tdee && (
              <p className="text-xs text-gray-400">TDEE estimate: {profile.tdee} kcal/day</p>
            )}
            <a
              href="/onboarding"
              className="inline-block text-xs font-semibold px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:border-gray-400 transition-colors"
            >
              Recalculate targets
            </a>
          </div>
        )}

        {!hasMacros && (
          <div className="bg-white rounded-2xl border border-dashed p-5 text-center space-y-3">
            <p className="text-sm font-semibold text-gray-700">No targets set yet</p>
            <p className="text-xs text-gray-400">Complete onboarding to get personalised calorie and macro targets.</p>
            <a
              href="/onboarding"
              className="inline-block text-xs font-semibold px-4 py-2 rounded-xl text-gray-900"
              style={{ backgroundColor: '#FFD885' }}
            >
              Set my targets →
            </a>
          </div>
        )}

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
