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

function FlagBadge({ severity }: { severity: FlagSeverity | null }) {
  if (severity === 'urgent') return <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-600 text-white">Urgent</span>
  if (severity === 'lead') return <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">Lead</span>
  if (severity === 'normal') return <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Normal</span>
  return null
}

export default function CheckinsFeedList({ entries, profileMap }: { entries: Entry[]; profileMap: Record<string, ProfileInfo> }) {
  const [filter, setFilter] = useState<'all' | Source>('all')

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

      {filtered.length > 0 && <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Submitted check-ins</p>}
      <div className="space-y-3">
        {filtered.map((entry) => {
          if (entry.kind === 'autoflow') {
            const borderBySeverity: Record<string, string> = { urgent: 'border-l-4 border-l-red-500', normal: 'border-l-4 border-l-amber-400', lead: 'border-l-4 border-l-blue-400' }
            return (
              <a
                key={`af-${entry.id}`}
                href={`/coach/clients/${entry.client_id}?tab=checkins`}
                className={`flex items-center justify-between bg-white rounded-2xl border p-5 hover:bg-gray-50 transition-colors ${entry.flagSeverity ? borderBySeverity[entry.flagSeverity] : ''}`}
              >
                <div className="flex items-center gap-3">
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
                  {entry.reviewed ? (
                    <span className="text-xs bg-green-50 text-green-600 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Reviewed
                    </span>
                  ) : (
                    <span className="text-xs bg-amber-50 text-amber-500 font-semibold px-2 py-0.5 rounded-full">Pending review</span>
                  )}
                  <span className="text-xs text-gray-400">{fmtDate(entry.date)}</span>
                </div>
              </a>
            )
          }

          if (entry.kind === 'form') {
            return (
              <a
                key={`form-${entry.id}`}
                href={`/coach/clients/${entry.client_id}?tab=checkins`}
                className="flex items-center justify-between bg-white rounded-2xl border p-5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
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
                  {entry.reviewed ? (
                    <span className="text-xs bg-green-50 text-green-600 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Reviewed
                    </span>
                  ) : (
                    <span className="text-xs bg-amber-50 text-amber-500 font-semibold px-2 py-0.5 rounded-full">Pending review</span>
                  )}
                  <span className="text-xs text-gray-400">{fmtDate(entry.date)}</span>
                </div>
              </a>
            )
          }

          // kind === 'checkin'
          return (
            <a
              key={`ci-${entry.id}`}
              href={`/coach/clients/${entry.client_id}?tab=checkins`}
              className="block bg-white rounded-2xl border p-5 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-blue-600">{initials(entry.client_id)}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{displayName(entry.client_id)}</span>
                  <ClientTagBadges clientId={entry.client_id} />
                </div>
                <div className="flex items-center gap-3">
                  {entry.reviewed ? (
                    <span className="text-xs bg-green-50 text-green-600 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Reviewed
                    </span>
                  ) : (
                    <span className="text-xs bg-amber-50 text-amber-500 font-semibold px-2 py-0.5 rounded-full">Pending review</span>
                  )}
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
