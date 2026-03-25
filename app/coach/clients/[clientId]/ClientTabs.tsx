'use client'

import { useState, useEffect, lazy, Suspense } from 'react'
const CheckInFeedback = lazy(() => import('./CheckInFeedback'))

// ── Types ─────────────────────────────────────────────────────────────────────

type CheckIn = {
  id: string
  created_at: string
  sleep_hours: number | null
  sleep_quality: string | null
  energy_level: string | null
  rhr: number | null
  hrv: number | null
  notes: string | null
  coach_feedback: string | null
  reviewed_by_coach: boolean
}

type Workout = {
  id: string
  name: string
  started_at: string
  ended_at: string
}

type WeightLog = {
  logged_at: string
  weight_lbs: number
  weight_unit: string
}

type FoodLog = {
  id: string
  log_date: string
  meal_type: string
  food_name: string | null
  calories: number
  protein: number
  carbs: number
  fat: number
}

type Note = {
  id: string
  body: string
  created_at: string
}

type ClientData = {
  checkIns: CheckIn[]
  workouts: Workout[]
  weightLogs: WeightLog[]
  foodLogs: FoodLog[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ENERGY_LABELS: Record<string, string> = {
  peaked: 'Peaked – ready to PR',
  high: 'High – feeling strong',
  moderate: 'Moderate – normal day',
  low: 'Low – feeling fatigued',
  sore: 'Sore – DOMS',
  depleted: 'Depleted – rest day',
}
const SLEEP_LABELS: Record<string, string> = {
  deep_restful: 'Deep & Restful',
  good: 'Good',
  okay: 'Okay',
  restless: 'Restless',
  poor: 'Poor',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
function fmtFull(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function duration(s: string, e: string) {
  return `${Math.round((new Date(e).getTime() - new Date(s).getTime()) / 60000)} min`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{value}</p>
    </div>
  )
}
function Empty({ label }: { label: string }) {
  return <p className="text-sm text-gray-400 text-center py-10">{label}</p>
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: ClientData }) {
  const latest = data.checkIns[0] ?? null
  const latestWeight = data.weightLogs[0] ?? null
  const prevWeight = data.weightLogs[1] ?? null
  const todayFoods = data.foodLogs.filter((f) => f.log_date === data.foodLogs[0]?.log_date)
  const todayMacros = todayFoods.reduce((a, f) => ({
    cal: a.cal + f.calories, p: a.p + f.protein, c: a.c + f.carbs, f: a.f + f.fat,
  }), { cal: 0, p: 0, c: 0, f: 0 })

  return (
    <div className="space-y-4">
      {/* Latest check-in */}
      <div className="bg-white rounded-2xl border p-5">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Latest Check-In</h3>
        {!latest ? <p className="text-sm text-gray-400">No check-ins recorded.</p> : (
          <div className="space-y-3">
            <p className="text-xs text-gray-400">{fmt(latest.created_at)}</p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              <Stat label="Sleep" value={latest.sleep_hours != null ? `${latest.sleep_hours}h` : '—'} />
              <Stat label="Quality" value={SLEEP_LABELS[latest.sleep_quality ?? ''] ?? latest.sleep_quality ?? '—'} />
              <Stat label="Energy" value={latest.energy_level ? (ENERGY_LABELS[latest.energy_level]?.split('–')[0].trim() ?? latest.energy_level) : '—'} />
              <Stat label="RHR" value={latest.rhr != null ? `${latest.rhr} bpm` : '—'} />
              <Stat label="HRV" value={latest.hrv != null ? `${latest.hrv} ms` : '—'} />
            </div>
            {latest.notes && <p className="text-xs text-gray-500 italic border-t pt-2 mt-2">"{latest.notes}"</p>}
          </div>
        )}
      </div>

      {/* Weight snapshot */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border p-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Current Weight</h3>
          {!latestWeight ? <p className="text-sm text-gray-400">No data</p> : (
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {latestWeight.weight_unit === 'kg'
                  ? `${(latestWeight.weight_lbs / 2.20462).toFixed(1)} kg`
                  : `${latestWeight.weight_lbs.toFixed(1)} lbs`}
              </p>
              {prevWeight && (
                <p className={`text-xs mt-1 ${latestWeight.weight_lbs < prevWeight.weight_lbs ? 'text-green-500' : 'text-red-400'}`}>
                  {latestWeight.weight_lbs < prevWeight.weight_lbs ? '▼' : '▲'}
                  {' '}{Math.abs(latestWeight.weight_lbs - prevWeight.weight_lbs).toFixed(1)} lbs vs prev
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1">{fmt(latestWeight.logged_at)}</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border p-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Today's Nutrition</h3>
          {todayFoods.length === 0 ? <p className="text-sm text-gray-400">No logs today</p> : (
            <div>
              <p className="text-2xl font-bold text-gray-900">{Math.round(todayMacros.cal)} <span className="text-sm font-normal text-gray-500">kcal</span></p>
              <p className="text-xs text-gray-400 mt-1">
                {Math.round(todayMacros.p)}g P · {Math.round(todayMacros.c)}g C · {Math.round(todayMacros.f)}g F
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Recent workouts */}
      <div className="bg-white rounded-2xl border p-5">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Recent Workouts</h3>
        {data.workouts.length === 0 ? <p className="text-sm text-gray-400">No workouts recorded.</p> : (
          <div className="space-y-2">
            {data.workouts.slice(0, 3).map((w) => (
              <div key={w.id} className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-900">{w.name}</span>
                <span className="text-xs text-gray-400">{fmt(w.started_at)} · {duration(w.started_at, w.ended_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Notes tab ─────────────────────────────────────────────────────────────────

function NotesTab({ clientId }: { clientId: string }) {
  const [notes, setNotes] = useState<Note[]>([])
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/coach/notes/${clientId}`)
      .then((r) => r.json())
      .then((d) => setNotes(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [clientId])

  async function addNote() {
    if (!body.trim()) return
    setSaving(true)
    const res = await fetch(`/api/coach/notes/${clientId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    })
    if (res.ok) {
      const note = await res.json()
      setNotes((prev) => [note, ...prev])
      setBody('')
    }
    setSaving(false)
  }

  async function deleteNote(id: string) {
    await fetch(`/api/coach/notes/${clientId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noteId: id }),
    })
    setNotes((prev) => prev.filter((n) => n.id !== id))
  }

  if (loading) return <p className="text-sm text-gray-400 py-10 text-center">Loading notes…</p>

  return (
    <div className="space-y-4">
      {/* Add note */}
      <div className="bg-white rounded-2xl border p-5 space-y-3">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Add note</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Write a note about this client…"
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <button
          onClick={addNote}
          disabled={saving || !body.trim()}
          className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save note'}
        </button>
      </div>

      {/* Notes history */}
      {notes.length === 0 && <Empty label="No notes yet." />}
      {notes.map((note) => (
        <div key={note.id} className="bg-white rounded-2xl border p-5 group relative">
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.body}</p>
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-gray-400">{fmtFull(note.created_at)}</p>
            <button
              onClick={() => deleteNote(note.id)}
              className="text-xs text-gray-300 hover:text-red-400 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Files tab ─────────────────────────────────────────────────────────────────

type ClientFile = { url: string; label: string; formTitle: string; submittedAt: string }

function FilesTab({ clientId }: { clientId: string }) {
  const [files, setFiles] = useState<ClientFile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/coach/clients/${clientId}/files`)
      .then((r) => r.json())
      .then((d) => setFiles(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [clientId])

  if (loading) return <p className="text-sm text-gray-400 py-10 text-center">Loading files…</p>
  if (files.length === 0) return <Empty label="No files uploaded yet." />

  return (
    <div className="space-y-3">
      {files.map((f, i) => {
        const filename = decodeURIComponent(f.url.split('/').pop()?.split('?')[0] ?? 'file')
        const ext = filename.split('.').pop()?.toLowerCase() ?? ''
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)
        return (
          <div key={i} className="bg-white rounded-2xl border p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              {isImage ? (
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{f.label}</p>
              <p className="text-xs text-gray-400">{f.formTitle} · {fmtFull(f.submittedAt)}</p>
            </div>
            <a
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex-shrink-0"
            >
              View
            </a>
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type TabId = 'overview' | 'checkins' | 'nutrition' | 'training' | 'notes' | 'files'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'checkins', label: 'Check-ins' },
  { id: 'nutrition', label: 'Nutrition' },
  { id: 'training', label: 'Training' },
  { id: 'notes', label: 'Notes' },
  { id: 'files', label: 'Files' },
]

export default function ClientTabs({ clientId }: { clientId: string }) {
  const [tab, setTab] = useState<TabId>('overview')
  const [data, setData] = useState<ClientData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/coach/clients/${clientId}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setData(d) })
      .finally(() => setLoading(false))
  }, [clientId])

  if (loading) return <p className="text-sm text-gray-400 py-10 text-center">Loading…</p>
  if (error) return <p className="text-sm text-red-500 py-10 text-center">{error}</p>

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && data && <OverviewTab data={data} />}

      {/* Notes — always loaded on demand */}
      {tab === 'notes' && <NotesTab clientId={clientId} />}

      {/* Files */}
      {tab === 'files' && <FilesTab clientId={clientId} />}

      {/* Check-ins */}
      {tab === 'checkins' && data && (
        <div className="space-y-3">
          {data.checkIns.length === 0 && <Empty label="No check-ins recorded." />}
          {data.checkIns.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl border p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-400">{fmt(c.created_at)}</p>
                {c.reviewed_by_coach ? (
                  <span className="text-xs bg-green-50 text-green-600 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Reviewed
                  </span>
                ) : (
                  <span className="text-xs bg-amber-50 text-amber-500 font-semibold px-2 py-0.5 rounded-full">Pending review</span>
                )}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                <Stat label="Sleep" value={c.sleep_hours != null ? `${c.sleep_hours}h` : '—'} />
                <Stat label="Quality" value={SLEEP_LABELS[c.sleep_quality ?? ''] ?? c.sleep_quality ?? '—'} />
                <Stat label="Energy" value={ENERGY_LABELS[c.energy_level ?? ''] ?? c.energy_level ?? '—'} />
                <Stat label="RHR" value={c.rhr != null ? `${c.rhr} bpm` : '—'} />
                <Stat label="HRV" value={c.hrv != null ? `${c.hrv} ms` : '—'} />
              </div>
              {c.notes && <p className="text-xs text-gray-500 italic border-t border-gray-50 pt-2">"{c.notes}"</p>}
              <Suspense fallback={null}>
                <CheckInFeedback
                  checkInId={c.id}
                  initialFeedback={c.coach_feedback}
                  initialReviewed={c.reviewed_by_coach}
                />
              </Suspense>
            </div>
          ))}
        </div>
      )}

      {/* Nutrition */}
      {tab === 'nutrition' && data && (
        <div className="space-y-3">
          {data.foodLogs.length === 0 && <Empty label="No food logs recorded." />}
          {Object.entries(
            data.foodLogs.reduce<Record<string, typeof data.foodLogs>>((acc, f) => {
              acc[f.log_date] = acc[f.log_date] ?? []
              acc[f.log_date].push(f)
              return acc
            }, {})
          ).map(([date, logs]) => {
            const totals = logs.reduce((a, l) => ({
              cal: a.cal + l.calories, p: a.p + l.protein, c: a.c + l.carbs, f: a.f + l.fat,
            }), { cal: 0, p: 0, c: 0, f: 0 })
            return (
              <div key={date} className="bg-white rounded-2xl border overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-700">{fmt(date)}</p>
                  <p className="text-xs text-gray-500">
                    {Math.round(totals.cal)} kcal · {Math.round(totals.p)}g P · {Math.round(totals.c)}g C · {Math.round(totals.f)}g F
                  </p>
                </div>
                {logs.map((l) => (
                  <div key={l.id} className="px-5 py-3 border-t border-gray-50 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-800">{l.food_name ?? 'Food entry'}</p>
                      <p className="text-xs text-gray-400 capitalize">{l.meal_type}</p>
                    </div>
                    <p className="text-xs text-gray-500">{Math.round(l.calories)} kcal</p>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* Training */}
      {tab === 'training' && data && (
        <div className="space-y-3">
          {data.workouts.length === 0 && <Empty label="No workouts recorded." />}
          {data.workouts.map((w) => (
            <div key={w.id} className="bg-white rounded-2xl border p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">{w.name}</p>
                <span className="text-xs text-gray-400">{duration(w.started_at, w.ended_at)}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{fmt(w.started_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
