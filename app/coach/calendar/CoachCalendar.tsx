'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { browserTimezone, dateKeyInTz, formatInTz, localWallTimeToUtc } from '@/lib/booking-time'

type Service = {
  id: string
  name: string
  duration_minutes: number
  billing_mode: 'subscription' | 'separate'
  payment_link: string | null
  quota_total: number | null
  color: string
  active: boolean
}
type Client = { id: string; full_name: string | null; email: string; timezone: string | null }
type Booking = {
  id: string
  client_id: string
  service_id: string | null
  service_name: string
  service_color: string | null
  start_at: string
  duration_minutes: number
  coach_tz: string
  client_tz: string
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show'
  payment_status: 'pending' | 'paid' | 'included' | 'waived' | 'refunded'
  series_id: string | null
  recurrence_rule: string | null
  location: string | null
  meeting_url: string | null
  notes: string | null
  coach_notes: string | null
  payment_link: string | null
}

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_START = 6
const HOUR_END = 22
const HOUR_PX = 56

function startOfWeek(d: Date): Date {
  // Week starts Monday
  const out = new Date(d)
  const dow = out.getDay()
  const diff = (dow + 6) % 7
  out.setDate(out.getDate() - diff)
  out.setHours(0, 0, 0, 0)
  return out
}

// Minutes from midnight in a tz for a given UTC instant.
function minutesFromMidnight(d: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit',
  }).formatToParts(d)
  const h = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10)
  const m = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10)
  return (h === 24 ? 0 : h) * 60 + m
}

