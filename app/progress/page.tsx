import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSubscription } from '@/lib/subscription'
import { FEATURES } from '@/lib/features'
import { logout } from '@/app/actions/auth'
import ProgressPhotos from '@/app/dashboard/ProgressPhotos'
import UpgradePrompt from '@/components/UpgradePrompt'

export default async function ProgressPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) redirect('/login')

  const sub = await getSubscription()
  const canProgressPhotos = sub.canAccess(FEATURES.PROGRESS_PHOTOS)
  const canProgressCompare = sub.canAccess(FEATURES.PROGRESS_COMPARE)

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-3.5 flex justify-between items-center sticky top-0 z-20">
        <span className="text-[15px] font-bold tracking-tight text-gray-900">Prokol</span>
        <div className="flex items-center gap-1">
          <a href="/dashboard" className="text-[13px] font-medium text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">Dashboard</a>
          <a href="/workouts" className="text-[13px] font-medium text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">Workouts</a>
          <a href="/settings" className="text-[13px] font-medium text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">Settings</a>
          <form action={logout}>
            <button type="submit" className="text-[13px] font-medium text-gray-500 hover:text-red-500 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
              Log out
            </button>
          </form>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Progress Photos</h1>
        {canProgressPhotos
          ? <ProgressPhotos canCompare={canProgressCompare} />
          : <UpgradePrompt plan="Optimiser" feature="Progress photos & comparison" />
        }
      </main>
    </div>
  )
}
