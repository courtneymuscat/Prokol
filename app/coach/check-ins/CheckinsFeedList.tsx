'use client'

import { useState } from 'react'
import ClientTagBadges from '../ClientTagBadges'

type FlagSeverity = 'urgent' | 'lead' | 'normal'
type Source = 'checkin' | 'staged_flow'

type Entry =
  | { kind: 'checkin'; source: 'checkin'; id: string; client_id: string; date: string; reviewed: boolean; sleep_hours: number | null; sleep_quality: string | null; energy_level: string | null; rhr: number | null; hrv: number | null; notes: string | null }
  | { kind: 'autoflow'; source: Source; id: string; client_id: string; date: string; flow_name: string; step_number: number; reviewed: boolean; flagSeverity: FlagSeverity | null }
  | { kind: 'form'; source: 'checkin'; id: string; client_id: string; date: string; form_id: string; title: string; reviewed: boolean }

type ProfileInfo = { email: string; name: string | null }

const SLEEP_LABELS: Record<string, string> = {
  deep_restful: 'Deep & Restful', good: 'Good', okay: 'Okay', restless: 'Restless', poor: 'Poor',
}
const ENERGY_SHORT: Record<string, string> = {
  peaked: 'Peaked', high: 'High', moderate: 'Moderate', low: 'Low', sore: 'Sore', depleted: 'Depleted',
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function entryKey(e: Entry) {
  return `${e.kind}:${e.id}`
}

// Same PATCH contract CheckinFeedbackViaMessages/CheckInFeedback already
// use inside the client file (ClientTabs.tsx) — marking reviewed here
// writes to the exact same autoflow_responses / form_submissions /
// check_ins rows those components read from, so a client's file reflects
// a bulk review from this feed with no separate sync step needed.
async function markEntryReviewed(entry: Entry): Promise<boolean> {
  try {
    if (entry.kind === 'autoflow') {
      const res = await fetch(`/api/coach/clients/${entry.client_id}/autoflow-responses/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewed_by_coach: true }),
      })
      return res.ok
    }
    if (entry.kind === 'form') {
      const res = await fetch(`/api/coach/forms/${entry.form_id}/responses/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewed_by_coach: true }),
      })
      return res.ok
    }
    const res = await fetch(`/api/check-ins/${entry.id}/feedback`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewed: true }),
    })
    return res.ok
  } catch {
    return false
  }
}

function FlagBadge({ severity }: { severity: FlagSeverity | null }) {
  if (severity === 'urgent') return <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-600 text-white">Urgent</span>
  if (severity === 'lead') return <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">Lead</span>
  if (severity === 'normal') return <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Normal</span>
  return null
}

function ReviewedBadge({ reviewed }: { reviewed: boolean }) {
  return reviewed ? (
    <span className="text-xs bg-green-50 text-green-600 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
      Reviewed
    </span>
  ) : (
    <span className="text-xs bg-amber-50 text-amber-500 font-semibold px-2 py-0.5 rounded-full">Pending review</span>
  )
}

function SelectCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        e.preventDefault()
        onChange()
      }}
      className="w-4 h-4 rounded border-gray-300 flex-shrink-0 cursor-pointer"
    />
  )
}

