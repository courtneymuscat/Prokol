'use client'

import { useState, useEffect, useCallback } from 'react'

type CellState = { default: boolean; override: boolean | null; effective: boolean }
type Matrix = Record<string, Record<string, CellState>>
type Group = { label: string; features: string[] }

const TIER_LABELS: Record<string, string> = {
  individual_free:         'Free',
  individual_optimiser:    'Optimiser',
  individual_elite:        'Elite',
  coached:                 'Coached',
  coach_pt_solo:           'Solo PT',
  coach_nutritionist_solo: 'Solo Nutr.',
  coach_pro:               'Pro',
  coach_business:          'Business',
  wl_starter:              'WL Web',
  wl_pro:                  'WL App',
}

const TIER_ORDER = Object.keys(TIER_LABELS)

const INDIVIDUAL_TIERS = new Set(['individual_free', 'individual_optimiser', 'individual_elite', 'coached'])

function featureLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function FeatureMatrixPage() {
  const [matrix, setMatrix] = useState<Matrix>({})
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null) // "feature|tier"
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/feature-matrix')
    if (res.ok) {
      const d = await res.json()
      setMatrix(d.matrix)
      setGroups(d.groups)
    } else {
      setError('Failed to load feature matrix')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function toggle(feature: string, tier: string, currentEffective: boolean) {
    const key = `${feature}|${tier}`
    setSaving(key)
    setError(null)
    const newEnabled = !currentEffective
    // Optimistic update
    setMatrix((prev) => ({
      ...prev,
      [feature]: {
        ...prev[feature],
        [tier]: {
          ...prev[feature][tier],
          effective: newEnabled,
          override: newEnabled === prev[feature][tier].default ? null : newEnabled,
        },
      },
    }))
    const res = await fetch('/api/admin/feature-matrix', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feature, tier, enabled: newEnabled }),
    })
    setSaving(null)
    if (!res.ok) {
      setError('Failed to save — change reverted')
      load() // Reload to revert
    } else {
      setToast(`${featureLabel(feature)} → ${TIER_LABELS[tier]}: ${newEnabled ? 'enabled' : 'disabled'}`)
      setTimeout(() => setToast(null), 2500)
    }
  }

  async function resetAll() {
    if (!confirm('Reset ALL overrides to defaults? This cannot be undone.')) return
    // Delete all overrides by setting each one back to default
    const promises: Promise<void>[] = []
    for (const feature of Object.keys(matrix)) {
      for (const tier of TIER_ORDER) {
        const cell = matrix[feature]?.[tier]
        if (cell?.override !== null) {
          promises.push(
            fetch('/api/admin/feature-matrix', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ feature, tier, enabled: cell.default }),
            }).then(() => undefined),
          )
        }
      }
    }
    await Promise.all(promises)
    load()
  }

  const hasAnyOverride = Object.values(matrix).some((row) =>
    Object.values(row).some((cell) => cell.override !== null),
  )

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-zinc-100">Feature Matrix</h1>
        <p className="text-zinc-400 text-sm">Loading…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Feature Matrix</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Toggle which features each tier has access to. Overridden cells are highlighted.
            Changes take effect within 5 minutes (cache TTL).
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> On (default)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-400 border-2 border-yellow-400 inline-block" /> On (override)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-zinc-700 inline-block" /> Off (default)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-red-900 border-2 border-yellow-400 inline-block" /> Off (override)
            </span>
          </div>
          {hasAnyOverride && (
            <button
              onClick={resetAll}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-600 text-zinc-400 hover:text-red-400 hover:border-red-600 transition-colors"
            >
              Reset all overrides
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-300 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-zinc-800 text-zinc-100 text-sm px-4 py-3 rounded-xl shadow-xl z-50 border border-zinc-700">
          {toast}
        </div>
      )}

      {/* Matrix table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-zinc-900 border-b border-zinc-800">
              <th className="sticky left-0 z-10 bg-zinc-900 text-left px-4 py-3 text-zinc-400 font-medium w-52 min-w-52">
                Feature
              </th>
              {/* Individual tier group header */}
              <th colSpan={4} className="px-2 py-2 text-center text-zinc-500 font-medium border-l border-zinc-800 border-r border-zinc-700">
                Individual
              </th>
              {/* Coach tier group header */}
              <th colSpan={6} className="px-2 py-2 text-center text-zinc-500 font-medium border-r border-zinc-800">
                Coach
              </th>
            </tr>
            <tr className="bg-zinc-900 border-b border-zinc-800">
              <th className="sticky left-0 z-10 bg-zinc-900 text-left px-4 py-2 text-zinc-500 text-xs font-normal" />
              {TIER_ORDER.map((tier, i) => (
                <th
                  key={tier}
                  className={`px-3 py-2 text-center text-zinc-300 font-semibold whitespace-nowrap
                    ${i === 0 ? 'border-l border-zinc-800' : ''}
                    ${i === 3 ? 'border-r border-zinc-700' : ''}
                    ${i === 9 ? 'border-r border-zinc-800' : ''}
                  `}
                >
                  {TIER_LABELS[tier]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <>
                <tr key={`group-${group.label}`} className="bg-zinc-900/60">
                  <td
                    colSpan={TIER_ORDER.length + 1}
                    className="px-4 py-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-widest border-t border-zinc-800"
                  >
                    {group.label}
                  </td>
                </tr>
                {group.features.map((feature) => {
                  const row = matrix[feature]
                  if (!row) return null
                  return (
                    <tr
                      key={feature}
                      className="border-t border-zinc-800/50 hover:bg-zinc-900/40 transition-colors"
                    >
                      <td className="sticky left-0 z-10 bg-zinc-950 px-4 py-2 text-zinc-300 font-mono text-xs whitespace-nowrap border-r border-zinc-800">
                        {feature}
                      </td>
                      {TIER_ORDER.map((tier, i) => {
                        const cell = row[tier]
                        if (!cell) return <td key={tier} className="px-3 py-2 text-center text-zinc-700">—</td>
                        const cellKey = `${feature}|${tier}`
                        const isSaving = saving === cellKey
                        const isOverridden = cell.override !== null
                        const isOn = cell.effective

                        let bgClass = ''
                        if (isOverridden && isOn) bgClass = 'bg-emerald-950 ring-1 ring-yellow-500/40'
                        else if (isOverridden && !isOn) bgClass = 'bg-red-950 ring-1 ring-yellow-500/40'
                        else if (isOn) bgClass = 'bg-zinc-900'
                        else bgClass = 'bg-zinc-950'

                        return (
                          <td
                            key={tier}
                            className={`px-3 py-2 text-center
                              ${i === 0 ? 'border-l border-zinc-800' : ''}
                              ${i === 3 ? 'border-r border-zinc-700' : ''}
                              ${i === 9 ? 'border-r border-zinc-800' : ''}
                            `}
                          >
                            <button
                              type="button"
                              onClick={() => toggle(feature, tier, cell.effective)}
                              disabled={isSaving}
                              title={`${isOverridden ? '⚡ Override: ' : ''}${isOn ? 'ON' : 'OFF'} — click to ${isOn ? 'disable' : 'enable'}`}
                              className={`w-7 h-5 rounded flex items-center justify-center mx-auto transition-all disabled:opacity-40 ${bgClass}`}
                            >
                              {isSaving ? (
                                <span className="text-zinc-500">…</span>
                              ) : isOn ? (
                                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg className="w-3.5 h-3.5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              )}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-600">
        Overrides (⚡) take precedence over hardcoded defaults. Toggling a cell back to its default value removes the override.
        Cache revalidates every 5 minutes — active sessions pick up changes on next page load.
      </p>
    </div>
  )
}
