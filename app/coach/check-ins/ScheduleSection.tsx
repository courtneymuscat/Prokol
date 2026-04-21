'use client'

import { useState } from 'react'

type ScheduleClient = { clientId: string; name: string; label: string }
type DaySchedule = { dateStr: string; dayLabel: string; clients: ScheduleClient[] }

export default function ScheduleSection({
  days,
  noCheckInClients,
}: {
  days: DaySchedule[]
  noCheckInClients: { clientId: string; name: string }[]
}) {
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({})
  const [showNoCheckin, setShowNoCheckin] = useState(false)

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
                    <span className="text-sm font-medium text-gray-800">{c.name}</span>
                    <span className="text-xs text-gray-400">{c.label}</span>
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
                <span className="text-sm font-medium text-gray-800">{c.name}</span>
                <span className="text-xs text-gray-400">Assign a check-in →</span>
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
    </div>
  )
}
