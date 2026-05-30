'use client'

import { useEffect, useState } from 'react'

type Service = {
  id: string
  name: string
  description: string | null
  duration_minutes: number
  billing_mode: 'subscription' | 'separate'
  payment_link: string | null
  quota_per_month: number | null
  color: string
  active: boolean
}

const SWATCHES = ['#1D9E75', '#3b82f6', '#a855f7', '#ec4899', '#ef4444', '#f97316', '#eab308', '#14b8a6']

function emptyDraft(): Partial<Service> {
  return {
    name: '',
    description: '',
    duration_minutes: 60,
    billing_mode: 'separate',
    payment_link: '',
    quota_per_month: null,
    color: SWATCHES[0],
    active: true,
  }
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<Partial<Service>>(emptyDraft())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/coach/booking-services')
      .then((r) => r.json())
      .then((d) => setServices(d.services ?? []))
      .finally(() => setLoading(false))
  }, [])

  function startNew() {
    setDraft(emptyDraft())
    setEditingId('new')
    setError(null)
  }

  function startEdit(s: Service) {
    setDraft({ ...s })
    setEditingId(s.id)
    setError(null)
  }

  async function save() {
    if (!draft.name?.trim()) {
      setError('Name is required')
      return
    }
    setSaving(true)
    const url = editingId === 'new' ? '/api/coach/booking-services' : `/api/coach/booking-services/${editingId}`
    const method = editingId === 'new' ? 'POST' : 'PATCH'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) {
      setError(data?.error ?? 'Failed to save')
      return
    }
    setEditingId(null)
    setDraft(emptyDraft())
    // refresh
    const refreshed = await fetch('/api/coach/booking-services').then((r) => r.json())
    setServices(refreshed.services ?? [])
  }

  async function toggleActive(s: Service) {
    await fetch(`/api/coach/booking-services/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !s.active }),
    })
    setServices((prev) => prev.map((x) => (x.id === s.id ? { ...x, active: !s.active } : x)))
  }

  async function remove(s: Service) {
    if (!confirm(`Delete "${s.name}"? Existing bookings keep the service name on the row but lose the link.`)) return
    await fetch(`/api/coach/booking-services/${s.id}`, { method: 'DELETE' })
    setServices((prev) => prev.filter((x) => x.id !== s.id))
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5">
      <div className="flex items-center gap-3">
        <a href="/coach/calendar" className="text-gray-400 hover:text-gray-700">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </a>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Booking services</h1>
          <p className="text-xs text-gray-400 mt-0.5">Session types you can book — PT, nutrition call, consults, etc.</p>
        </div>
        <button onClick={startNew} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700">
          + New service
        </button>
      </div>

      {editingId && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">{editingId === 'new' ? 'New service' : 'Edit service'}</p>
            <button onClick={() => { setEditingId(null); setError(null) }} className="text-xs text-gray-400 hover:text-gray-700">
              Cancel
            </button>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Name</label>
            <input
              type="text"
              value={draft.name ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="PT Session"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Description</label>
            <textarea
              rows={2}
              value={draft.description ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="What the client sees when this is booked…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Duration</label>
              <div className="relative">
                <input
                  type="number"
                  min={5} max={480}
                  value={draft.duration_minutes ?? 60}
                  onChange={(e) => setDraft((d) => ({ ...d, duration_minutes: parseInt(e.target.value) || 60 }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">min</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Colour</label>
              <div className="flex items-center gap-1.5">
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, color: c }))}
                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${draft.color === c ? 'border-gray-800' : 'border-white'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Billing</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDraft((d) => ({ ...d, billing_mode: 'subscription' }))}
                className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  draft.billing_mode === 'subscription' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Included in subscription
              </button>
              <button
                type="button"
                onClick={() => setDraft((d) => ({ ...d, billing_mode: 'separate' }))}
                className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  draft.billing_mode === 'separate' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Billed separately
              </button>
            </div>
          </div>

          {draft.billing_mode === 'subscription' && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                Monthly quota <span className="text-gray-300 font-normal normal-case ml-1">included before extra billing kicks in (blank = unlimited)</span>
              </label>
              <input
                type="number"
                min={0}
                value={draft.quota_per_month ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, quota_per_month: e.target.value === '' ? null : parseInt(e.target.value) }))}
                placeholder="e.g. 4 sessions/month"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {draft.billing_mode === 'separate' && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                Payment link <span className="text-gray-300 font-normal normal-case ml-1">Stripe / PayPal / etc — pasted into the client&apos;s booking confirmation</span>
              </label>
              <input
                type="url"
                value={draft.payment_link ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, payment_link: e.target.value }))}
                placeholder="https://buy.stripe.com/…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end">
            <button
              onClick={save}
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-12">Loading…</p>
      ) : services.length === 0 && !editingId ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-12 text-center">
          <p className="text-sm text-gray-500 mb-1">No services yet</p>
          <p className="text-xs text-gray-400 mb-4">Define the session types you book with clients.</p>
          <button onClick={startNew} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700">
            + New service
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {services.map((s) => (
            <div key={s.id} className={`bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3 ${s.active ? '' : 'opacity-60'}`}>
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                  <span className="text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    {s.duration_minutes} min
                  </span>
                  <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                    s.billing_mode === 'subscription' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {s.billing_mode === 'subscription'
                      ? s.quota_per_month != null ? `${s.quota_per_month}/mo` : 'Unlimited'
                      : 'Separate'}
                  </span>
                  {!s.active && <span className="text-[10px] uppercase text-gray-400">Archived</span>}
                </div>
                {s.description && <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>}
              </div>
              <button onClick={() => toggleActive(s)} className="text-xs text-gray-400 hover:text-gray-700">
                {s.active ? 'Archive' : 'Unarchive'}
              </button>
              <button onClick={() => startEdit(s)} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                Edit
              </button>
              <button onClick={() => remove(s)} className="text-xs text-red-400 hover:text-red-600">
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
