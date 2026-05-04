import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ClientWeeklyChanges from '../ClientWeeklyChanges'

export default async function WeeklyChangesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  // Check if any visible plan exists — fallback query if column missing
  let hasPlan = false
  const visibleRes = await admin
    .from('client_plans')
    .select('id')
    .eq('client_id', user.id)
    .eq('is_visible_to_client', true)
    .maybeSingle()
  if (!visibleRes.error) {
    hasPlan = !!visibleRes.data
  } else {
    // Column may not exist yet — check if any plan exists at all
    const anyRes = await admin
      .from('client_plans')
      .select('id')
      .eq('client_id', user.id)
      .maybeSingle()
    hasPlan = !!anyRes.data
  }

  if (!hasPlan) redirect('/more')

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white px-6 py-3.5 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-20">
        <a href="/more" className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </a>
        <h1 className="text-[15px] font-bold text-gray-900">Weekly Changes</h1>
      </nav>
      <main className="max-w-lg mx-auto p-4">
        <ClientWeeklyChanges />
      </main>
    </div>
  )
}
