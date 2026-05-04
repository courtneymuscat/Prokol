'use client'

import { useState, useEffect } from 'react'

type ActivityItem = {
  type: 'checkin' | 'form_submission' | 'workout' | 'autoflow_response'
  clientId: string
  clientEmail: string
  timestamp: string
  label: string
  unread?: boolean
  id: string
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  checkin: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  form_submission: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  workout: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  autoflow_response: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
}

const TYPE_COLOR: Record<string, string> = {
  checkin:           'bg-green-50 text-green-500',
  form_submission:   'bg-blue-50 text-blue-500',
  workout:           'bg-orange-50 text-orange-500',
  autoflow_response: 'bg-purple-50 text-purple-500',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function CoachActivityFeed() {
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/coach/activity')
      .then((r) => r.json())
      .then((d) => setActivity(d.activity ?? []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="bg-white rounded-2xl border p-5">
      <p className="text-xs text-gray-400 animate-pulse">Loading activity…</p>
    </div>
  )

  return (
    <div className="bg-white rounded-2xl border p-5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Recent activity</p>

      {activity.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No activity in the last 7 days.</p>
      ) : (
        <div className="space-y-1">
          {activity.map((item) => (
            <a
              key={`${item.type}-${item.id}`}
              href={`/coach/clients/${item.clientId}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors group"
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${TYPE_COLOR[item.type]}`}>
                {TYPE_ICON[item.type]}
              </div>
              <p className="flex-1 text-sm text-gray-700 min-w-0 truncate">
                <span className="font-medium text-gray-900">{item.clientEmail.split('@')[0]}</span>
                {' '}{item.label}
              </p>
              <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(item.timestamp)}</span>
              {item.unread && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
