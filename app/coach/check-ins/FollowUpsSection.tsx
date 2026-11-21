'use client'

import { useEffect, useState } from 'react'

type FollowUp = {
  id: string
  client_id: string
  client_name: string
  body: string
  created_at: string
  follow_up_date: string
  follow_up_done: boolean
  source_label: string | null
  source_url: string | null
}

function daysFromToday(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

function dueLabel(dateStr: string): { text: string; tone: 'overdue' | 'today' | 'soon' | 'later' } {
  const d = daysFromToday(dateStr)
  if (d < 0) return { text: `${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'} overdue`, tone: 'overdue' }
  if (d === 0) return { text: 'Due today', tone: 'today' }
  if (d === 1) return { text: 'Due tomorrow', tone: 'soon' }
  if (d <= 7) return { text: `Due in ${d} days`, tone: 'soon' }
  return { text: new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }), tone: 'later' }
}

const TONE: Record<string, string> = {
  overdue: 'bg-red-50 text-red-700 border-red-200',
  today: 'bg-amber-50 text-amber-800 border-amber-200',
  soon: 'bg-blue-50 text-blue-700 border-blue-200',
  later: 'bg-gray-50 text-gray-500 border-gray-200',
}

export default function FollowUpsSection() {
  const [items, setItems] = useState<FollowUp[] | null>(null)
  const [showLater, setShowLater] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/coach/follow-ups')
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .catch(() => setItems([]))
  }, [])

  async function markDone(id: string) {
    setBusy(id)
    const res = await fetch('/api/coach/follow-ups', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noteId: id, follow_up_done: true }),
    })
    setBusy(null)
    if (res.ok) setItems((prev) => (prev ?? []).filter((i) => i.id !== id))
  }

  async function snooze(id: string, weeks: number) {
    const d = new Date(); d.setDate(d.getDate() + weeks * 7)
    const next = d.toISOString().slice(0, 10)
    setBusy(id)
    const res = await fetch('/api/coach/follow-ups', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noteId: id, follow_up_date: next }),
    })
    setBusy(null)
    if (res.ok) {
      setItems((prev) =>
        (prev ?? []).map((i) => (i.id === id ? { ...i, follow_up_date: next } : i))
          .sort((a, b) => a.follow_up_date.localeCompare(b.follow_up_date)),
      )
    }
  }

  if (!items || items.length === 0) return null

  const due = items.filter((i) => daysFromToday(i.follow_up_date) <= 7)
  const later = items.filter((i) => daysFromToday(i.follow_up_date) > 7)
  const overdueCount = items.filter((i) => daysFromToday(i.follow_up_date) < 0).length
  const visible = showLater ? [...due, ...later] : due

  if (due.length === 0 && !showLater) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 px-5 py-3.5 flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          No follow-ups due — {later.length} scheduled for later.
        </p>
        <button onClick={() => setShowLater(true)} className="text-xs font-semibold text-gray-600 hover:text-gray-900 underline whitespace-nowrap">
          Show all
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-gray-900">Follow-ups</h2>
          {overdueCount > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
              {overdueCount} overdue
            </span>
          )}
        </div>
        {later.length > 0 && (
          <button onClick={() => setShowLater((v) => !v)} className="text-xs font-medium text-gray-500 hover:text-gray-800 whitespace-nowrap">
            {showLater ? 'Hide later' : `+${later.length} later`}
          </button>
        )}
      </div>

      <div className="divide-y divide-gray-100">
        {visible.map((item) => {
          const due = dueLabel(item.follow_up_date)
          return (
            <div key={item.id} className="px-5 py-3.5 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={`/coach/clients/${item.client_id}?tab=notes`}
                    className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                  >
                    {item.client_name}
                  </a>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${TONE[due.tone]}`}>
                    {due.text}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap break-words">{item.body}</p>
                {item.source_label && (
                  item.source_url ? (
                    <a href={item.source_url} className="inline-block text-[11px] text-gray-400 hover:text-gray-700 underline mt-1">
                      re: {item.source_label}
                    </a>
                  ) : (
                    <p className="text-[11px] text-gray-400 mt-1">re: {item.source_label}</p>
                  )
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => snooze(item.id, 2)}
                  disabled={busy === item.id}
                  className="text-[11px] font-medium text-gray-500 hover:text-gray-900 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-40"
                  title="Push out by 2 weeks"
                >
                  +2w
                </button>
                <button
                  onClick={() => markDone(item.id)}
                  disabled={busy === item.id}
                  className="text-[11px] font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-2.5 py-1 rounded-md transition-colors disabled:opacity-40"
                >
                  {busy === item.id ? '…' : 'Done'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