export default function CoachCalendar({ coachId, coachTz }: { coachId: string; coachTz: string }) {
  const [view, setView] = useState<'week' | 'month'>('week')
  const [weekAnchor, setWeekAnchor] = useState<Date>(() => startOfWeek(new Date()))
  // Month anchor = the 1st of the displayed month, midnight.
  const [monthAnchor, setMonthAnchor] = useState<Date>(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [bookings, setBookings] = useState<Booking[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ kind: 'new'; prefillDate?: string; prefillTime?: string } | { kind: 'view'; booking: Booking } | null>(null)

  const { fromIso, toIso } = useMemo(() => {
    if (view === 'week') {
      return {
        fromIso: new Date(weekAnchor.getTime() - DAY_MS).toISOString(),
        toIso:   new Date(weekAnchor.getTime() + 8 * DAY_MS).toISOString(),
      }
    }
    // Month view fetches the visible 6-week grid (extends into prev/next month)
    const gridStart = startOfWeek(monthAnchor)
    const gridEnd = new Date(gridStart.getTime() + 42 * DAY_MS)
    return { fromIso: gridStart.toISOString(), toIso: gridEnd.toISOString() }
  }, [view, weekAnchor, monthAnchor])

  const loadBookings = useCallback(async () => {
    const r = await fetch(`/api/coach/bookings?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`)
    const d = await r.json()
    setBookings(d.bookings ?? [])
  }, [fromIso, toIso])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/coach/booking-services').then((r) => r.json()),
      fetch('/api/coach/clients').then((r) => r.json()),
      loadBookings(),
    ]).then(([s, c]) => {
      setServices((s.services ?? []).filter((x: Service) => x.active))
      setClients(Array.isArray(c) ? c : [])
    }).finally(() => setLoading(false))
  }, [loadBookings])

  function shiftWeek(weeks: number) {
    setWeekAnchor((d) => new Date(d.getTime() + weeks * 7 * DAY_MS))
  }
  function shiftMonth(months: number) {
    setMonthAnchor((d) => new Date(d.getFullYear(), d.getMonth() + months, 1))
  }
  function jumpToday() {
    if (view === 'week') {
      setWeekAnchor(startOfWeek(new Date()))
    } else {
      const d = new Date()
      setMonthAnchor(new Date(d.getFullYear(), d.getMonth(), 1))
    }
  }

  // Bookings grouped by day-key in coach tz
  const bookingsByDay = useMemo(() => {
    const map: Record<string, Booking[]> = {}
    for (const b of bookings) {
      if (b.status === 'cancelled') continue
      const key = dateKeyInTz(new Date(b.start_at), coachTz)
      ;(map[key] ??= []).push(b)
    }
    return map
  }, [bookings, coachTz])

  const days = Array.from({ length: 7 }, (_, i) => new Date(weekAnchor.getTime() + i * DAY_MS))
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i)

  const weekLabel = `${formatInTz(days[0], coachTz, { month: 'short', day: 'numeric' })} – ${formatInTz(days[6], coachTz, { month: 'short', day: 'numeric', year: 'numeric' })}`
  const monthLabel = formatInTz(monthAnchor, coachTz, { month: 'long', year: 'numeric' })

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900">Calendar</h1>
          <p className="text-xs text-gray-400 mt-0.5">All times shown in <span className="font-medium text-gray-600">{coachTz}</span></p>
        </div>

        {/* Week / Month toggle */}
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          <button onClick={() => setView('week')} className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${view === 'week' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Week</button>
          <button onClick={() => setView('month')} className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${view === 'month' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Month</button>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => view === 'week' ? shiftWeek(-1) : shiftMonth(-1)} className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm hover:bg-gray-50">←</button>
          <button onClick={jumpToday} className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm hover:bg-gray-50">Today</button>
          <button onClick={() => view === 'week' ? shiftWeek(1) : shiftMonth(1)} className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm hover:bg-gray-50">→</button>
          <span className="text-sm font-semibold text-gray-700 ml-2 min-w-[180px] text-center">
            {view === 'week' ? weekLabel : monthLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <a href="/coach/calendar/services" className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">Services</a>
          <a href="/coach/calendar/availability" className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">Availability</a>
          <button
            onClick={() => setModal({ kind: 'new' })}
            className="bg-blue-600 text-white px-4 py-1.5 rounded-xl text-sm font-semibold hover:bg-blue-700"
          >
            + New booking
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-12">Loading…</p>
      ) : services.length === 0 ? (
        <div className="m-6 bg-white rounded-2xl border border-dashed border-gray-200 py-12 text-center">
          <p className="text-sm text-gray-500 mb-1">No services yet</p>
          <p className="text-xs text-gray-400 mb-4">Create a service (e.g. PT Session, Nutrition Call) before booking.</p>
          <a href="/coach/calendar/services" className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700">
            Set up services
          </a>
        </div>
      ) : view === 'week' ? (
        <div className="flex-1 overflow-auto">
          <div className="min-w-[800px] grid grid-cols-[60px_repeat(7,minmax(0,1fr))] border-b border-gray-200 bg-white sticky top-0 z-10">
            <div />
            {days.map((d, i) => {
              const isToday = dateKeyInTz(d, coachTz) === dateKeyInTz(new Date(), coachTz)
              return (
                <div key={i} className={`px-2 py-3 border-l border-gray-100 text-center ${isToday ? 'bg-blue-50' : ''}`}>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">
                    {formatInTz(d, coachTz, { weekday: 'short' })}
                  </p>
                  <p className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                    {formatInTz(d, coachTz, { day: 'numeric' })}
                  </p>
                </div>
              )
            })}
          </div>

          <div className="min-w-[800px] grid grid-cols-[60px_repeat(7,minmax(0,1fr))]">
            {/* Hour labels column */}
            <div className="border-r border-gray-100">
              {hours.map((h) => (
                <div key={h} style={{ height: HOUR_PX }} className="text-[10px] text-gray-400 text-right pr-2 pt-0.5">
                  {h}:00
                </div>
              ))}
            </div>

            {days.map((d, di) => {
              const key = dateKeyInTz(d, coachTz)
              const dayBookings = bookingsByDay[key] ?? []
              return (
                <div key={di} className="relative border-l border-gray-100" style={{ height: HOUR_PX * hours.length }}>
                  {hours.map((h, hi) => (
                    <button
                      key={h}
                      onClick={() => setModal({ kind: 'new', prefillDate: key, prefillTime: `${String(h).padStart(2, '0')}:00` })}
                      className="absolute left-0 right-0 hover:bg-blue-50/40 transition-colors"
                      style={{ top: hi * HOUR_PX, height: HOUR_PX, borderTop: '1px dashed #f3f4f6' }}
                      aria-label={`Add booking ${key} ${h}:00`}
                    />
                  ))}
                  {dayBookings.map((b) => {
                    const start = minutesFromMidnight(new Date(b.start_at), coachTz)
                    const top = ((start - HOUR_START * 60) / 60) * HOUR_PX
                    const height = Math.max(20, (b.duration_minutes / 60) * HOUR_PX)
                    const client = clients.find((c) => c.id === b.client_id)
                    return (
                      <button
                        key={b.id}
                        onClick={() => setModal({ kind: 'view', booking: b })}
                        className="absolute left-1 right-1 rounded-lg p-1.5 text-left text-white text-[11px] shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                        style={{ top, height, backgroundColor: b.service_color ?? '#1D9E75' }}
                      >
                        <div className="font-semibold truncate">
                          {formatInTz(new Date(b.start_at), coachTz, { hour: '2-digit', minute: '2-digit' })} {b.service_name}
                        </div>
                        <div className="opacity-80 truncate">
                          {client?.full_name || client?.email || '—'}
                        </div>
                        {b.payment_status === 'pending' && (
                          <div className="absolute top-0.5 right-1 text-[9px] font-bold bg-white/20 px-1 rounded">UNPAID</div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <MonthGrid
          monthAnchor={monthAnchor}
          coachTz={coachTz}
          bookingsByDay={bookingsByDay}
          clients={clients}
          onNew={(dateKey) => setModal({ kind: 'new', prefillDate: dateKey, prefillTime: '09:00' })}
          onView={(b) => setModal({ kind: 'view', booking: b })}
        />
      )}

      {modal?.kind === 'new' && (
        <NewBookingModal
          coachTz={coachTz}
          services={services}
          clients={clients}
          prefillDate={modal.prefillDate}
          prefillTime={modal.prefillTime}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); loadBookings() }}
        />
      )}
      {modal?.kind === 'view' && (
        <ViewBookingModal
          coachTz={coachTz}
          clients={clients}
          services={services}
          booking={modal.booking}
          onClose={() => setModal(null)}
          onChanged={() => { setModal(null); loadBookings() }}
        />
      )}
    </div>
  )
}

// ── Month grid ──────────────────────────────────────────────────────────────

function MonthGrid({
  monthAnchor, coachTz, bookingsByDay, clients, onNew, onView,
}: {
  monthAnchor: Date
  coachTz: string
  bookingsByDay: Record<string, Booking[]>
  clients: Client[]
  onNew: (dateKey: string) => void
  onView: (b: Booking) => void
}) {
  const gridStart = startOfWeek(monthAnchor)
  const cells = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getTime() + i * DAY_MS))
  const currentMonth = monthAnchor.getMonth()
  const todayKey = dateKeyInTz(new Date(), coachTz)
  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="grid grid-cols-7 border-l border-t border-gray-200 bg-white rounded-2xl overflow-hidden">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 text-center py-2 border-r border-b border-gray-200 bg-gray-50">
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          const key = dateKeyInTz(d, coachTz)
          const dayBookings = (bookingsByDay[key] ?? []).slice().sort((a, b) => a.start_at.localeCompare(b.start_at))
          const inMonth = d.getMonth() === currentMonth
          const isToday = key === todayKey
          return (
            <div
              key={i}
              onClick={() => onNew(key)}
              className={`min-h-[110px] border-r border-b border-gray-200 px-1.5 py-1 cursor-pointer hover:bg-blue-50/30 transition-colors ${inMonth ? 'bg-white' : 'bg-gray-50/60'}`}
            >
              <div className={`text-xs font-semibold mb-1 ${isToday ? 'text-white bg-blue-600 inline-block px-1.5 rounded-full' : inMonth ? 'text-gray-700' : 'text-gray-300'}`}>
                {formatInTz(d, coachTz, { day: 'numeric' })}
              </div>
              <div className="space-y-0.5">
                {dayBookings.slice(0, 3).map((b) => {
                  const client = clients.find((c) => c.id === b.client_id)
                  return (
                    <button
                      key={b.id}
                      onClick={(e) => { e.stopPropagation(); onView(b) }}
                      className="block w-full text-left rounded px-1 py-0.5 text-[10px] truncate text-white"
                      style={{ backgroundColor: b.service_color ?? '#1D9E75' }}
                    >
                      <span className="font-semibold">{formatInTz(new Date(b.start_at), coachTz, { hour: 'numeric', minute: '2-digit' })}</span>{' '}
                      {client?.full_name || client?.email || b.service_name}
                    </button>
                  )
                })}
                {dayBookings.length > 3 && (
                  <p className="text-[10px] text-gray-400 px-1">+ {dayBookings.length - 3} more</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Searchable client picker ────────────────────────────────────────────────

function ClientPicker({
  clients, value, onChange,
}: {
  clients: Client[]
  value: string
  onChange: (id: string) => void
}) {
  const selected = clients.find((c) => c.id === value)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return clients.slice(0, 50)
    return clients.filter((c) =>
      (c.full_name?.toLowerCase().includes(q) ?? false) || c.email.toLowerCase().includes(q)
    ).slice(0, 50)
  }, [clients, query])

  return (
    <div className="relative">
      <input
        type="text"
        value={open ? query : (selected?.full_name || selected?.email || '')}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => { setQuery(''); setOpen(true) }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder="Search clients…"
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-auto">
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onChange(c.id); setOpen(false); setQuery('') }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${c.id === value ? 'bg-blue-50/60' : ''}`}
            >
              <p className="font-medium text-gray-900">{c.full_name || c.email}</p>
              {c.full_name && <p className="text-[11px] text-gray-400">{c.email}</p>}
            </button>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-400">
          No matches
        </div>
      )}
    </div>
  )
}

// ── New booking modal ───────────────────────────────────────────────────────

function NewBookingModal({
  coachTz, services, clients, prefillDate, prefillTime, onClose, onSaved,
}: {
  coachTz: string
  services: Service[]
  clients: Client[]
  prefillDate?: string
  prefillTime?: string
  onClose: () => void
  onSaved: () => void
}) {
  const today = new Date()
  const todayKey = dateKeyInTz(today, coachTz)
  const [clientId, setClientId] = useState(clients[0]?.id ?? '')
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '')
  const [date, setDate] = useState(prefillDate ?? todayKey)
  const [time, setTime] = useState(prefillTime ?? '09:00')
  const service = services.find((s) => s.id === serviceId)
  const [durationMinutes, setDurationMinutes] = useState(service?.duration_minutes ?? 60)
  type Freq = 'none' | 'weekly' | 'biweekly' | 'monthly'
  const [recurrenceFreq, setRecurrenceFreq] = useState<Freq>('none')
  const [recurrenceCount, setRecurrenceCount] = useState(4)
  const [location, setLocation] = useState('')
  const [meetingUrl, setMeetingUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [coachNotes, setCoachNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Keep duration in sync with the selected service
  useEffect(() => {
    if (service) setDurationMinutes(service.duration_minutes)
  }, [service])

  const client = clients.find((c) => c.id === clientId)
  const clientTz = client?.timezone || coachTz
  const previewUtc = useMemo(() => {
    try { return localWallTimeToUtc(date, time, coachTz) } catch { return null }
  }, [date, time, coachTz])

  async function save() {
    setError(null)
    if (!clientId || !serviceId) { setError('Pick a client and service'); return }
    if (!previewUtc) { setError('Invalid date/time'); return }
    setSaving(true)
    const res = await fetch('/api/coach/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        service_id: serviceId,
        start_at: previewUtc.toISOString(),
        duration_minutes: durationMinutes,
        coach_tz: coachTz,
        client_tz: clientTz,
        location: location || undefined,
        meeting_url: meetingUrl || undefined,
        notes: notes || undefined,
        coach_notes: coachNotes || undefined,
        recurrence:
          recurrenceFreq === 'none' || recurrenceCount <= 1
            ? undefined
            : { freq: recurrenceFreq, count: recurrenceCount },
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data?.error ?? 'Failed to save'); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900">New booking</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Client</label>
            <ClientPicker clients={clients} value={clientId} onChange={setClientId} />
            {client && client.timezone && client.timezone !== coachTz && (
              <p className="text-[11px] text-amber-600 mt-1">
                Client is in <span className="font-semibold">{client.timezone}</span> — they&apos;ll see this booking at {previewUtc ? formatInTz(previewUtc, client.timezone, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}.
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Service</label>
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {services.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.duration_minutes}min</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Start time</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Duration</label>
              <div className="relative">
                <input type="number" min={5} max={480} value={durationMinutes} onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 60)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">min</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Repeat</label>
              <select
                value={recurrenceFreq}
                onChange={(e) => setRecurrenceFreq(e.target.value as Freq)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="none">Don&apos;t repeat</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Every 2 weeks</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
          {recurrenceFreq !== 'none' && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                Total sessions <span className="text-gray-300 font-normal normal-case ml-1">including this one</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={2}
                  max={52}
                  value={recurrenceCount}
                  onChange={(e) => setRecurrenceCount(Math.max(2, Math.min(52, parseInt(e.target.value) || 2)))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-20"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">bookings</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                {recurrenceFreq === 'weekly'   && `Same time every week for ${recurrenceCount} weeks.`}
                {recurrenceFreq === 'biweekly' && `Same time every 2 weeks for ${recurrenceCount * 2} weeks.`}
                {recurrenceFreq === 'monthly'  && `Same date each month for ${recurrenceCount} months.`}
              </p>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Location / meeting URL</label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="In person, Zoom, etc." className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2" />
            <input type="url" value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://zoom.us/…" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Notes for client</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Coach notes <span className="font-normal normal-case text-gray-300">private</span></label>
            <textarea rows={2} value={coachNotes} onChange={(e) => setCoachNotes(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {service && service.billing_mode === 'subscription' && service.quota_total != null && (
            <p className="text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
              This service includes {service.quota_total} total sessions. Bookings beyond that will be marked <span className="font-semibold text-amber-600">unpaid</span>. Cancelling a session frees the slot for the next pending booking.
            </p>
          )}
          {service && service.billing_mode === 'separate' && (
            <p className="text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
              This service is billed separately. Each booking starts <span className="font-semibold text-amber-600">unpaid</span> — toggle to paid when the client pays.
            </p>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-xl">Cancel</button>
            <button onClick={save} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : recurrenceFreq !== 'none' && recurrenceCount > 1 ? `Create ${recurrenceCount} bookings` : 'Create booking'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── View / edit booking modal ───────────────────────────────────────────────

function ViewBookingModal({
  coachTz, clients, services, booking, onClose, onChanged,
}: {
  coachTz: string
  clients: Client[]
  services: Service[]
  booking: Booking
  onClose: () => void
  onChanged: () => void
}) {
  const [working, setWorking] = useState(false)
  const client = clients.find((c) => c.id === booking.client_id)
  const clientTz = booking.client_tz
  const service = booking.service_id ? services.find((s) => s.id === booking.service_id) : undefined

  // Load all bookings for this client+service so we can show "session X of N"
  // and "Y remaining" against the service quota.
  const [quotaStats, setQuotaStats] = useState<{ index: number; usedCount: number } | null>(null)
  useEffect(() => {
    if (!booking.service_id) { setQuotaStats(null); return }
    let cancelled = false
    fetch(`/api/coach/bookings?client_id=${booking.client_id}&service_id=${booking.service_id}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        const rows: { id: string; start_at: string; status: string }[] = d.bookings ?? []
        const live = rows
          .filter((r) => r.status !== 'cancelled')
          .sort((a, b) => a.start_at.localeCompare(b.start_at))
        const idx = live.findIndex((r) => r.id === booking.id)
        setQuotaStats({ index: idx, usedCount: live.length })
      })
      .catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.id])

  async function patch(updates: Partial<Booking>) {
    setWorking(true)
    await fetch(`/api/coach/bookings/${booking.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    setWorking(false)
    onChanged()
  }

  async function cancel(scope: 'this' | 'future' | 'series') {
    if (!confirm(scope === 'this' ? 'Cancel this booking?' : scope === 'future' ? 'Cancel this and all future bookings in the series?' : 'Cancel the entire series?')) return
    setWorking(true)
    if (scope === 'this') {
      await patch({ status: 'cancelled' })
      return
    }
    await fetch(`/api/coach/bookings/${booking.id}?scope=${scope}`, { method: 'DELETE' })
    setWorking(false)
    onChanged()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: booking.service_color ?? '#1D9E75' }} />
              <h2 className="text-base font-bold text-gray-900">{booking.service_name}</h2>
            </div>
            <p className="text-sm text-gray-600">{client?.full_name || client?.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <div className="bg-gray-50 rounded-xl px-3 py-2 space-y-1">
            <p><span className="text-gray-400 text-xs">Coach time ({coachTz}):</span> <span className="font-medium">{formatInTz(booking.start_at, coachTz, { dateStyle: 'full', timeStyle: 'short' })}</span></p>
            {clientTz && clientTz !== coachTz && (
              <p><span className="text-gray-400 text-xs">Client time ({clientTz}):</span> <span className="font-medium">{formatInTz(booking.start_at, clientTz, { dateStyle: 'full', timeStyle: 'short' })}</span></p>
            )}
            <p className="text-xs text-gray-500"><span className="text-gray-400">Duration:</span> {booking.duration_minutes} min</p>
          </div>

          {/* Quota usage — visible whenever this booking is tied to a known service */}
          {service && quotaStats && quotaStats.index >= 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
              {service.billing_mode === 'subscription' && service.quota_total != null ? (
                <p className="text-xs text-blue-700">
                  <span className="font-semibold">Session {quotaStats.index + 1} of {service.quota_total}</span>
                  {' · '}
                  <span className={quotaStats.usedCount > service.quota_total ? 'text-amber-600 font-semibold' : ''}>
                    {Math.max(0, service.quota_total - quotaStats.usedCount)} remaining in this pack
                  </span>
                  {quotaStats.usedCount > service.quota_total && (
                    <span> · {quotaStats.usedCount - service.quota_total} over quota (billed separately)</span>
                  )}
                </p>
              ) : service.billing_mode === 'subscription' ? (
                <p className="text-xs text-blue-700">
                  <span className="font-semibold">Session {quotaStats.index + 1}</span> · unlimited under subscription
                </p>
              ) : (
                <p className="text-xs text-blue-700">
                  <span className="font-semibold">Session {quotaStats.index + 1}</span> · billed separately
                </p>
              )}
            </div>
          )}

          {(booking.location || booking.meeting_url) && (
            <div className="text-xs space-y-0.5">
              {booking.location && <p className="text-gray-700">📍 {booking.location}</p>}
              {booking.meeting_url && <p className="text-blue-600 break-all">🔗 <a href={booking.meeting_url} target="_blank" rel="noopener noreferrer" className="underline">{booking.meeting_url}</a></p>}
            </div>
          )}

          {booking.notes && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
              <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide mb-0.5">Visible to client</p>
              <p className="text-xs text-gray-700 whitespace-pre-wrap">{booking.notes}</p>
            </div>
          )}
          {booking.coach_notes && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-0.5">Coach notes</p>
              <p className="text-xs text-gray-700 whitespace-pre-wrap">{booking.coach_notes}</p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Status:</span>
            <select
              value={booking.status}
              onChange={(e) => patch({ status: e.target.value as Booking['status'] })}
              disabled={working}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
            >
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No-show</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Payment:</span>
            <select
              value={booking.payment_status}
              onChange={(e) => patch({ payment_status: e.target.value as Booking['payment_status'] })}
              disabled={working}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
            >
              <option value="pending">Unpaid</option>
              <option value="paid">Paid</option>
              <option value="included">Included in subscription</option>
              <option value="waived">Waived</option>
              <option value="refunded">Refunded</option>
            </select>
            {booking.payment_link && (
              <a href={booking.payment_link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline">payment link</a>
            )}
          </div>

          <div className="pt-3 border-t border-gray-100 flex flex-wrap gap-2">
            <button onClick={() => cancel('this')} disabled={working} className="text-xs text-red-500 hover:text-red-600 font-medium">
              Cancel this booking
            </button>
            {booking.series_id && (
              <>
                <button onClick={() => cancel('future')} disabled={working} className="text-xs text-red-500 hover:text-red-600 font-medium">
                  Cancel this + future
                </button>
                <button onClick={() => cancel('series')} disabled={working} className="text-xs text-red-500 hover:text-red-600 font-medium">
                  Cancel entire series
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
