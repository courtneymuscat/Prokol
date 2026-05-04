'use client'

import { useState } from 'react'
import { lazy, Suspense } from 'react'
import BillingSection from '@/app/components/BillingSection'
import ProfileDetails from '@/app/components/ProfileDetails'
import TimezoneSelector from '@/app/components/TimezoneSelector'
import DeleteAccount from '@/app/settings/DeleteAccount'

const ClientWeeklyChanges = lazy(() => import('./ClientWeeklyChanges'))

type Resource = {
  id: string
  title: string
  type: string
  url: string | null
  description: string | null
  folder_name: string | null
  folder_colour: string | null
}

type Props = {
  isCoached: boolean
  hasVisiblePlan: boolean
  hasResources: boolean
  resources: Resource[]
  profile: {
    first_name: string | null
    email: string | null
    subscription_tier: string | null
    target_calories: number | null
    target_protein: number | null
    target_carbs: number | null
    target_fat: number | null
    tdee: number | null
    goal: string | null
  } | null
}

type TabId = 'resources' | 'progress' | 'settings' | 'weekly'

const RESOURCE_TYPE_ICONS: Record<string, string> = {
  link: '🔗', video: '🎬', pdf: '📄', document: '📝', image: '🖼️',
}

function ResourceTypeIcon({ type }: { type: string }) {
  return <span className="text-base">{RESOURCE_TYPE_ICONS[type] ?? '📎'}</span>
}

export default function MoreTabs({ isCoached, hasVisiblePlan, hasResources, resources, profile }: Props) {
  const tabs: { id: TabId; label: string }[] = [
    ...(isCoached && hasResources ? [{ id: 'resources' as TabId, label: 'Resources' }] : []),
    { id: 'progress', label: 'Progress' },
    { id: 'settings', label: 'Settings' },
    ...(hasVisiblePlan ? [{ id: 'weekly' as TabId, label: 'Weekly Changes' }] : []),
  ]

  const [tab, setTab] = useState<TabId>(tabs[0]?.id ?? 'settings')

  const hasMacros = !!profile?.target_calories

  // Group resources by folder
  const folderMap = new Map<string, Resource[]>()
  for (const r of resources) {
    const key = r.folder_name ?? 'General'
    if (!folderMap.has(key)) folderMap.set(key, [])
    folderMap.get(key)!.push(r)
  }

  return (
    <div className="space-y-4">
      {/* Tab bar — equal-width grid so all tabs fit on screen without scrolling */}
      <div
        className="bg-gray-100 rounded-2xl p-1 grid gap-1"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}
      >
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`py-2 px-1 rounded-xl text-[11px] font-semibold text-center leading-tight transition-colors ${tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Resources */}
      {tab === 'resources' && (
        <div className="space-y-3">
          {resources.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-400">No resources shared yet.</div>
          )}
          {Array.from(folderMap.entries()).map(([folder, items]) => (
            <div key={folder} className="bg-white rounded-2xl border overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{folder}</p>
              </div>
              <div className="divide-y divide-gray-50">
                {items.map(r => (
                  <a
                    key={r.id}
                    href={r.url ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <ResourceTypeIcon type={r.type} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{r.title}</p>
                      {r.description && (
                        <p className="text-xs text-gray-400 truncate">{r.description}</p>
                      )}
                    </div>
                    <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Progress photos */}
      {tab === 'progress' && (
        <a
          href="/progress"
          className="bg-white rounded-2xl border p-5 flex items-center justify-between hover:bg-gray-50 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
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
      )}

      {/* Settings */}
      {tab === 'settings' && (
        <div className="space-y-4">
          {/* Macro targets */}
          {hasMacros && (
            <div className="bg-white rounded-2xl border p-5 space-y-4">
              <p className="text-sm font-semibold text-gray-900">Your daily targets</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded-xl bg-gray-50 py-3">
                  <p className="text-lg font-bold text-gray-900">{profile?.target_calories}</p>
                  <p className="text-xs text-gray-400">kcal</p>
                </div>
                <div className="rounded-xl bg-purple-50 py-3">
                  <p className="text-lg font-bold text-purple-400">{profile?.target_protein}g</p>
                  <p className="text-xs text-purple-400">protein</p>
                </div>
                <div className="rounded-xl bg-green-50 py-3">
                  <p className="text-lg font-bold text-green-400">{profile?.target_carbs}g</p>
                  <p className="text-xs text-green-400">carbs</p>
                </div>
                <div className="rounded-xl bg-blue-50 py-3">
                  <p className="text-lg font-bold text-blue-400">{profile?.target_fat}g</p>
                  <p className="text-xs text-blue-400">fat</p>
                </div>
              </div>
              {profile?.subscription_tier === 'coached' ? (
                <p className="text-xs text-gray-400 italic">Your targets are managed by your coach.</p>
              ) : (
                <a href="/onboarding" className="inline-block text-xs font-semibold px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:border-gray-400 transition-colors">
                  Recalculate targets
                </a>
              )}
            </div>
          )}

          {!hasMacros && (
            <div className="bg-white rounded-2xl border border-dashed p-5 text-center space-y-2">
              <p className="text-sm font-semibold text-gray-700">No targets set yet</p>
              {isCoached ? (
                <p className="text-xs text-gray-400">Your coach will set your nutrition targets for you.</p>
              ) : (
                <a href="/onboarding" className="inline-block text-xs font-semibold px-4 py-2 rounded-xl text-white" style={{ backgroundColor: '#1D9E75' }}>
                  Set my targets →
                </a>
              )}
            </div>
          )}

          {/* Billing */}
          {isCoached ? (
            <div className="bg-white rounded-2xl border p-5 space-y-2">
              <p className="text-sm font-semibold text-gray-900">Billing & subscription</p>
              <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-blue-700">Your subscription is managed by your coach.</p>
              </div>
            </div>
          ) : (
            <BillingSection />
          )}

          {/* Profile details */}
          <div className="bg-white rounded-2xl border p-5 space-y-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Profile details</p>
              <p className="text-xs text-gray-400 mt-0.5">Your name and contact info.</p>
            </div>
            <ProfileDetails />
          </div>

          {/* Timezone */}
          <div className="bg-white rounded-2xl border p-5 space-y-3">
            <p className="text-sm font-semibold text-gray-900">Timezone</p>
            <TimezoneSelector apiUrl="/api/settings" />
          </div>

          {/* Danger zone */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Danger zone</p>
            <DeleteAccount />
          </div>

          {/* Legal */}
          <div className="border-t border-gray-100 pt-4 flex flex-wrap gap-x-5 gap-y-1.5">
            <a href="/terms" target="_blank" className="text-xs text-gray-400 hover:text-gray-600">Terms of Service</a>
            <a href="/privacy" target="_blank" className="text-xs text-gray-400 hover:text-gray-600">Privacy Policy</a>
            <a href="/health-data" target="_blank" className="text-xs text-gray-400 hover:text-gray-600">Health Data</a>
            <a href="mailto:info@prokol.io" className="text-xs text-gray-400 hover:text-gray-600">info@prokol.io</a>
          </div>
        </div>
      )}

      {/* Weekly Changes */}
      {tab === 'weekly' && (
        <Suspense fallback={<div className="py-12 text-center text-sm text-gray-400">Loading…</div>}>
          <ClientWeeklyChanges />
        </Suspense>
      )}
    </div>
  )
}
