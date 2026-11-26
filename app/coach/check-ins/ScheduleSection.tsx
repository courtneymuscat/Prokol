'use client'

import { useState } from 'react'
import ClientTagBadges from '../ClientTagBadges'

type ScheduleClient = { clientId: string; name: string; label: string; flowName: string | null }
type DaySchedule = { dateStr: string; dayLabel: string; clients: ScheduleClient[] }
type QuietClient = { clientId: string; name: string; lastCheckIn: string | null; hasSchedule: boolean }

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

// Each autoflow gets a stable colour derived from its name, so the same flow
// always reads the same across days without needing a colour stored per
// template. Hues are picked to stay distinguishable against the white rows.
const FLOW_COLORS = [
  'bg-blue-50 text-blue-700 border-blue-200',
  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'bg-purple-50 text-purple-700 border-purple-200',
  'bg-amber-50 text-amber-800 border-amber-200',
  'bg-pink-50 text-pink-700 border-pink-200',
  'bg-teal-50 text-teal-700 border-teal-200',
  'bg-indigo-50 text-indigo-700 border-indigo-200',
  'bg-rose-50 text-rose-700 border-rose-200',
]

function flowColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return FLOW_COLORS[Math.abs(hash) % FLOW_COLORS.length]
}

export default function ScheduleSection({
  days,
  noCheckInClients,
  quietClients = [],
}: {
  days: DaySchedule[]
  noCheckInClients: { clientId: string; name: string }[]
  quietClients?: QuietClient[]
}) {
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({})
  const [showNoCheckin, setShowNoCheckin] = useState(false)
  // Open by default — this is a follow-up list, so it's only useful if seen.
  const [showQuiet, setShowQuiet] = useState(true)

  function toggle(key: string) {
    setOpenDays((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Check-in schedule — next 7 days</p>

      {days.map((day) => {
        const isOpen = openDays[day.dateStr] ?? false
        return (
          <div key={day.dateStr} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => toggle(day.dateStr)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-900">{day.dayLabel}</span>
                {day.clients.length > 0 ? (
                  <span className="text-[11px] bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
                    {day.clients.length} client{day.clients.length !== 1 ? 's' : ''}
                  </span>
                ) : (
                  <span className="text-[11px] text-gray-300">No check-ins</span>
                )}
              </div>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isOpen && day.clients.length > 0 && (
              <div className="border-t border-gray-100 divide-y divide-gray-50">
                {day.clients.map((c) => (
                  <a
                    key={`${day.dateStr}-${c.clientId}`}
                    href={`/coach/clients/${c.clientId}?tab=checkins`}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-gray-800 truncate">{c.name}</span>
                      <ClientTagBadges clientId={c.clientId} />
                    </span>
                    <span className="flex items-center gap-2 flex-shrink-0">
                      {c.flowName && (
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${flowColor(c.flowName)}`}>
                          {c.flowName}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">{c.label}</span>
                    </span>
                  </a>
                ))}
              </div>
            )}

            {isOpen && day.clients.length === 0 && (
              <div className="border-t border-gray-100 px-4 py-3">
                <p className="text-sm text-gray-400">No check-ins scheduled for this day.</p>
              </div>
            )}
          </div>
        )
      })}

      {/* No check-in assigned section */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => setShowNoCheckin((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-900">No check-in in next 7 days</span>
            {noCheckInClients.length > 0 ? (
              <span className="text-[11px] bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
                {noCheckInClients.length} client{noCheckInClients.length !== 1 ? 's' : ''}
              </span>
            ) : (
              <span className="text-[11px] text-gray-300">All covered</span>
            )}
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${showNoCheckin ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showNoCheckin && noCheckInClients.length > 0 && (
          <div className="border-t border-gray-100 divide-y divide-gray-50">
            {noCheckInClients.map((c) => (
              <a
                key={c.clientId}
                href={`/coach/clients/${c.clientId}?tab=checkins`}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-gray-800 truncate">{c.name}</span>
                  <ClientTagBadges clientId={c.clientId} />
                </span>
                <span className="text-xs text-gray-400 flex-shrink-0">Assign a check-in →</span>
              </a>
            ))}
          </div>
        )}

        {showNoCheckin && noCheckInClients.length === 0 && (
          <div className="border-t border-gray-100 px-4 py-3">
            <p className="text-sm text-gray-400">All clients have a check-in in the next 7 days.</p>
          </div>
        )}
      </div>

      {/* Gone quiet — distinct from the list above. These clients may well
          have a check-in scheduled; they simply haven't submitted one. */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => setShowQuiet((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-800">No check-in in last 7 days</span>
            {quietClients.length > 0 ? (
              <span className="text-[11px] bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">
                {quietClients.length} to follow up
              </span>
            ) : (
              <span className="text-[11px] text-gray-300">All up to date</span>
            )}
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${showQuiet ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showQuiet && quietClients.length > 0 && (
          <div className="border-t border-gray-100 divide-y divide-gray-50">
            {quietClients.map((c) => {
              const days = c.lastCheckIn ? daysSince(c.lastCheckIn) : null
              return (
                <a
                  key={c.clientId}
                  href={`/coach/clients/${c.clientId}?tab=checkins`}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors gap-3"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-gray-800 truncate">{c.name}</span>
                    <ClientTagBadges clientId={c.clientId} />
                    {!c.hasSchedule && (
                      <span className="text-[10px] font-semibold px-1.5 py-0 rounded-full bg-gray-100 text-gray-500 flex-shrink-0 whitespace-nowrap">
                        no check-in set up
                      </span>
                    )}
                  </span>
                  <span className={`text-xs flex-shrink-0 ${days === null || days >= 21 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                    {days === null ? 'Never checked in' : `Last ${days} days ago`}
                  </span>
                </a>
              )
            })}
          </div>
        )}

        {showQuiet && quietClients.length === 0 && (
          <div className="border-t border-gray-100 px-4 py-3">
            <p className="text-sm text-gray-400">Everyone has checked in within the last 7 days.</p>
          </div>
        )}
      </div>
    </div>
  )
}
