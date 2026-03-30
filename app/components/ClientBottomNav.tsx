'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'

// ── Icons ──────────────────────────────────────────────────────────────────────

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-6 h-6 ${active ? 'text-blue-600' : 'text-gray-400'}`} fill={active ? 'currentColor' : 'none'} stroke={active ? 'none' : 'currentColor'} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}
function CycleIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-6 h-6 ${active ? 'text-blue-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" strokeWidth={active ? 2.25 : 1.75} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.25 : 1.75} d="M12 8v4l2.5 2.5" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.25 : 1.75} d="M8 3.5C9.2 2.9 10.6 2.5 12 2.5" />
    </svg>
  )
}
function WorkoutsIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-6 h-6 ${active ? 'text-blue-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.25 : 1.75} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4M4 12h16" />
    </svg>
  )
}
function MessagesIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-6 h-6 ${active ? 'text-blue-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.25 : 1.75} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}
function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-6 h-6 ${active ? 'text-blue-600' : 'text-gray-400'}`} fill={active ? 'currentColor' : 'none'} stroke={active ? 'none' : 'currentColor'} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}

// ── Tab builder ────────────────────────────────────────────────────────────────

type Tab = { href: string; label: string; icon: (active: boolean) => React.ReactNode }

function buildTabs(sex: string | null, tier: string | null): Tab[] {
  const isCoached = tier === 'coached'
  const isFemale = sex !== 'male'

  const home: Tab    = { href: '/dashboard', label: 'Home',     icon: (a) => <HomeIcon active={a} /> }
  const cycle: Tab   = { href: '/cycle',     label: 'Cycle',    icon: (a) => <CycleIcon active={a} /> }
  const workouts: Tab = { href: '/workouts', label: 'Workouts', icon: (a) => <WorkoutsIcon active={a} /> }
  const messages: Tab = { href: '/messages', label: 'Messages', icon: (a) => <MessagesIcon active={a} /> }
  const profile: Tab  = { href: '/settings', label: 'Profile',  icon: (a) => <ProfileIcon active={a} /> }

  if (isFemale && isCoached)  return [home, cycle, workouts, messages, profile]
  if (isFemale && !isCoached) return [home, cycle, workouts, profile]
  if (!isFemale && isCoached) return [home, workouts, messages, profile]
  return [home, workouts, profile]
}

// ── Pages where the nav should appear ─────────────────────────────────────────

const SHOW_ON = ['/dashboard', '/workouts', '/progress', '/cycle', '/messages', '/settings']

const HIDE_PREFIXES = ['/coach', '/onboarding', '/login', '/signup', '/forms', '/invite', '/pricing', '/checkout', '/subscribe']

// ── Component ─────────────────────────────────────────────────────────────────

export default function ClientBottomNav() {
  const path = usePathname()
  const [tabs, setTabs] = useState<Tab[] | null>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => setTabs(buildTabs(d.sex ?? null, d.subscription_tier ?? null)))
      .catch(() => setTabs(buildTabs(null, null)))
  }, [])

  // Hide on excluded paths
  if (HIDE_PREFIXES.some((p) => path.startsWith(p))) return null
  if (!SHOW_ON.some((p) => path === p || path.startsWith(p + '/'))) return null

  // Show placeholder bar while loading to prevent layout shift
  if (!tabs) {
    return (
      <div className="md:hidden" style={{ height: 'calc(64px + env(safe-area-inset-bottom, 0px))' }} />
    )
  }

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-stretch">
          {tabs.map((tab) => {
            const active = path === tab.href || (tab.href !== '/dashboard' && path.startsWith(tab.href + '/'))
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-w-0"
              >
                {tab.icon(active)}
                <span className={`text-[10px] font-semibold tracking-tight ${active ? 'text-blue-600' : 'text-gray-400'}`}>
                  {tab.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="md:hidden" style={{ height: 'calc(64px + env(safe-area-inset-bottom, 0px))' }} />
    </>
  )
}