export default function CheckinsFeedList({ entries: initialEntries, profileMap }: { entries: Entry[]; profileMap: Record<string, ProfileInfo> }) {
  const [entries, setEntries] = useState(initialEntries)
  const [filter, setFilter] = useState<'all' | Source>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkSaving, setBulkSaving] = useState(false)

  function initials(clientId: string) {
    const p = profileMap[clientId]
    const str = p?.name ?? p?.email ?? '?'
    return str[0].toUpperCase()
  }
  function displayName(clientId: string) {
    const p = profileMap[clientId]
    return p?.name ?? p?.email ?? 'Unknown'
  }

  const checkinCount = entries.filter((e) => e.source === 'checkin').length
  const stagedCount = entries.filter((e) => e.source === 'staged_flow').length
  const filtered = filter === 'all' ? entries : entries.filter((e) => e.source === filter)
  const allFilteredSelected = filtered.length > 0 && filtered.every((e) => selected.has(entryKey(e)))

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleSelectAllFiltered() {
    setSelected((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev)
        for (const e of filtered) next.delete(entryKey(e))
        return next
      }
      const next = new Set(prev)
      for (const e of filtered) next.add(entryKey(e))
      return next
    })
  }

  async function bulkMarkReviewed() {
    const targets = entries.filter((e) => selected.has(entryKey(e)) && !e.reviewed)
    if (targets.length === 0) {
      setSelected(new Set())
      return
    }
    setBulkSaving(true)
    const results = await Promise.all(targets.map((e) => markEntryReviewed(e)))
    const succeededKeys = new Set(targets.filter((_, i) => results[i]).map(entryKey))
    setEntries((prev) => prev.map((e) => succeededKeys.has(entryKey(e)) ? { ...e, reviewed: true } : e))
    setSelected(new Set())
    setBulkSaving(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {([
          ['all', `All (${entries.length})`],
          ['checkin', `Check-ins (${checkinCount})`],
          ['staged_flow', `Staged flow (${stagedCount})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              filter === key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {entries.length === 0 && (
        <div className="bg-white rounded-2xl border p-12 text-center">
          <p className="text-gray-500 font-medium">No check-ins yet</p>
          <p className="text-gray-400 text-sm mt-1">Check-ins from your clients will appear here.</p>
        </div>
      )}

      {entries.length > 0 && filtered.length === 0 && (
        <div className="bg-white rounded-2xl border p-8 text-center">
          <p className="text-gray-400 text-sm">Nothing in this filter right now.</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleSelectAllFiltered}
              className="w-4 h-4 rounded border-gray-300 cursor-pointer"
            />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Submitted check-ins</span>
          </label>
          {selected.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{selected.size} selected</span>
              <button
                onClick={() => setSelected(new Set())}
                className="text-xs font-medium text-gray-400 hover:text-gray-600 px-2 py-1"
              >
                Clear
              </button>
              <button
                onClick={bulkMarkReviewed}
                disabled={bulkSaving}
                className="text-xs font-semibold bg-green-600 text-white px-3 py-1.5 rounded-full hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {bulkSaving ? 'Marking…' : `Mark ${selected.size} as reviewed`}
              </button>
            </div>
          )}
        </div>
      )}
      <div className="space-y-3">
        {filtered.map((entry) => {
          const key = entryKey(entry)
          const isSelected = selected.has(key)

          if (entry.kind === 'autoflow') {
            const borderBySeverity: Record<string, string> = { urgent: 'border-l-4 border-l-red-500', normal: 'border-l-4 border-l-amber-400', lead: 'border-l-4 border-l-blue-400' }
            return (
              <a
                key={key}
                href={`/coach/clients/${entry.client_id}?tab=checkins&checkin=${entry.id}`}
                className={`flex items-center justify-between bg-white rounded-2xl border p-5 hover:bg-gray-50 transition-colors ${entry.flagSeverity ? borderBySeverity[entry.flagSeverity] : ''} ${isSelected ? 'ring-2 ring-gray-900' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <SelectCheckbox checked={isSelected} onChange={() => toggle(key)} />
                  <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-orange-600">{initials(entry.client_id)}</span>
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gray-900">{displayName(entry.client_id)}</span>
                    <ClientTagBadges clientId={entry.client_id} />
                    <p className="text-xs text-gray-400 mt-0.5">{entry.flow_name} — Step {entry.step_number}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <FlagBadge severity={entry.flagSeverity} />
                  <ReviewedBadge reviewed={entry.reviewed} />
                  <span className="text-xs text-gray-400">{fmtDate(entry.date)}</span>
                </div>
              </a>
            )
          }

          if (entry.kind === 'form') {
            return (
              <a
                key={key}
                href={`/coach/clients/${entry.client_id}?tab=checkins&checkin=${entry.id}`}
                className={`flex items-center justify-between bg-white rounded-2xl border p-5 hover:bg-gray-50 transition-colors ${isSelected ? 'ring-2 ring-gray-900' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <SelectCheckbox checked={isSelected} onChange={() => toggle(key)} />
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-blue-600">{initials(entry.client_id)}</span>
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gray-900">{displayName(entry.client_id)}</span>
                    <ClientTagBadges clientId={entry.client_id} />
                    <p className="text-xs text-gray-400 mt-0.5">{entry.title}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <ReviewedBadge reviewed={entry.reviewed} />
                  <span className="text-xs text-gray-400">{fmtDate(entry.date)}</span>
                </div>
              </a>
            )
          }

          // kind === 'checkin'
          return (
            <a
              key={key}
              href={`/coach/clients/${entry.client_id}?tab=checkins&checkin=${entry.id}`}
              className={`block bg-white rounded-2xl border p-5 hover:bg-gray-50 transition-colors ${isSelected ? 'ring-2 ring-gray-900' : ''}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <SelectCheckbox checked={isSelected} onChange={() => toggle(key)} />
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-blue-600">{initials(entry.client_id)}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{displayName(entry.client_id)}</span>
                  <ClientTagBadges clientId={entry.client_id} />
                </div>
                <div className="flex items-center gap-3">
                  <ReviewedBadge reviewed={entry.reviewed} />
                  <span className="text-xs text-gray-400">{fmtDate(entry.date)}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                <div>
                  <p className="text-xs text-gray-400">Sleep</p>
                  <p className="text-sm font-semibold text-gray-900">{entry.sleep_hours != null ? `${entry.sleep_hours}h` : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Quality</p>
                  <p className="text-sm font-semibold text-gray-900">{SLEEP_LABELS[entry.sleep_quality ?? ''] ?? entry.sleep_quality ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Energy</p>
                  <p className="text-sm font-semibold text-gray-900">{ENERGY_SHORT[entry.energy_level ?? ''] ?? entry.energy_level ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">RHR</p>
                  <p className="text-sm font-semibold text-gray-900">{entry.rhr != null ? `${entry.rhr}` : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">HRV</p>
                  <p className="text-sm font-semibold text-gray-900">{entry.hrv != null ? `${entry.hrv}` : '—'}</p>
                </div>
              </div>
              {entry.notes && (
                <p className="text-xs text-gray-500 italic mt-3 border-t border-gray-50 pt-3">&quot;{entry.notes}&quot;</p>
              )}
            </a>
          )
        })}
      </div>
    </div>
  )
}
