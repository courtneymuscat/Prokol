'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useBranding } from '@/app/components/BrandingProvider'

const NAV = [
  {
    href: '/coach/dashboard',
    label: 'Dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: '/coach/clients',
    label: 'Clients',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: '/coach/messages',
    label: 'Messages',
    messageBadge: true,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    href: '/coach/check-ins',
    label: 'Check-ins',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    href: '/coach/forms',
    label: 'Forms',
    badge: true,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    href: '/coach/autoflows',
    label: 'Autoflows',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    href: '/coach/resources',
    label: 'Resources',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    href: '/coach/exercises',
    label: 'Exercises',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4M4 12h16" />
      </svg>
    ),
  },
  {
    href: '/coach/programs',
    label: 'Programs',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    href: '/coach/meal-plans',
    label: 'Meal Plans',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    href: '/coach/note-templates',
    label: 'Note Templates',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
]

const ORG_NAV = [
  {
    href: '/coach/dashboard?tab=org',
    tab: 'org',
    label: 'Organisation',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    href: '/coach/dashboard?tab=org-templates',
    tab: 'org-templates',
    label: 'Org Templates',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
      </svg>
    ),
  },
  {
    href: '/org/white-label',
    tab: null,
    label: 'White-label',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
  },
]

export default function CoachSidebar({
  unreadCount,
  unreadMessages,
  isBusinessTier,
}: {
  unreadCount: number
  unreadMessages: number
  isBusinessTier: boolean
}) {
  const branding = useBranding()
  const path = usePathname()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab')

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-white shrink-0 min-h-screen sticky top-0 h-screen border-r border-gray-100">
        <div className="px-5 pt-6 pb-5">
          <a href="/dashboard" className="flex items-center gap-2">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.appName} className="h-6 object-contain" />
            ) : (
              <span className="text-[15px] font-bold tracking-tight text-gray-900">{branding.appName}</span>
            )}
            <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.5 rounded-md leading-none">Coach</span>
          </a>
        </div>

        <nav className="flex-1 px-3 pb-4 space-y-0.5 overflow-y-auto">
          {NAV.map((item) => {
            const active = path === item.href || (item.href !== '/coach/dashboard' && path.startsWith(item.href))
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-all ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                }`}
              >
                <span className={`flex-shrink-0 ${active ? 'text-blue-500' : 'text-gray-400'}`}>{item.icon}</span>
                <span>{item.label}</span>
                {item.badge && unreadCount > 0 && (
                  <span className="ml-auto text-[11px] bg-blue-500 text-white font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-tight">
                    {unreadCount}
                  </span>
                )}
                {item.messageBadge && unreadMessages > 0 && (
                  <span className="ml-auto text-[11px] bg-blue-500 text-white font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-tight">
                    {unreadMessages}
                  </span>
                )}
              </a>
            )
          })}

          {/* Business-only org items */}
          {isBusinessTier && (
            <>
              <div className="pt-3 pb-1 px-3">
                <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-wider">Business</p>
              </div>
              {ORG_NAV.map((item) => {
                const active = item.tab
                  ? path === '/coach/dashboard' && activeTab === item.tab
                  : path === item.href
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-all ${
                      active
                        ? 'bg-purple-50 text-purple-700'
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                    }`}
                  >
                    <span className={`flex-shrink-0 ${active ? 'text-purple-500' : 'text-gray-400'}`}>{item.icon}</span>
                    <span>{item.label}</span>
                    <span className="ml-auto text-[10px] bg-purple-100 text-purple-600 font-semibold px-1.5 py-0.5 rounded leading-none">
                      Biz
                    </span>
                  </a>
                )
              })}
            </>
          )}
        </nav>

        <div className="px-3 pt-3 pb-5 border-t border-gray-100 space-y-0.5">
          <a
            href="/coach/settings"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-all ${
              path === '/coach/settings'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
            }`}
          >
            <svg className={`w-4.5 h-4.5 flex-shrink-0 ${path === '/coach/settings' ? 'text-blue-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </a>
          <a
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-all"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            My dashboard
          </a>
        </div>
      </aside>

      {/* Mobile top bar (branding only) */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white px-4 border-b border-gray-100"
           style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-2 py-3">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.appName} className="h-6 object-contain" />
          ) : (
            <span className="text-[15px] font-bold tracking-tight text-gray-900">{branding.appName}</span>
          )}
          <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.5 rounded-md leading-none">Coach</span>
        </div>
      </div>

      {/* Mobile top spacer */}
      <div className="md:hidden h-14" />

      {/* Mobile bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-stretch">
          {[
            NAV[0], // Dashboard
            NAV[1], // Clients
            NAV[2], // Messages
            NAV[3], // Check-ins
          ].map((item) => {
            const active = path === item.href || (item.href !== '/coach/dashboard' && path.startsWith(item.href))
            const badgeCount = item.badge ? unreadCount : item.messageBadge ? unreadMessages : 0
            return (
              <a
                key={item.href}
                href={item.href}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 relative"
              >
                <span className={active ? 'text-blue-600' : 'text-gray-400'}>{item.icon}</span>
                <span className={`text-[10px] font-semibold tracking-tight ${active ? 'text-blue-600' : 'text-gray-400'}`}>
                  {item.label}
                </span>
                {badgeCount > 0 && (
                  <span className="absolute top-2 right-[calc(50%-14px)] w-2 h-2 bg-blue-500 rounded-full" />
                )}
              </a>
            )
          })}
          {/* Settings */}
          <a
            href="/coach/settings"
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5"
          >
            <svg className={`w-6 h-6 ${path === '/coach/settings' ? 'text-blue-600' : 'text-gray-400'}`} fill={path === '/coach/settings' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={path === '/coach/settings' ? 0 : 1.75} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className={`text-[10px] font-semibold tracking-tight ${path === '/coach/settings' ? 'text-blue-600' : 'text-gray-400'}`}>
              Profile
            </span>
          </a>
        </div>
      </nav>

      {/* Mobile bottom spacer */}
      <div className="md:hidden" style={{ height: 'calc(64px + env(safe-area-inset-bottom, 0px))' }} />
    </>
  )
}
