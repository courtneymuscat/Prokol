import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'

export default async function MorePage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const admin = createAdminClient()

  const [coachRelRes, planRes] = await Promise.all([
    supabase
      .from('coach_clients')
      .select('coach_id')
      .eq('client_id', session.user.id)
      .eq('status', 'active')
      .maybeSingle(),
    admin
      .from('client_plans')
      .select('is_visible_to_client')
      .eq('client_id', session.user.id)
      .eq('is_visible_to_client', true)
      .maybeSingle(),
  ])

  const isCoached = !!coachRelRes.data
  const hasVisiblePlan = !!planRes.data

  // Check if coached client has any resources
  let hasResources = false
  if (isCoached) {
    const { count } = await admin
      .from('client_resource_access')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', session.user.id)
    hasResources = (count ?? 0) > 0
  }

  type GridItem = {
    href: string
    label: string
    icon: React.ReactNode
    show: boolean
  }

  const items: GridItem[] = [
    {
      href: '/resources',
      label: 'Resources',
      show: isCoached && hasResources,
      icon: (
        <svg className="w-7 h-7 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      href: '/progress',
      label: 'Progress Photos',
      show: true,
      icon: (
        <svg className="w-7 h-7 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      href: '/more/weekly-changes',
      label: 'Weekly Changes',
      show: hasVisiblePlan,
      icon: (
        <svg className="w-7 h-7 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      href: '/cheat-sheet',
      label: 'Food Guide',
      show: isCoached,
      icon: (
        <svg className="w-7 h-7 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      href: '/settings',
      label: 'Settings',
      show: true,
      icon: (
        <svg className="w-7 h-7 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      href: '/dashboard',
      label: 'My Dashboard',
      show: true,
      icon: (
        <svg className="w-7 h-7 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      ),
    },
  ]

  const visibleItems = items.filter(i => i.show)

  return (
    <div className="min-h-screen bg-black/60 flex flex-col justify-end">
      {/* Tap above sheet to dismiss */}
      <Link href="/dashboard" className="flex-1 min-h-[100px]" aria-label="Close" />

      {/* Sheet */}
      <div className="bg-white rounded-t-[28px] shadow-2xl overflow-hidden">
        {/* Handle + header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <h2 className="text-lg font-bold text-gray-900">More</h2>
          <Link
            href="/dashboard"
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Link>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-3 border-t border-gray-100">
          {visibleItems.map((item, i) => {
            const isLastRow = i >= visibleItems.length - (visibleItems.length % 3 || 3)
            const isRightEdge = (i + 1) % 3 === 0
            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                className={[
                  'flex flex-col items-center justify-center gap-2 py-6 px-3 hover:bg-gray-50 active:bg-gray-100 transition-colors',
                  !isRightEdge ? 'border-r border-gray-100' : '',
                  !isLastRow ? 'border-b border-gray-100' : '',
                ].join(' ')}
              >
                {item.icon}
                <span className="text-xs font-medium text-gray-600 text-center leading-tight">{item.label}</span>
              </Link>
            )
          })}
          {/* Fill empty grid cells in last row */}
          {visibleItems.length % 3 !== 0 &&
            Array.from({ length: 3 - (visibleItems.length % 3) }).map((_, i) => (
              <div key={`empty-${i}`} className="border-t border-gray-100 bg-gray-50" />
            ))}
        </div>

        {/* Bottom safe area */}
        <div style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }} />
      </div>
    </div>
  )
}
