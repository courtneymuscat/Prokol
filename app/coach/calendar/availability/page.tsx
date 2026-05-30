'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { browserTimezone } from '@/lib/booking-time'

type Block = { id: string; day_of_week: number; start_time: string; end_time: string; label: string | null }

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function AvailabilityPage() {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [loading, setLoading] = useState(true)
  const [coachTz, setCoachTz] = useState(browserTimezone())
  const [draft, setDraft] = useState({ day_of_week: 1, start_time: '09:00', end_time: '17:00', label: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/coach/booking-availability')
      .then((r) => r.json())
      .then((d) => setBlocks(d.blocks ?? []))
      .finally(() => setLoading(false))
    // Load coach's profile tz for display
    void (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('timezone').eq('id', user.id).single()
      if (data?.timezone) setCoachTz(data.timezone)
    })()
  }, [])

  async function add() {
    setError(null)
    setSaving(true)
    const res = await fetch('/api/coach/booking-availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data?.error ?? 'Failed to add'); return }
    setBlocks((prev) => [...prev, data.block].sort((a, b) =>
      a.day_of_week === b.day_of_week ? a.start_time.localeCompare(b.start_time) : a.day_of_week - b.day_of_week
    ))
    setDraft((d) => ({ ...d, label: '' }))
  }

  async function remove(id: string) {
    await fetch(`/api/coach/booking-availability/${id}`, { method: 'DELETE' })
    setBlocks((prev) => prev.filter((b) => b.id !== id))
  }

  const byDay: Record<number, Block[]> = {}
  for (let i = 0; i < 7; i++) byDay[i] = []
  for (const b of blocks) byDay[b.day_of_week].push(b)

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5">
      <div className="flex items-center gap-3">
        <a href="/coach/calendar" className="text-gray-400 hover:text-gray-700">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </a>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Weekly availability</h1>
          <p className="text-xs text-gray-400 mt-0.5">Block times you&apos;re open for bookings (shown in <span className="font-medium text-gray-600">{coachTz}</span>).</p>
        </div>
      </div>

      {/* Add block */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-900">Add a block</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Day</label>
            <select
              value={draft.day_of_week}
              onChange={(e) => setDraft((d) => ({ ...d, day_of_week: parseInt(e.target.value) }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">From</label>
            <input
              type="time"
              value={draft.start_time}
              onChange={(e) => setDraft((d) => ({ ...d, start_time: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">To</label>
            <input
              type="time"
              value={draft.end_time}
              onChange={(e) => setDraft((d) => ({ ...d, end_time: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Label <span className="font-normal normal-case text-gray-300">(optional)</span></label>
            <input
              type="text"
              value={draft.label}
              onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
              placeholder="Morning"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex justify-end">
          <button
            onClick={add}
            disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Adding…' : 'Add block'}
          </button>
        </div>
      </div>

      {/* Existing blocks */}
      {loading ? (
        <p className="text-sm text-gray-400 text-center py-12">Loading…</p>
      ) : (
        <div className="space-y-2">
          {DAYS.map((d, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 p-3 flex items-center gap-3">
              <div className="w-12 text-xs font-semibold uppercase tracking-wide text-gray-500">{d}</div>
              <div className="flex-1 flex flex-wrap gap-2">
                {byDay[i].length === 0 ? (
                  <span className="text-xs text-gray-300 italic">No availability</span>
                ) : (
                  byDay[i].map((b) => (
                    <div key={b.id} className="flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-700 rounded-xl px-3 py-1">
                      <span className="text-xs font-medium tabular-nums">{b.start_time.slice(0,5)}–{b.end_time.slice(0,5)}</span>
                      {b.label && <span className="text-[11px] text-blue-500">{b.label}</span>}
                      <button onClick={() => remove(b.id)} className="text-blue-400 hover:text-red-500" title="Remove">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
