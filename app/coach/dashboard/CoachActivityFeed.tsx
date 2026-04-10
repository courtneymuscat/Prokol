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

type Lapsed = { clientId: string; clientEmail: string }

const TYPE_ICON: Record<string, React.ReactNode> = {
  checkin: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  form_submission: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  workout: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  autoflow_response: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
}

const TYPE_COLOR: Record<string, string> = {
  checkin: 'bg-green-50 text-green-600',
  form_submission: 'bg-blue-50 text-blue-600',
  workout: 'bg-orange-50 text-orange-500',
  autoflow_response: 'bg-purple-50 text-purple-600',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

type RemindState = 'idle' | 'sending' | 'sent'

function RemindButton({ clientId }: { clientId: string }) {
  const [state, setState] = useState<RemindState>('idle')

  async function handleRemind(e: React.MouseEvent) {
    e.preventDefault()
    setState('sending')
    const res = await fetch(`/api/coach/remind/${clientId}`, { method: 'POST' })
    setState(res.ok ? 'sent' : 'idle')
  }

  if (state === 'sent') return <span className="text-xs text-green-600 font-medium">Sent!</span>

  return (
    <button
      onClick={handleRemind}
      disabled={state === 'sending'}
      className="text-xs font-semibold text-blue-600 hover:text-blue-800 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 flex-shrink-0"
    >
      {state === 'sending' ? 'Sending…' : 'Remind'}
    </button>
  )
}

export default function CoachActivityFeed() {
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [lapsed, setLapsed] = useState<Lapsed[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/coach/activity')
      .then((r) => r.json())
      .then((d) => { setActivity(d.activity ?? []); setLapsed(d.lapsed ?? []) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="h-24 flex items-center justify-center text-sm text-gray-400">Loading activity…</div>

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Activity feed */}
      <div className="lg:col-span-2 space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Recent activity</h2>
        {activity.length === 0 && (
          <div className="bg-white rounded-2xl border p-8 text-center text-sm text-gray-400">
            No activity in the last 7 days.
          </div>
        )}
        <div className="space-y-2">
          {activity.map((item) => (
            <a
              key={`${item.type}-${item.id}`}
              href={`/coach/clients/${item.clientId}`}
              className="flex items-start gap-3 bg-white rounded-xl border p-3.5 hover:bg-gray-50 transition-colors group"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${TYPE_COLOR[item.type]}`}>
                {TYPE_ICON[item.type]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">
                  <span className="font-medium">{item.clientEmail}</span>
                  {' '}{item.label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{timeAgo(item.timestamp)}</p>
              </div>
              {item.unread && (
                <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-semibold self-center flex-shrink-0">New</span>
              )}
            </a>
          ))}
        </div>
      </div>

      {/* Lapsed clients */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">No check-in (7d)</h2>
        {lapsed.length === 0 && (
          <div className="bg-white rounded-2xl border p-6 text-center text-sm text-gray-400">
            All clients active.
          </div>
        )}
        {lapsed.map((c) => (
          <div
            key={c.clientId}
            className="flex items-center gap-3 bg-white rounded-xl border p-3.5"
          >
            <a href={`/coach/clients/${c.clientId}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-amber-500">{c.clientEmail[0].toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{c.clientEmail}</p>
                <p className="text-xs text-amber-500">No check-in in 7+ days</p>
              </div>
            </a>
            <RemindButton clientId={c.clientId} />
          </div>
        ))}
      </div>
    </div>
  )
}
