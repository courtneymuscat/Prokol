'use client'

import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
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

type WorkoutExercise = {
  name: string
  category: string
  notes: string | null
  video_url: string | null
}

type Workout = {
  id: string
  name: string
  started_at: string
  ended_at: string
  exercises: WorkoutExercise[]
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
  scan_image_url: string | null
  meal_notes: string | null
  meal_photo_url: string | null
}

type Note = {
  id: string
  body: string
  created_at: string
}

type MealNote = {
  log_date: string
  meal_type: string
  note: string | null
  photo_url: string | null
}

type ClientData = {
  checkIns: CheckIn[]
  workouts: Workout[]
  weightLogs: WeightLog[]
  foodLogs: FoodLog[]
  mealNotes: MealNote[]
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

type ClientFile = { id?: string; url: string; label: string; formTitle: string; submittedAt: string; source?: string }

function FilesTab({ clientId }: { clientId: string }) {
  const [files, setFiles] = useState<ClientFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function loadFiles() {
    return fetch(`/api/coach/clients/${clientId}/files`)
      .then((r) => r.json())
      .then((d) => setFiles(Array.isArray(d) ? d : []))
  }

  useEffect(() => {
    loadFiles().finally(() => setLoading(false))
  }, [clientId])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)

    const supabase = createClient()
    const ext = file.name.split('.').pop() ?? 'bin'
    const path = `coach-uploads/${clientId}/${Date.now()}.${ext}`

    const { data: storageData, error: storageError } = await supabase.storage
      .from('client-uploads')
      .upload(path, file, { upsert: false })

    if (storageError || !storageData) {
      setUploadError(storageError?.message ?? 'Upload failed')
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const { data: urlData } = supabase.storage.from('client-uploads').getPublicUrl(storageData.path)
    const publicUrl = urlData.publicUrl

    const res = await fetch(`/api/coach/clients/${clientId}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: publicUrl, name: file.name }),
    })

    if (!res.ok) {
      const d = await res.json()
      setUploadError(d.error ?? 'Failed to save file record')
    } else {
      await loadFiles()
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function startRename(file: ClientFile) {
    setRenamingId(file.id!)
    setRenameValue(file.label)
  }

  async function handleRename(id: string) {
    if (!renameValue.trim()) return
    const res = await fetch(`/api/coach/clients/${clientId}/files/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: renameValue.trim() }),
    })
    if (res.ok) {
      setFiles((prev) => prev.map((f) => f.id === id ? { ...f, label: renameValue.trim() } : f))
    }
    setRenamingId(null)
  }

  async function handleDelete(file: ClientFile) {
    if (!confirm(`Delete "${file.label}"? This cannot be undone.`)) return
    setDeletingId(file.id!)
    const res = await fetch(`/api/coach/clients/${clientId}/files/${file.id}`, { method: 'DELETE' })
    if (res.ok) {
      setFiles((prev) => prev.filter((f) => f.id !== file.id))
    }
    setDeletingId(null)
  }

  if (loading) return <p className="text-sm text-gray-400 py-10 text-center">Loading files…</p>

  return (
    <div className="space-y-3">
      {/* Upload section */}
      <div className="bg-white rounded-2xl border p-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Upload file for client</p>
        <div className="flex items-center gap-3">
          <label className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-colors ${uploading ? 'bg-gray-100 text-gray-400 pointer-events-none' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {uploading ? 'Uploading…' : 'Choose file'}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              disabled={uploading}
              onChange={handleUpload}
            />
          </label>
          {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
        </div>
      </div>

      {files.length === 0 && <Empty label="No files uploaded yet." />}
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
              {renamingId === f.id ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRename(f.id!); if (e.key === 'Escape') setRenamingId(null) }}
                    className="text-sm border border-blue-300 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-0"
                  />
                  <button onClick={() => handleRename(f.id!)} className="text-xs font-semibold text-blue-600 hover:text-blue-800">Save</button>
                  <button onClick={() => setRenamingId(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">{f.label}</p>
                  {f.source === 'coach' && (
                    <span className="text-[10px] bg-purple-50 text-purple-500 font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0">Coach</span>
                  )}
                </div>
              )}
              <p className="text-xs text-gray-400">{f.formTitle} · {fmtFull(f.submittedAt)}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                View
              </a>
              {f.source === 'coach' && f.id && renamingId !== f.id && (
                <>
                  <button
                    onClick={() => startRename(f)}
                    className="text-xs font-semibold text-gray-500 hover:text-gray-700"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => handleDelete(f)}
                    disabled={deletingId === f.id}
                    className="text-xs font-semibold text-red-400 hover:text-red-600 disabled:opacity-50"
                  >
                    {deletingId === f.id ? '…' : 'Delete'}
                  </button>
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Program tab ───────────────────────────────────────────────────────────────

type PMetrics = 'weight+reps' | 'reps' | 'weight+time' | 'time' | 'calories'
const PMETRICS_LABELS: Record<PMetrics, string> = {
  'weight+reps': 'Wt + Reps', 'reps': 'Reps only', 'weight+time': 'Wt + Time',
  'time': 'Time', 'calories': 'Cals',
}
type PMetricsCfg = { col1: string; col2?: string; f1: keyof PSet; f2?: keyof PSet }
const PMETRICS_CONFIG: Record<PMetrics, PMetricsCfg> = {
  'weight+reps': { col1: 'Weight', col2: 'Reps',       f1: 'weight',   f2: 'reps'     },
  'reps':        { col1: 'Reps',                        f1: 'reps'                      },
  'weight+time': { col1: 'Weight', col2: 'Time (sec)',  f1: 'weight',   f2: 'duration' },
  'time':        { col1: 'Time (sec)',                  f1: 'duration'                  },
  'calories':    { col1: 'Calories', col2: 'Time (sec)',f1: 'calories', f2: 'duration' },
}
type PSet = { id: string; setNumber: number; weight: string; reps: string; duration: string; calories: string; rest: string }
type PLibEx = { id: string; name: string; category: string; equipment: string; muscles?: string; video_url?: string | null }
type PExercise = {
  type: 'exercise'; id: string; exercise_id: string | null
  name: string; category: string; equipment: string; video_url: string
  metrics: PMetrics; showRest: boolean; sets: PSet[]; notes: string
}
type PSection = { type: 'section'; id: string; title: string; notes: string }
type PDayItem = PExercise | PSection
type PDay = { id: string; name: string; items: PDayItem[] }
type PWeek = { id: string; label: string; days: PDay[] }

type ClientProgram = {
  id: string
  program_id: string | null
  name: string
  content: PWeek[]
  start_date: string
  status: string
  created_at: string
  updated_at: string
}

type ProgramTemplate = {
  id: string
  name: string
  description: string | null
  week_count: number
}

const PCATS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'other']

function pNewSet(num: number, prev?: PSet): PSet {
  return { id: crypto.randomUUID(), setNumber: num, weight: prev?.weight ?? '', reps: prev?.reps ?? '', duration: prev?.duration ?? '', calories: prev?.calories ?? '', rest: prev?.rest ?? '' }
}
function pNewEx(lib?: PLibEx): PExercise {
  return { type: 'exercise', id: crypto.randomUUID(), exercise_id: lib?.id ?? null, name: lib?.name ?? '', category: lib?.category ?? '', equipment: lib?.equipment ?? '', video_url: lib?.video_url ?? '', metrics: lib?.category === 'cardio' ? 'calories' : 'weight+reps', showRest: false, sets: [pNewSet(1)], notes: '' }
}
function pNewSection(): PSection { return { type: 'section', id: crypto.randomUUID(), title: '', notes: '' } }
function pNewDay(n: number): PDay { return { id: crypto.randomUUID(), name: `Day ${n}`, items: [] } }
function pNewWeek(n: number): PWeek { return { id: crypto.randomUUID(), label: `Week ${n}`, days: [] } }
function pCloneWeek(src: PWeek, label: string): PWeek {
  return { id: crypto.randomUUID(), label, days: src.days.map((d) => ({ ...d, id: crypto.randomUUID(), items: d.items.map((it) => ({ ...it, id: crypto.randomUUID(), ...(it.type === 'exercise' ? { sets: it.sets.map((s) => ({ ...s, id: crypto.randomUUID() })) } : {}) })) as PDayItem[] })) }
}

// Migrate old content formats to new PWeek[] format
function migrateOldPEx(ex: Record<string, unknown>): PExercise {
  const n = Number(ex.sets) || 3
  return {
    type: 'exercise', id: (ex.id as string) || crypto.randomUUID(), exercise_id: (ex.exercise_id as string | null) || null,
    name: (ex.name as string) || '', category: (ex.category as string) || '', equipment: (ex.equipment as string) || '',
    video_url: (ex.video_url as string) || '', metrics: 'weight+reps', showRest: false,
    sets: Array.from({ length: n }, (_, i) => ({ id: crypto.randomUUID(), setNumber: i + 1, weight: String(ex.weight || ''), reps: String(ex.reps || '8-12'), duration: '', calories: '', rest: '' })),
    notes: (ex.notes as string) || '',
  }
}
function migratePDay(raw: Record<string, unknown>): PDay {
  if (Array.isArray(raw.items)) return raw as unknown as PDay
  const items: PDayItem[] = []
  if (Array.isArray(raw.sections)) {
    for (const sec of raw.sections as Record<string, unknown>[]) {
      if ((sec.title as string)?.trim()) items.push({ type: 'section', id: crypto.randomUUID(), title: sec.title as string, notes: '' })
      for (const ex of (sec.exercises as Record<string, unknown>[]) || []) items.push(migrateOldPEx(ex))
    }
  } else {
    for (const ex of (raw.exercises as Record<string, unknown>[]) || []) items.push(migrateOldPEx(ex))
  }
  return { id: (raw.id as string) || crypto.randomUUID(), name: (raw.name as string) || 'Day', items }
}
function migratePContent(content: unknown[]): PWeek[] {
  return content.map((w) => {
    const wk = w as Record<string, unknown>
    return { id: (wk.id as string) || crypto.randomUUID(), label: (wk.label as string) || 'Week', days: ((wk.days as Record<string, unknown>[]) || []).map(migratePDay) }
  })
}

// ── Program sub-components ────────────────────────────────────────────────────

function PMoveButtons({ onUp, onDown, canUp, canDown }: { onUp: () => void; onDown: () => void; canUp: boolean; canDown: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <button onClick={onUp} disabled={!canUp} className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 disabled:opacity-20 disabled:cursor-default transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
      </button>
      <button onClick={onDown} disabled={!canDown} className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 disabled:opacity-20 disabled:cursor-default transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
      </button>
    </div>
  )
}

function PExercisePicker({ onSelect, onClose }: { onSelect: (ex: PLibEx) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PLibEx[]>([])
  const [recent, setRecent] = useState<PLibEx[]>([])
  const [category, setCategory] = useState('all')
  const [creating, setCreating] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createCategory, setCreateCategory] = useState('other')
  const [createEquipment, setCreateEquipment] = useState('bodyweight')
  const [createSaving, setCreateSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    fetch('/api/exercises/recent').then((r) => r.json()).then(setRecent).catch(() => {})
  }, [])

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      const p = new URLSearchParams({ q: query })
      if (category !== 'all') p.set('category', category)
      const res = await fetch(`/api/exercises/search?${p}`)
      setResults(await res.json())
    }, 250)
    return () => clearTimeout(t)
  }, [query, category])

  async function handleCreate() {
    if (!createName.trim()) return
    setCreateSaving(true)
    const res = await fetch('/api/exercises/custom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: createName, category: createCategory, equipment: createEquipment }) })
    setCreateSaving(false)
    if (res.ok) onSelect(await res.json())
  }

  const list = query.length >= 2 ? results : recent

  return (
    <div className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search exercise library…"
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg px-1">✕</button>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {['all', ...PCATS].map((cat) => (
          <button key={cat} onClick={() => setCategory(cat)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize transition-colors ${category === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {cat}
          </button>
        ))}
      </div>
      <div className="max-h-56 overflow-y-auto space-y-0.5">
        {query.length >= 2 && !creating && (
          <button onClick={() => { setCreateName(query); setCreating(true) }}
            className="w-full text-left px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 border-b transition-colors">
            + Create &quot;{query}&quot; as custom exercise
          </button>
        )}
        {creating && (
          <div className="p-3 space-y-2 bg-gray-50 border-b">
            <input autoFocus value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Exercise name"
              className="w-full border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <div className="flex gap-2">
              <select value={createCategory} onChange={(e) => setCreateCategory(e.target.value)} className="flex-1 border rounded-lg px-2 py-1.5 text-xs focus:outline-none">
                {PCATS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={createEquipment} onChange={(e) => setCreateEquipment(e.target.value)} className="flex-1 border rounded-lg px-2 py-1.5 text-xs focus:outline-none">
                {['bodyweight','barbell','dumbbell','machine','cable','kettlebell','bands','other'].map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={createSaving || !createName.trim()}
                className="flex-1 bg-blue-600 text-white text-xs font-semibold py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {createSaving ? 'Creating…' : 'Add exercise'}
              </button>
              <button onClick={() => setCreating(false)} className="text-xs text-gray-400 hover:text-gray-600 px-2">Cancel</button>
            </div>
          </div>
        )}
        {query.length < 2 && recent.length > 0 && <p className="text-xs text-gray-400 font-medium px-3 pb-1">Recently used</p>}
        {list.length === 0 && query.length < 2 && !creating && <p className="text-sm text-gray-400 text-center py-4">Type to search exercises</p>}
        {list.length === 0 && query.length >= 2 && !creating && <p className="text-sm text-gray-400 text-center py-4">No exercises found</p>}
        {list.map((ex) => (
          <button key={ex.id} onClick={() => onSelect(ex)} className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors">
            <p className="text-sm font-medium text-gray-900">{ex.name}</p>
            <p className="text-xs text-gray-400 capitalize">{ex.category} · {ex.equipment}{ex.muscles ? ` · ${ex.muscles}` : ''}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

function PSectionBlock({ section, canUp, canDown, onChange, onRemove, onMoveUp, onMoveDown }: {
  section: PSection; canUp: boolean; canDown: boolean
  onChange: (s: PSection) => void; onRemove: () => void; onMoveUp: () => void; onMoveDown: () => void
}) {
  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <PMoveButtons onUp={onMoveUp} onDown={onMoveDown} canUp={canUp} canDown={canDown} />
        <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0">Section</span>
        <input value={section.title} onChange={(e) => onChange({ ...section, title: e.target.value })}
          placeholder="Section title (e.g. Warm Up, Metcon)"
          className="flex-1 text-sm font-semibold text-gray-900 bg-transparent outline-none border-b border-transparent focus:border-gray-300 min-w-0" />
        <button onClick={onRemove} className="text-gray-300 hover:text-red-400 text-xl leading-none flex-shrink-0">×</button>
      </div>
      <textarea value={section.notes} onChange={(e) => onChange({ ...section, notes: e.target.value })}
        placeholder="Notes, instructions, or reminders…"
        rows={2}
        className="w-full text-sm text-gray-700 border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-purple-300 placeholder:text-gray-300" />
    </div>
  )
}

function PExerciseBlock({ we, canUp, canDown, onMoveUp, onMoveDown, onChange, onRemove }: {
  we: PExercise; canUp: boolean; canDown: boolean
  onMoveUp: () => void; onMoveDown: () => void
  onChange: (u: PExercise) => void; onRemove: () => void
}) {
  const [showPicker, setShowPicker] = useState(false)
  const cfg = PMETRICS_CONFIG[we.metrics]
  const hasTwoCols = !!cfg.col2
  const gridCols = we.showRest
    ? hasTwoCols ? 'grid-cols-[24px_1fr_1fr_72px_28px]' : 'grid-cols-[24px_1fr_72px_28px]'
    : hasTwoCols ? 'grid-cols-[24px_1fr_1fr_28px]'    : 'grid-cols-[24px_1fr_28px]'

  function updateSet(setId: string, field: keyof PSet, value: string) {
    onChange({ ...we, sets: we.sets.map((s) => s.id === setId ? { ...s, [field]: value } : s) })
  }
  function addSet() {
    const prev = we.sets[we.sets.length - 1]
    onChange({ ...we, sets: [...we.sets, pNewSet(we.sets.length + 1, prev)] })
  }
  function removeSet(setId: string) {
    const sets = we.sets.filter((s) => s.id !== setId).map((s, i) => ({ ...s, setNumber: i + 1 }))
    onChange({ ...we, sets })
  }
  function handleLibSelect(lib: PLibEx) {
    onChange({ ...we, exercise_id: lib.id, name: lib.name, category: lib.category, equipment: lib.equipment, video_url: lib.video_url ?? '', metrics: lib.category === 'cardio' ? 'calories' : we.metrics })
    setShowPicker(false)
  }

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <div className="flex items-start gap-2">
        <PMoveButtons onUp={onMoveUp} onDown={onMoveDown} canUp={canUp} canDown={canDown} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">{we.name || <span className="text-gray-300 italic font-normal">Unnamed exercise</span>}</p>
          {(we.category || we.equipment) && <p className="text-xs text-gray-400 capitalize mt-0.5">{we.category}{we.equipment ? ` · ${we.equipment}` : ''}</p>}
        </div>
        <button onClick={() => setShowPicker(true)}
          className="text-xs text-blue-500 hover:text-blue-700 border border-blue-100 rounded-lg px-2 py-1 flex-shrink-0 font-medium transition-colors">
          {we.exercise_id ? 'Change' : 'Search'}
        </button>
        <button onClick={onRemove} className="text-gray-300 hover:text-red-400 text-xl leading-none flex-shrink-0">×</button>
      </div>
      {showPicker && <PExercisePicker onSelect={handleLibSelect} onClose={() => setShowPicker(false)} />}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(Object.keys(PMETRICS_LABELS) as PMetrics[]).map((m) => (
          <button key={m} onClick={() => onChange({ ...we, metrics: m })}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${we.metrics === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {PMETRICS_LABELS[m]}
          </button>
        ))}
        <button onClick={() => onChange({ ...we, showRest: !we.showRest })}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ml-auto ${we.showRest ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
          ⏱ Rest
        </button>
      </div>
      <div className={`${gridCols} gap-2 text-xs text-gray-400 font-medium px-1 grid`}>
        <span className="text-center">#</span>
        <span className="text-center">{cfg.col1}</span>
        {cfg.col2 && <span className="text-center">{cfg.col2}</span>}
        {we.showRest && <span className="text-center">Rest (s)</span>}
        <span />
      </div>
      {we.sets.map((set) => (
        <div key={set.id} className={`${gridCols} gap-2 items-center grid`}>
          <span className="text-sm text-gray-500 text-center">{set.setNumber}</span>
          <input type="text" placeholder="—" value={set[cfg.f1] as string}
            onChange={(e) => updateSet(set.id, cfg.f1, e.target.value)}
            className="border rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-300" />
          {cfg.col2 && cfg.f2 && (
            <input type="text" placeholder="—" value={set[cfg.f2] as string}
              onChange={(e) => updateSet(set.id, cfg.f2!, e.target.value)}
              className="border rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-300" />
          )}
          {we.showRest && (
            <input type="number" inputMode="numeric" placeholder="90" value={set.rest}
              onChange={(e) => updateSet(set.id, 'rest', e.target.value)}
              className="border rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-1 focus:ring-orange-300" />
          )}
          <button onClick={() => removeSet(set.id)} className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-400 text-xl">×</button>
        </div>
      ))}
      <button onClick={addSet} className="text-sm text-blue-600 hover:text-blue-700 font-medium">+ Add Set</button>
      <textarea value={we.notes} onChange={(e) => onChange({ ...we, notes: e.target.value })}
        placeholder="Coaching notes, cues, or tempo…"
        rows={we.notes ? 2 : 1}
        className="w-full text-xs text-gray-600 border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-300 placeholder:text-gray-300" />
    </div>
  )
}

function PDayEditor({ day, onChange, onClose }: { day: PDay; onChange: (d: PDay) => void; onClose: () => void }) {
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  function updateItem(i: number, item: PDayItem) {
    const items = [...day.items]; items[i] = item; onChange({ ...day, items })
  }
  function removeItem(i: number) {
    onChange({ ...day, items: day.items.filter((_, idx) => idx !== i) })
  }
  function moveItem(i: number, dir: 'up' | 'down') {
    const next = dir === 'up' ? i - 1 : i + 1
    if (next < 0 || next >= day.items.length) return
    const items = [...day.items];
    [items[i], items[next]] = [items[next], items[i]]
    onChange({ ...day, items })
  }
  function addExercise(lib: PLibEx) {
    onChange({ ...day, items: [...day.items, pNewEx(lib)] })
    setShowSearch(false); setShowAddMenu(false)
  }
  function addSection() {
    onChange({ ...day, items: [...day.items, pNewSection()] })
    setShowAddMenu(false)
  }

  return (
    <div className="border-t border-blue-100 bg-blue-50/30 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-800">{day.name}</p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">✕ Close</button>
      </div>
      <div className="space-y-3">
        {day.items.length === 0 && !showSearch && (
          <p className="text-sm text-gray-400 text-center py-4">No exercises yet. Add one below.</p>
        )}
        {day.items.map((item, i) =>
          item.type === 'exercise' ? (
            <PExerciseBlock key={item.id} we={item}
              canUp={i > 0} canDown={i < day.items.length - 1}
              onMoveUp={() => moveItem(i, 'up')} onMoveDown={() => moveItem(i, 'down')}
              onChange={(u) => updateItem(i, u)} onRemove={() => removeItem(i)} />
          ) : (
            <PSectionBlock key={item.id} section={item}
              canUp={i > 0} canDown={i < day.items.length - 1}
              onChange={(u) => updateItem(i, u)} onRemove={() => removeItem(i)}
              onMoveUp={() => moveItem(i, 'up')} onMoveDown={() => moveItem(i, 'down')} />
          )
        )}
        {showSearch && <PExercisePicker onSelect={addExercise} onClose={() => { setShowSearch(false); setShowAddMenu(false) }} />}
        {!showSearch && (
          showAddMenu ? (
            <div className="flex gap-2">
              <button onClick={() => setShowSearch(true)}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                Add Exercise
              </button>
              <button onClick={addSection}
                className="flex-1 flex items-center justify-center gap-2 border border-purple-200 text-purple-600 rounded-xl py-2.5 text-sm font-semibold hover:bg-purple-50 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
                Add Section
              </button>
              <button onClick={() => setShowAddMenu(false)}
                className="w-10 flex items-center justify-center text-gray-400 hover:text-gray-600 border border-gray-200 rounded-xl text-lg">✕</button>
            </div>
          ) : (
            <button onClick={() => setShowAddMenu(true)}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-200 rounded-xl py-3 text-sm font-semibold text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add
            </button>
          )
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') {
    return (
      <span className="text-xs bg-green-50 text-green-600 font-semibold px-2 py-0.5 rounded-full">Active</span>
    )
  }
  if (status === 'completed') {
    return (
      <span className="text-xs bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-full">Completed</span>
    )
  }
  return (
    <span className="text-xs bg-amber-50 text-amber-500 font-semibold px-2 py-0.5 rounded-full capitalize">{status}</span>
  )
}

function AssignedProgramCard({
  assignment,
  clientId,
  onUnassign,
  onUpdated,
  onSaveAsTemplate,
  savingTemplateId,
  savedTemplateId,
}: {
  assignment: ClientProgram
  clientId: string
  onUnassign: (id: string) => void
  onUpdated: (updated: ClientProgram) => void
  onSaveAsTemplate?: (id: string) => void
  savingTemplateId?: string | null
  savedTemplateId?: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [localContent, setLocalContent] = useState<PWeek[]>(() =>
    migratePContent(Array.isArray(assignment.content) ? assignment.content : [])
  )
  const [editingStartDate, setEditingStartDate] = useState(false)
  const [localStartDate, setLocalStartDate] = useState(assignment.start_date)
  // selectedDay: [weekIndex, dayIndex] | null
  const [selectedDay, setSelectedDay] = useState<[number, number] | null>(null)
  const [dragFrom, setDragFrom] = useState<[number, number] | null>(null)
  const [dragOver, setDragOver] = useState<[number, number] | null>(null)

  // Compute end date from start + weeks
  const numWeeks = localContent.length
  const startDateObj = new Date(localStartDate + 'T00:00:00')
  const endDateObj = new Date(startDateObj)
  endDateObj.setDate(startDateObj.getDate() + numWeeks * 7 - 1)
  const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  function updateContent(next: PWeek[]) { setLocalContent(next); setDirty(true); setSaveStatus('idle') }

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/coach/clients/${clientId}/programs/${assignment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: localContent, start_date: localStartDate }),
    })
    setSaving(false)
    if (res.ok) {
      const updated = await res.json()
      onUpdated(updated)
      setDirty(false)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } else {
      setSaveStatus('error')
    }
  }

  async function handleStartDateChange(newDate: string) {
    setLocalStartDate(newDate)
    setEditingStartDate(false)
    setDirty(true)
    setSaveStatus('idle')
  }

  async function handleStatusChange(status: string) {
    const res = await fetch(`/api/coach/clients/${clientId}/programs/${assignment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) onUpdated(await res.json())
  }

  async function handleUnassign() {
    if (!confirm(`Remove "${assignment.name}" from this client?`)) return
    const res = await fetch(`/api/coach/clients/${clientId}/programs/${assignment.id}`, { method: 'DELETE' })
    if (res.ok) onUnassign(assignment.id)
  }

  function addWeek() {
    const next = [...localContent, pNewWeek(localContent.length + 1)]
    updateContent(next)
  }

  function duplicateWeek(i: number) {
    const copy = pCloneWeek(localContent[i], `Week ${localContent.length + 1}`)
    const next = [...localContent.slice(0, i + 1), copy, ...localContent.slice(i + 1)]
    updateContent(next)
    if (selectedDay?.[0] === i) setSelectedDay(null)
  }

  function deleteWeek(i: number) {
    if (!confirm(`Delete ${localContent[i].label}?`)) return
    const next = localContent.filter((_, wi) => wi !== i)
    updateContent(next)
    if (selectedDay?.[0] === i) setSelectedDay(null)
  }

  function addDay(weekIdx: number) {
    const week = localContent[weekIdx]
    const next = localContent.map((w, i) => i !== weekIdx ? w : { ...w, days: [...w.days, pNewDay(w.days.length + 1)] })
    updateContent(next)
    setSelectedDay([weekIdx, week.days.length])
  }

  function updateDay(weekIdx: number, dayIdx: number, day: PDay) {
    updateContent(localContent.map((w, i) => {
      if (i !== weekIdx) return w
      const days = [...w.days]; days[dayIdx] = day; return { ...w, days }
    }))
  }

  function deleteDay(weekIdx: number, dayIdx: number) {
    if (!confirm('Remove this day?')) return
    updateContent(localContent.map((w, i) => i !== weekIdx ? w : { ...w, days: w.days.filter((_, di) => di !== dayIdx) }))
    if (selectedDay?.[0] === weekIdx && selectedDay?.[1] === dayIdx) setSelectedDay(null)
  }

  function moveDay(weekIdx: number, from: number, to: number) {
    if (from === to) return
    const week = localContent[weekIdx]
    if (!week) return
    const days = [...week.days]
    const [moved] = days.splice(from, 1)
    days.splice(to, 0, moved)
    updateContent(localContent.map((w, i) => i === weekIdx ? { ...w, days } : w))
    if (selectedDay?.[0] === weekIdx && selectedDay?.[1] === from) setSelectedDay([weekIdx, to])
  }

  const maxDays = Math.max(4, ...localContent.map((w) => w.days.length))
  const cols = Math.min(maxDays, 7)

  return (
    <div className="bg-white rounded-2xl border overflow-hidden">
      {/* Card header */}
      <div className="flex items-start justify-between p-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-semibold text-gray-900">{assignment.name}</p>
            <StatusBadge status={assignment.status} />
          </div>
          {/* Editable start date + computed date range */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {editingStartDate ? (
              <input
                type="date"
                autoFocus
                defaultValue={localStartDate}
                onBlur={(e) => handleStartDateChange(e.target.value || localStartDate)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleStartDateChange((e.target as HTMLInputElement).value || localStartDate); if (e.key === 'Escape') setEditingStartDate(false) }}
                className="text-xs border border-blue-300 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            ) : (
              <button
                onClick={() => setEditingStartDate(true)}
                className="text-xs text-gray-400 hover:text-blue-600 hover:underline transition-colors"
                title="Edit start date"
              >
                {fmtDate(startDateObj)}
              </button>
            )}
            {numWeeks > 0 && (
              <span className="text-xs text-gray-400">
                → {fmtDate(endDateObj)} · {numWeeks} week{numWeeks !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-3 flex-wrap justify-end">
          <select
            value={assignment.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="paused">Paused</option>
          </select>
          {saveStatus === 'saved' && <span className="text-xs text-green-500">Saved</span>}
          {saveStatus === 'error' && <span className="text-xs text-red-500">Save failed</span>}
          {dirty && saveStatus === 'idle' && <span className="text-xs text-amber-500">Unsaved</span>}
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${dirty ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-500'}`}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-gray-400 hover:text-gray-700 transition-colors"
          >
            <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {onSaveAsTemplate && (
            <button
              onClick={() => onSaveAsTemplate(assignment.id)}
              disabled={savingTemplateId === assignment.id}
              className="text-xs font-semibold text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {savedTemplateId === assignment.id ? 'Saved ✓' : savingTemplateId === assignment.id ? 'Saving…' : 'Save as Template'}
            </button>
          )}
          <button onClick={handleUnassign} className="text-gray-300 hover:text-red-400 transition-colors" title="Remove program">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded: calendar grid */}
      {expanded && (
        <div className="border-t border-gray-100">
          {/* Calendar grid header */}
          <div className="px-5 pt-4 pb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Program Calendar</p>
            <button onClick={addWeek} className="text-xs font-semibold text-blue-600 hover:text-blue-700">+ Add Week</button>
          </div>

          {localContent.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-gray-400 mb-3">No weeks yet.</p>
              <button onClick={addWeek} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700">+ Add Week 1</button>
            </div>
          ) : (
            <div className="px-5 pb-4 overflow-x-auto">
              <div style={{ minWidth: `${cols * 130 + 110}px` }}>
                {/* Column headers */}
                <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: `106px repeat(${cols}, 1fr)` }}>
                  <div />
                  {Array.from({ length: cols }, (_, i) => (
                    <div key={i} className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center py-1">Day {i + 1}</div>
                  ))}
                </div>
                {/* Week rows */}
                {localContent.map((week, wi) => (
                  <div key={week.id} className="grid gap-2 mb-3" style={{ gridTemplateColumns: `106px repeat(${cols}, 1fr)` }}>
                    {/* Week label + actions */}
                    <div className="flex flex-col items-end justify-start pr-2 pt-2 gap-1">
                      <span className="text-xs font-bold text-gray-700 truncate max-w-full">{week.label}</span>
                      <button onClick={() => addDay(wi)} className="text-[10px] text-blue-500 hover:text-blue-700 font-medium">+ Day</button>
                      <button onClick={() => duplicateWeek(wi)} className="text-[10px] text-gray-400 hover:text-gray-600">Dupe</button>
                      <button onClick={() => deleteWeek(wi)} className="text-[10px] text-gray-300 hover:text-red-400">Del</button>
                    </div>
                    {/* Day cells */}
                    {Array.from({ length: cols }, (_, di) => {
                      const day = week.days[di]
                      const exercises = (day?.items ?? []).filter((it) => it.type === 'exercise') as PExercise[]
                      const isSelected = selectedDay?.[0] === wi && selectedDay?.[1] === di
                      const isDragging = dragFrom?.[0] === wi && dragFrom?.[1] === di
                      const isDropTarget = dragOver?.[0] === wi && dragOver?.[1] === di && dragFrom?.[0] === wi && !isDragging
                      return (
                        <div key={di}
                          draggable={!!day}
                          onDragStart={day ? (e) => { e.dataTransfer.effectAllowed = 'move'; setDragFrom([wi, di]) } : undefined}
                          onDragOver={day ? (e) => { e.preventDefault(); setDragOver([wi, di]) } : (e) => e.preventDefault()}
                          onDragEnter={dragFrom?.[0] === wi ? (e) => { e.preventDefault(); setDragOver([wi, di]) } : undefined}
                          onDragEnd={() => { setDragFrom(null); setDragOver(null) }}
                          onDrop={(e) => {
                            e.preventDefault()
                            if (dragFrom && dragFrom[0] === wi) moveDay(wi, dragFrom[1], di)
                            setDragFrom(null); setDragOver(null)
                          }}
                          onClick={() => day && !dragFrom && setSelectedDay(isSelected ? null : [wi, di])}
                          className={`min-h-[80px] rounded-xl border p-2 transition-all ${
                            isDragging
                              ? 'opacity-40 border-blue-300 bg-blue-50 cursor-grabbing'
                              : isDropTarget
                                ? 'border-blue-500 bg-blue-50 shadow-md scale-[1.02]'
                                : day
                                  ? isSelected
                                    ? 'bg-blue-50 border-blue-400 shadow-sm cursor-pointer'
                                    : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm cursor-grab'
                                  : dragFrom?.[0] === wi
                                    ? 'bg-blue-50/30 border-dashed border-blue-200'
                                    : 'bg-gray-50/40 border-dashed border-gray-100'
                          }`}>
                          {day ? (
                            <>
                              <div className="flex items-start justify-between gap-1 mb-1">
                                <p className="text-[10px] font-bold text-blue-700 truncate flex-1">{day.name}</p>
                                <button onClick={(e) => { e.stopPropagation(); deleteDay(wi, di) }}
                                  className="text-gray-200 hover:text-red-400 text-xs leading-none flex-shrink-0">×</button>
                              </div>
                              <div className="space-y-0.5">
                                {exercises.slice(0, 4).map((ex, i) => (
                                  <p key={i} className="text-[10px] text-gray-500 truncate">{ex.name || <span className="text-gray-300 italic">Unnamed</span>}</p>
                                ))}
                                {exercises.length > 4 && <p className="text-[10px] text-gray-300">+{exercises.length - 4} more</p>}
                                {exercises.length === 0 && <p className="text-[10px] text-gray-300 italic">Empty</p>}
                              </div>
                            </>
                          ) : (
                            <p className="text-[10px] text-gray-200 text-center mt-5">—</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Day editor panel */}
          {selectedDay && (() => {
            const [wi, di] = selectedDay
            const day = localContent[wi]?.days[di]
            if (!day) return null
            return (
              <PDayEditor
                day={day}
                onChange={(d) => updateDay(wi, di, d)}
                onClose={() => setSelectedDay(null)}
              />
            )
          })()}
        </div>
      )}
    </div>
  )
}

function AssignProgramModal({
  clientId,
  onClose,
  onAssigned,
}: {
  clientId: string
  onClose: () => void
  onAssigned: (assignment: ClientProgram) => void
}) {
  const [templates, setTemplates] = useState<ProgramTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [assigning, setAssigning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/coach/programs')
      .then((r) => r.json())
      .then((d) => setTemplates(Array.isArray(d) ? d : []))
      .finally(() => setLoadingTemplates(false))
  }, [])

  async function handleAssign() {
    if (!selectedId) return
    setAssigning(true)
    setError(null)
    const res = await fetch(`/api/coach/clients/${clientId}/programs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ program_id: selectedId, start_date: startDate }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to assign program')
      setAssigning(false)
      return
    }
    onAssigned(data)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900">Assign Program</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loadingTemplates ? (
          <p className="text-sm text-gray-400 text-center py-8">Loading programs…</p>
        ) : templates.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 mb-3">No programs yet.</p>
            <a
              href="/coach/programs"
              className="text-sm font-semibold text-blue-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Create a program first →
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full text-left rounded-xl border p-3.5 transition-colors ${
                    selectedId === t.id
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                  {t.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{t.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {t.week_count} week{t.week_count !== 1 ? 's' : ''}
                  </p>
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Start date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                className="flex-1 border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={!selectedId || assigning}
                className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {assigning ? 'Assigning…' : 'Assign Program'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ProgramTab({ clientId }: { clientId: string }) {
  const [assignments, setAssignments] = useState<ClientProgram[]>([])
  const [loading, setLoading] = useState(true)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [savingProgTemplateId, setSavingProgTemplateId] = useState<string | null>(null)
  const [savedProgTemplateId, setSavedProgTemplateId] = useState<string | null>(null)

  async function loadPrograms() {
    const d = await fetch(`/api/coach/clients/${clientId}/programs`).then((r) => r.json())
    const list: ClientProgram[] = Array.isArray(d) ? d : []

    // Sort by start_date ascending
    list.sort((a, b) => a.start_date.localeCompare(b.start_date))

    // Auto-complete expired programs
    const today = new Date().toISOString().slice(0, 10)
    const toComplete = list.filter((a) => {
      if (a.status !== 'active') return false
      const numWeeks = Array.isArray(a.content) ? a.content.length : 0
      if (numWeeks === 0) return false
      const end = new Date(a.start_date + 'T00:00:00')
      end.setDate(end.getDate() + numWeeks * 7 - 1)
      return end.toISOString().slice(0, 10) < today
    })
    await Promise.all(
      toComplete.map((a) =>
        fetch(`/api/coach/clients/${clientId}/programs/${a.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'completed' }),
        }).then((r) => r.ok ? r.json() : null)
          .then((updated) => { if (updated) { const idx = list.findIndex((x) => x.id === updated.id); if (idx >= 0) list[idx] = updated } })
      )
    )
    setAssignments([...list])
  }

  useEffect(() => {
    loadPrograms().finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  function handleAssigned(assignment: ClientProgram) {
    setAssignments((prev) => [...prev, assignment].sort((a, b) => a.start_date.localeCompare(b.start_date)))
  }

  function handleUnassign(id: string) {
    setAssignments((prev) => prev.filter((a) => a.id !== id))
  }

  function handleUpdated(updated: ClientProgram) {
    setAssignments((prev) =>
      prev.map((a) => (a.id === updated.id ? updated : a))
          .sort((a, b) => a.start_date.localeCompare(b.start_date))
    )
  }

  async function handleCreateProgram() {
    const name = prompt('Program name:')
    if (!name?.trim()) return
    const blankContent = [pNewWeek(1)]
    const res = await fetch(`/api/coach/clients/${clientId}/programs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        program_id: null,
        name: name.trim(),
        content: blankContent,
        start_date: new Date().toISOString().split('T')[0],
      }),
    })
    if (res.ok) {
      await loadPrograms()
    }
  }

  async function handleSaveProgAsTemplate(assignmentId: string) {
    setSavingProgTemplateId(assignmentId)
    await fetch(`/api/coach/clients/${clientId}/programs/${assignmentId}/save-as-template`, { method: 'POST' })
    setSavingProgTemplateId(null)
    setSavedProgTemplateId(assignmentId)
    setTimeout(() => setSavedProgTemplateId(null), 3000)
  }

  if (loading) {
    return <p className="text-sm text-gray-400 text-center py-10">Loading programs…</p>
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          {assignments.length === 0 ? 'No programs assigned' : `${assignments.length} program${assignments.length !== 1 ? 's' : ''}`}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCreateProgram}
            className="text-xs font-semibold text-white bg-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Create New
          </button>
          <button
            onClick={() => setShowAssignModal(true)}
            className="text-xs font-semibold text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Assign Program
          </button>
        </div>
      </div>

      {assignments.length === 0 && (
        <div className="text-center py-14 bg-white rounded-2xl border">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 mb-1">No programs assigned yet</p>
          <p className="text-xs text-gray-400 mb-4">Assign a training program template to this client.</p>
          <button
            onClick={() => setShowAssignModal(true)}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            + Assign Program
          </button>
        </div>
      )}

      {assignments.map((a) => (
        <AssignedProgramCard
          key={a.id}
          assignment={a}
          clientId={clientId}
          onUnassign={handleUnassign}
          onUpdated={handleUpdated}
          onSaveAsTemplate={handleSaveProgAsTemplate}
          savingTemplateId={savingProgTemplateId}
          savedTemplateId={savedProgTemplateId}
        />
      ))}

      {showAssignModal && (
        <AssignProgramModal
          clientId={clientId}
          onClose={() => setShowAssignModal(false)}
          onAssigned={handleAssigned}
        />
      )}
    </div>
  )
}

// ── Calendar tab ──────────────────────────────────────────────────────────────

type CalendarEvent = {
  id: string
  event_date: string
  type: string
  title: string
  content: Record<string, unknown>
}

type CalHabit = { id: string; name: string; type: string; target: number | null; unit: string | null; icon: string | null }
type MacroDay = { cal: number; protein: number; carbs: number; fat: number }

const EVENT_COLORS: Record<string, string> = {
  workout: 'bg-blue-50 text-blue-700 border-blue-200',
  steps: 'bg-green-50 text-green-700 border-green-200',
  note: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  habit: 'bg-purple-50 text-purple-700 border-purple-200',
  custom: 'bg-gray-50 text-gray-700 border-gray-200',
}

function getWeekStart(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number) {
  const d = new Date(date); d.setDate(d.getDate() + days); return d
}

function toDateStr(date: Date) { return date.toISOString().slice(0, 10) }

// Handles both old format (exercises[]) and new format (items: DayItem[])
function getWorkoutsForDate(
  programs: { id: string; name: string; start_date: string; content: unknown[] }[],
  date: Date
) {
  const results: { programName: string; dayName: string; exerciseCount: number }[] = []
  const dateStr = toDateStr(date)
  for (const prog of programs) {
    const start = new Date(prog.start_date); start.setHours(0, 0, 0, 0)
    const target = new Date(dateStr); target.setHours(0, 0, 0, 0)
    const dayOffset = Math.round((target.getTime() - start.getTime()) / 86400000)
    if (dayOffset < 0) continue
    const weekIdx = Math.floor(dayOffset / 7)
    const dayIdx = dayOffset % 7
    const week = (prog.content[weekIdx] ?? {}) as Record<string, unknown>
    const day = ((week.days ?? []) as Record<string, unknown>[])[dayIdx]
    if (!day) continue
    // New format: items array
    const items = day.items as { type: string }[] | undefined
    const exes = day.exercises as unknown[] | undefined
    const count = Array.isArray(items)
      ? items.filter((it) => it.type === 'exercise').length
      : Array.isArray(exes) ? exes.length : 0
    if (count > 0) {
      results.push({ programName: prog.name, dayName: (day.name as string) || `Day ${dayIdx + 1}`, exerciseCount: count })
    }
  }
  return results
}

function CalendarTab({ clientId }: { clientId: string }) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [programs, setPrograms] = useState<{ id: string; name: string; start_date: string; content: unknown[] }[]>([])
  const [foodByDate, setFoodByDate] = useState<Record<string, MacroDay>>({})
  const [habits, setHabits] = useState<CalHabit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addingEvent, setAddingEvent] = useState<string | null>(null)
  const [newEvent, setNewEvent] = useState({ type: 'note', title: '', content: '' })
  const [saving, setSaving] = useState(false)

  const weekEnd = addDays(weekStart, 6)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  async function loadData(start: Date, end: Date) {
    setLoading(true); setError(null)
    try {
      const res = await fetch(
        `/api/coach/clients/${clientId}/calendar?start_date=${toDateStr(start)}&end_date=${toDateStr(end)}`
      )
      if (!res.ok) { setError('Failed to load calendar'); return }
      const data = await res.json()
      setEvents(data.events ?? [])
      setPrograms(data.programs ?? [])
      setFoodByDate(data.foodByDate ?? {})
      setHabits(data.habits ?? [])
    } catch {
      setError('Failed to load calendar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData(weekStart, weekEnd) }, [weekStart]) // eslint-disable-line react-hooks/exhaustive-deps

  function prevWeek() { setWeekStart((d) => addDays(d, -7)) }
  function nextWeek() { setWeekStart((d) => addDays(d, 7)) }
  function thisWeek() { setWeekStart(getWeekStart(new Date())) }

  async function saveEvent(date: string) {
    if (!newEvent.title.trim()) return
    setSaving(true)
    const res = await fetch(`/api/coach/clients/${clientId}/calendar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_date: date, type: newEvent.type, title: newEvent.title, content: newEvent.content ? { note: newEvent.content } : {} }),
    })
    if (res.ok) { const created = await res.json(); setEvents((prev) => [...prev, created]) }
    setAddingEvent(null); setNewEvent({ type: 'note', title: '', content: '' }); setSaving(false)
  }

  async function deleteEvent(id: string) {
    await fetch(`/api/coach/clients/${clientId}/calendar/${id}`, { method: 'DELETE' })
    setEvents((prev) => prev.filter((e) => e.id !== id))
  }

  const today = toDateStr(new Date())

  return (
    <div className="space-y-4">
      {/* Week nav */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={thisWeek} className="text-xs font-semibold text-blue-600 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100">Today</button>
          <button onClick={nextWeek} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
        <p className="text-sm font-semibold text-gray-700">
          {weekStart.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} – {weekEnd.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>

      {/* Habits legend */}
      {habits.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {habits.map((h) => (
            <span key={h.id} className="text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-100 rounded-full px-2 py-0.5">
              {h.icon ?? '✅'} {h.name}
            </span>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-10">Loading calendar…</p>
      ) : error ? (
        <p className="text-sm text-red-500 text-center py-10">{error}</p>
      ) : (
        <div className="grid grid-cols-7 gap-1.5">
          {weekDays.map((day) => {
            const dateStr = toDateStr(day)
            const isToday = dateStr === today
            const isPast = dateStr < today
            const dayEvents = events.filter((e) => e.event_date === dateStr)
            const workouts = getWorkoutsForDate(programs, day)
            const macros = foodByDate[dateStr]
            const hasContent = workouts.length > 0 || dayEvents.length > 0 || macros

            return (
              <div key={dateStr} className={`rounded-xl border p-2 min-h-[150px] flex flex-col gap-1 ${
                isToday ? 'border-blue-400 bg-blue-50/40' : isPast ? 'bg-gray-50/50 border-gray-100' : 'bg-white border-gray-100'
              }`}>
                {/* Day header */}
                <div className="flex items-center justify-between mb-0.5">
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase">{day.toLocaleDateString('en-AU', { weekday: 'short' })}</p>
                    <p className={`text-sm font-bold leading-none ${isToday ? 'text-blue-600' : 'text-gray-800'}`}>{day.getDate()}</p>
                  </div>
                  <button onClick={() => setAddingEvent(dateStr)} className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-300 hover:text-gray-500">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  </button>
                </div>

                {/* Training plan workouts */}
                {workouts.map((w, i) => (
                  <div key={i} className="text-[10px] bg-blue-100 text-blue-700 rounded-md px-1.5 py-1 font-medium">
                    <p className="truncate font-semibold">💪 {w.dayName}</p>
                    <p className="opacity-70 truncate">{w.programName} · {w.exerciseCount} ex</p>
                  </div>
                ))}

                {/* Macros */}
                {macros && (
                  <div className="text-[10px] bg-orange-50 text-orange-700 border border-orange-100 rounded-md px-1.5 py-1 space-y-0.5">
                    <p className="font-semibold">{Math.round(macros.cal)} kcal</p>
                    <p className="opacity-80">P {Math.round(macros.protein)}g · C {Math.round(macros.carbs)}g · F {Math.round(macros.fat)}g</p>
                  </div>
                )}

                {/* Habits — shown as reminders on every day */}
                {habits.length > 0 && (
                  <div className="text-[10px] bg-purple-50 text-purple-600 border border-purple-100 rounded-md px-1.5 py-0.5 font-medium">
                    {habits.length} habit{habits.length !== 1 ? 's' : ''}
                  </div>
                )}

                {/* Custom events */}
                {dayEvents.map((evt) => (
                  <div key={evt.id} className={`text-[10px] rounded-md px-1.5 py-0.5 font-medium truncate border flex items-center justify-between gap-0.5 group ${EVENT_COLORS[evt.type] ?? EVENT_COLORS.custom}`}>
                    <span className="truncate">{evt.title}</span>
                    <button onClick={() => deleteEvent(evt.id)} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}

                {!hasContent && habits.length === 0 && (
                  <p className="text-[10px] text-gray-300 mt-auto text-center pb-1">Rest</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add event modal */}
      {addingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">Add Event — {new Date(addingEvent + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })}</h3>
              <button onClick={() => setAddingEvent(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <select value={newEvent.type} onChange={(e) => setNewEvent((n) => ({ ...n, type: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="note">📝 Note</option>
              <option value="workout">💪 Workout</option>
              <option value="steps">👟 Steps Goal</option>
              <option value="habit">✅ Habit</option>
              <option value="custom">⚡ Custom</option>
            </select>
            <input type="text" value={newEvent.title} onChange={(e) => setNewEvent((n) => ({ ...n, title: e.target.value }))}
              placeholder="Title (e.g. 10,000 steps today)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
            <textarea value={newEvent.content} onChange={(e) => setNewEvent((n) => ({ ...n, content: e.target.value }))}
              placeholder="Notes (optional)" rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            <div className="flex gap-3">
              <button onClick={() => setAddingEvent(null)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
              <button onClick={() => saveEvent(addingEvent)} disabled={!newEvent.title.trim() || saving}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Meal Plan tab ─────────────────────────────────────────────────────────────

type ClientMealPlan = {
  id: string
  meal_plan_id: string | null
  name: string
  content: { id: string; label: string; foods: { food_name: string; grams: number; calories: number; protein: number; carbs: number; fat: number }[] }[]
  start_date: string
  status: string
}

type MealPlanTemplate = {
  id: string
  name: string
  goal: string
  total_calories: number
  content: unknown[]
}

function MealPlanTab({ clientId }: { clientId: string }) {
  const [assignments, setAssignments] = useState<ClientMealPlan[]>([])
  const [templates, setTemplates] = useState<MealPlanTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showAssign, setShowAssign] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createCalories, setCreateCalories] = useState('')
  const [savingTemplateId, setSavingTemplateId] = useState<string | null>(null)
  const [savedTemplateId, setSavedTemplateId] = useState<string | null>(null)

  async function loadPlans() {
    const [plans, tmpl] = await Promise.all([
      fetch(`/api/coach/clients/${clientId}/meal-plans`).then((r) => r.json()),
      fetch('/api/coach/meal-plans').then((r) => r.json()),
    ])
    setAssignments(Array.isArray(plans) ? plans : [])
    setTemplates(Array.isArray(tmpl) ? tmpl : [])
  }

  useEffect(() => {
    loadPlans().finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  async function handleCreateNew(e: React.FormEvent) {
    e.preventDefault()
    if (!createName.trim()) return
    setCreating(true)
    const res = await fetch(`/api/coach/clients/${clientId}/meal-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: createName.trim(),
        content: [],
        total_calories: parseInt(createCalories) || 0,
        start_date: new Date().toISOString().split('T')[0],
      }),
    })
    if (res.ok) {
      setShowCreateModal(false)
      setCreateName('')
      setCreateCalories('')
      await loadPlans()
    }
    setCreating(false)
  }

  async function handleSaveAsTemplate(planId: string) {
    setSavingTemplateId(planId)
    await fetch(`/api/coach/clients/${clientId}/meal-plans/${planId}/save-as-template`, { method: 'POST' })
    setSavingTemplateId(null)
    setSavedTemplateId(planId)
    setTimeout(() => setSavedTemplateId(null), 3000)
  }

  async function handleAssign() {
    if (!selectedTemplateId) return
    setAssigning(true)
    const template = templates.find((t) => t.id === selectedTemplateId)
    const res = await fetch(`/api/coach/clients/${clientId}/meal-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meal_plan_id: selectedTemplateId,
        name: template?.name ?? 'Meal Plan',
        content: template?.content ?? [],
        start_date: startDate,
      }),
    })
    if (res.ok) {
      const created = await res.json()
      setAssignments((prev) => [created, ...prev])
      setShowAssign(false)
    }
    setAssigning(false)
  }

  async function handleRemove(id: string) {
    if (!confirm('Remove this meal plan from client?')) return
    await fetch(`/api/coach/clients/${clientId}/meal-plans/${id}`, { method: 'DELETE' })
    setAssignments((prev) => prev.filter((a) => a.id !== id))
  }

  if (loading) return <p className="text-sm text-gray-400 text-center py-10">Loading meal plans…</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          {assignments.length === 0 ? 'No meal plans assigned' : `${assignments.length} plan${assignments.length !== 1 ? 's' : ''}`}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-xs font-semibold text-white bg-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Create New
          </button>
          <button
            onClick={() => setShowAssign(true)}
            className="text-xs font-semibold text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Assign Template
          </button>
        </div>
      </div>

      {assignments.length === 0 && (
        <div className="text-center py-14 bg-white rounded-2xl border">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 mb-1">No meal plan assigned</p>
          <p className="text-xs text-gray-400 mb-4">Assign a nutrition plan template to this client.</p>
          <button onClick={() => setShowAssign(true)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
            + Assign Plan
          </button>
        </div>
      )}

      {assignments.map((plan) => {
        const totalCals = plan.content.reduce((a, slot) => a + slot.foods.reduce((b, f) => b + f.calories, 0), 0)
        return (
          <div key={plan.id} className="bg-white rounded-2xl border overflow-hidden">
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">{plan.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  From {new Date(plan.start_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {' · '}{Math.round(totalCals)} kcal/day
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setExpanded(expanded === plan.id ? null : plan.id)}
                  className="text-xs font-semibold text-blue-600 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
                >
                  {expanded === plan.id ? 'Hide' : 'View'}
                </button>
                <button onClick={() => handleRemove(plan.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
            {expanded === plan.id && (
              <div className="border-t border-gray-100 divide-y divide-gray-50">
                {plan.content.map((slot) => (
                  <div key={slot.id} className="px-4 py-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{slot.label}</p>
                    <div className="space-y-1.5">
                      {slot.foods.map((f, fi) => (
                        <div key={fi} className="flex items-center justify-between text-sm">
                          <span className="text-gray-800">{f.food_name}</span>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span>{f.grams}g</span>
                            <span className="font-medium text-gray-600">{f.calories} kcal</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* Action buttons */}
            <div className="flex items-center gap-2 px-4 pb-4 pt-2 border-t border-gray-50">
              <a
                href={`/coach/clients/${clientId}/meal-plans/${plan.id}`}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
              >
                Edit Plan →
              </a>
              <span className="text-gray-200">|</span>
              <button
                onClick={() => handleSaveAsTemplate(plan.id)}
                disabled={savingTemplateId === plan.id}
                className="text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
              >
                {savedTemplateId === plan.id ? 'Saved ✓' : savingTemplateId === plan.id ? 'Saving…' : 'Save as Template'}
              </button>
            </div>
          </div>
        )
      })}

      {/* Assign modal */}
      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">Assign Meal Plan</h2>
              <button onClick={() => setShowAssign(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {templates.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 mb-3">No meal plan templates yet.</p>
                <a href="/coach/meal-plans" className="text-sm font-semibold text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                  Create a plan first →
                </a>
              </div>
            ) : (
              <>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplateId(t.id)}
                      className={`w-full text-left rounded-xl border p-3.5 transition-colors ${
                        selectedTemplateId === t.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5 capitalize">{t.goal} · {t.total_calories.toLocaleString()} kcal</p>
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Start date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setShowAssign(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">
                    Cancel
                  </button>
                  <button
                    onClick={handleAssign}
                    disabled={!selectedTemplateId || assigning}
                    className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                  >
                    {assigning ? 'Assigning…' : 'Assign'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Create New modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-gray-900">Create New Meal Plan</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateNew} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Plan name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Cut Phase Week 1"
                  required
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Calorie target
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={createCalories}
                    onChange={(e) => setCreateCalories(e.target.value)}
                    placeholder="2000"
                    min={0}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">kcal</span>
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !createName.trim()}
                  className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Habits tab ────────────────────────────────────────────────────────────────

type Habit = {
  id: string
  name: string
  type: string
  target: number
  unit: string
  icon: string
  active: boolean
}

const HABIT_PRESETS = [
  { name: 'Daily Steps', icon: '👟', unit: 'steps', target: 10000 },
  { name: 'Water Intake', icon: '💧', unit: 'glasses', target: 8 },
  { name: 'Sleep Hours', icon: '😴', unit: 'hours', target: 8 },
  { name: 'Protein Target', icon: '🥩', unit: 'g protein', target: 150 },
  { name: 'No Alcohol', icon: '🚫', unit: 'times', target: 1 },
  { name: 'Morning Walk', icon: '🌅', unit: 'times', target: 1 },
]

// ── CheckinSchedulesPanel ─────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type CheckinSchedule = {
  id: string
  title: string
  form_id: string | null
  form_title: string | null
  day_of_week: number
  repeat_type: string
  start_date: string
  is_active: boolean
  created_at: string
}

type ScheduleForm = {
  id: string
  title: string
  type: string
}

type ScheduleModalState = {
  open: boolean
  editing: CheckinSchedule | null
}

const REPEAT_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'once', label: 'One-time' },
]

function CheckinSchedulesPanel({ clientId }: { clientId: string }) {
  const [schedules, setSchedules] = useState<CheckinSchedule[]>([])
  const [coachForms, setCoachForms] = useState<ScheduleForm[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ScheduleModalState>({ open: false, editing: null })

  // Form state
  const [title, setTitle] = useState('')
  const [formId, setFormId] = useState<string>('new')
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [repeatType, setRepeatType] = useState('weekly')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  async function loadSchedules() {
    const res = await fetch(`/api/coach/clients/${clientId}/checkin-schedules`)
    if (res.ok) {
      const data: CheckinSchedule[] = await res.json()
      setSchedules(data)
    }
  }

  async function loadForms() {
    const res = await fetch('/api/forms')
    if (res.ok) {
      const data: ScheduleForm[] = await res.json()
      setCoachForms(data.filter((f) => f.type === 'weekly_checkin'))
    }
  }

  useEffect(() => {
    Promise.all([loadSchedules(), loadForms()]).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  function openAddModal() {
    setModal({ open: true, editing: null })
    setTitle('')
    setFormId('new')
    setDayOfWeek(1)
    setRepeatType('weekly')
    setStartDate(new Date().toISOString().split('T')[0])
    setIsActive(true)
    setModalError(null)
  }

  function openEditModal(s: CheckinSchedule) {
    setModal({ open: true, editing: s })
    setTitle(s.title)
    setFormId(s.form_id ?? 'new')
    setDayOfWeek(s.day_of_week)
    setRepeatType(s.repeat_type)
    setStartDate(s.start_date)
    setIsActive(s.is_active)
    setModalError(null)
  }

  function closeModal() {
    setModal({ open: false, editing: null })
    setModalError(null)
  }

  async function handleSave() {
    if (!title.trim()) { setModalError('Title is required'); return }
    setSaving(true)
    setModalError(null)

    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        day_of_week: dayOfWeek,
        repeat_type: repeatType,
        start_date: startDate,
        is_active: isActive,
      }
      if (formId !== 'new') body.form_id = formId

      let res: Response
      if (modal.editing) {
        res = await fetch(`/api/coach/clients/${clientId}/checkin-schedules/${modal.editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch(`/api/coach/clients/${clientId}/checkin-schedules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }

      if (!res.ok) {
        const d = await res.json()
        setModalError(d.error ?? 'Something went wrong')
        return
      }

      await loadSchedules()
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(s: CheckinSchedule) {
    await fetch(`/api/coach/clients/${clientId}/checkin-schedules/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !s.is_active }),
    })
    await loadSchedules()
  }

  async function handleDelete(s: CheckinSchedule) {
    if (!confirm(`Delete schedule "${s.title}"?`)) return
    await fetch(`/api/coach/clients/${clientId}/checkin-schedules/${s.id}`, { method: 'DELETE' })
    await loadSchedules()
  }

  if (loading) return <p className="text-sm text-gray-400 py-4">Loading schedules…</p>

  return (
    <div className="bg-white rounded-2xl border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Scheduled Check-ins</p>
        <button
          onClick={openAddModal}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg text-gray-900 hover:opacity-90 transition-colors"
          style={{ backgroundColor: '#FFD885' }}
        >
          + Add Schedule
        </button>
      </div>

      {schedules.length === 0 && (
        <p className="text-sm text-gray-400">No check-in schedules yet. Add one to prompt the client automatically.</p>
      )}

      <div className="space-y-3">
        {schedules.map((s) => (
          <div key={s.id} className="flex items-start justify-between gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-gray-900 truncate">{s.title}</p>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                  {s.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {DAY_NAMES[s.day_of_week]} · {REPEAT_OPTIONS.find((r) => r.value === s.repeat_type)?.label ?? s.repeat_type}
                {s.form_title ? ` · ${s.form_title}` : ' · No form'}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => openEditModal(s)}
                className="text-xs text-gray-500 hover:text-gray-900 px-2 py-1 rounded-lg hover:bg-white transition-colors"
              >
                Edit
              </button>
              {s.form_id && (
                <a
                  href={`/coach/forms/${s.form_id}/edit`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-white transition-colors"
                >
                  Edit Form
                </a>
              )}
              <button
                onClick={() => handleToggleActive(s)}
                className="text-xs text-gray-500 hover:text-gray-900 px-2 py-1 rounded-lg hover:bg-white transition-colors"
              >
                {s.is_active ? 'Deactivate' : 'Activate'}
              </button>
              <button
                onClick={() => handleDelete(s)}
                className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-white transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900">
              {modal.editing ? 'Edit Schedule' : 'Add Check-in Schedule'}
            </h3>

            {modalError && (
              <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{modalError}</p>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Weekly Check-in"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Day of Week</label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(Number(e.target.value))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
                >
                  {DAY_NAMES.map((d, i) => (
                    <option key={d} value={i}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Repeat</label>
                <select
                  value={repeatType}
                  onChange={(e) => setRepeatType(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
                >
                  {REPEAT_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Form</label>
                <select
                  value={formId}
                  onChange={(e) => setFormId(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
                >
                  <option value="new">Create new form</option>
                  {coachForms.map((f) => (
                    <option key={f.id} value={f.id}>{f.title}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="schedule-active"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="schedule-active" className="text-sm text-gray-700">Active</label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={closeModal}
                className="flex-1 text-sm font-semibold px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 text-sm font-semibold px-4 py-2.5 rounded-xl text-gray-900 hover:opacity-90 transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#FFD885' }}
              >
                {saving ? 'Saving…' : modal.editing ? 'Save Changes' : 'Add Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function HabitsTab({ clientId }: { clientId: string }) {
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', icon: '✓', unit: 'times', target: '1' })

  useEffect(() => {
    fetch(`/api/coach/clients/${clientId}/habits`)
      .then((r) => r.json())
      .then((d) => setHabits(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [clientId])

  async function handleAdd() {
    if (!form.name.trim()) return
    setSaving(true)
    const res = await fetch(`/api/coach/clients/${clientId}/habits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, icon: form.icon, unit: form.unit, target: Number(form.target) || 1, type: 'daily' }),
    })
    if (res.ok) {
      const created = await res.json()
      setHabits((prev) => [created, ...prev])
      setShowAdd(false)
      setForm({ name: '', icon: '✓', unit: 'times', target: '1' })
    }
    setSaving(false)
  }

  async function toggleActive(habit: Habit) {
    await fetch(`/api/coach/clients/${clientId}/habits/${habit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !habit.active }),
    })
    setHabits((prev) => prev.map((h) => h.id === habit.id ? { ...h, active: !h.active } : h))
  }

  async function deleteHabit(id: string) {
    if (!confirm('Remove this habit from client?')) return
    await fetch(`/api/coach/clients/${clientId}/habits/${id}`, { method: 'DELETE' })
    setHabits((prev) => prev.filter((h) => h.id !== id))
  }

  function usePreset(preset: typeof HABIT_PRESETS[0]) {
    setForm({ name: preset.name, icon: preset.icon, unit: preset.unit, target: String(preset.target) })
  }

  if (loading) return <p className="text-sm text-gray-400 text-center py-10">Loading habits…</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          {habits.length === 0 ? 'No habits assigned' : `${habits.filter((h) => h.active).length} active habits`}
        </p>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          + Add Habit
        </button>
      </div>

      {habits.length === 0 && (
        <div className="text-center py-14 bg-white rounded-2xl border">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-sm text-gray-500 mb-1">No habits assigned</p>
          <p className="text-xs text-gray-400 mb-4">Add daily habits like steps, water, sleep targets for your client to track.</p>
          <button onClick={() => setShowAdd(true)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
            Add first habit
          </button>
        </div>
      )}

      {habits.map((habit) => (
        <div key={habit.id} className={`bg-white rounded-2xl border p-4 flex items-center gap-4 ${!habit.active ? 'opacity-50' : ''}`}>
          <span className="text-2xl">{habit.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">{habit.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Target: {habit.target} {habit.unit} · {habit.type}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleActive(habit)}
              className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
                habit.active ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {habit.active ? 'Active' : 'Inactive'}
            </button>
            <button onClick={() => deleteHabit(habit.id)} className="text-gray-300 hover:text-red-400 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      ))}

      {/* Add habit modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">Add Habit</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Presets */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Quick add</p>
              <div className="grid grid-cols-3 gap-1.5">
                {HABIT_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => usePreset(p)}
                    className="text-xs text-left border border-gray-200 rounded-lg p-2 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <span className="text-base">{p.icon}</span>
                    <p className="text-[10px] text-gray-600 mt-0.5 leading-tight">{p.name}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.icon}
                  onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                  placeholder="🎯"
                  className="w-14 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Habit name"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={form.target}
                  onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
                  placeholder="Target"
                  className="w-24 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  placeholder="unit (steps, glasses…)"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!form.name.trim() || saving}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Add Habit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type TabId = 'overview' | 'checkins' | 'nutrition' | 'training' | 'program' | 'calendar' | 'mealplan' | 'habits' | 'notes' | 'files'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'program', label: 'Training' },
  { id: 'mealplan', label: 'Meal Plan' },
  { id: 'habits', label: 'Habits' },
  { id: 'checkins', label: 'Check-ins' },
  { id: 'nutrition', label: 'Nutrition' },
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

      {/* Calendar */}
      {tab === 'calendar' && <CalendarTab clientId={clientId} />}

      {/* Training Program */}
      {tab === 'program' && <ProgramTab clientId={clientId} />}

      {/* Meal Plan */}
      {tab === 'mealplan' && <MealPlanTab clientId={clientId} />}

      {/* Habits */}
      {tab === 'habits' && <HabitsTab clientId={clientId} />}

      {/* Notes */}
      {tab === 'notes' && <NotesTab clientId={clientId} />}

      {/* Files */}
      {tab === 'files' && <FilesTab clientId={clientId} />}

      {/* Check-ins */}
      {tab === 'checkins' && (
        <div className="space-y-4">
          <CheckinSchedulesPanel clientId={clientId} />
          {data && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Submitted Check-ins</p>
              {data.checkIns.length === 0 && <Empty label="No check-ins submitted yet." />}
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
        </div>
      )}

      {/* Nutrition */}
      {tab === 'nutrition' && data && (
        <div className="space-y-3">
          {data.foodLogs.length === 0 && data.mealNotes.length === 0 && <Empty label="No food logs recorded." />}
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
            // Group food items by meal_type for this day
            const byMeal = logs.reduce<Record<string, typeof logs>>((acc, l) => {
              acc[l.meal_type] = acc[l.meal_type] ?? []
              acc[l.meal_type].push(l)
              return acc
            }, {})
            // Meal notes for this day
            const dayMealNotes = data.mealNotes.filter((n) => n.log_date === date)
            const allMealTypes = Array.from(new Set([...Object.keys(byMeal), ...dayMealNotes.map((n) => n.meal_type)]))
            return (
              <div key={date} className="bg-white rounded-2xl border overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-700">{fmt(date)}</p>
                  <p className="text-xs text-gray-500">
                    {Math.round(totals.cal)} kcal · {Math.round(totals.p)}g P · {Math.round(totals.c)}g C · {Math.round(totals.f)}g F
                  </p>
                </div>
                {allMealTypes.map((mealType) => {
                  const mealLogs = byMeal[mealType] ?? []
                  const mealNote = dayMealNotes.find((n) => n.meal_type === mealType)
                  return (
                    <div key={mealType}>
                      {/* Meal-level note / photo */}
                      {(mealNote?.note || mealNote?.photo_url) && (
                        <div className="px-5 py-2.5 border-t border-gray-50 bg-blue-50/40 flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-blue-500 uppercase tracking-wide capitalize">{mealType} note</p>
                            {mealNote.note && <p className="text-xs text-blue-600 italic mt-0.5">"{mealNote.note}"</p>}
                          </div>
                          {mealNote.photo_url && (
                            <a href={mealNote.photo_url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                              <img src={mealNote.photo_url} alt="Meal photo" className="h-14 w-20 object-cover rounded-lg border border-blue-100 hover:opacity-80 transition-opacity" />
                            </a>
                          )}
                        </div>
                      )}
                      {mealLogs.map((l) => (
                        <div key={l.id} className="px-5 py-3 border-t border-gray-50">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-800">{l.food_name ?? 'Food entry'}</p>
                              <p className="text-xs text-gray-400 capitalize">{l.meal_type}</p>
                              {l.meal_notes && (
                                <p className="text-xs text-blue-500 italic mt-0.5">"{l.meal_notes}"</p>
                              )}
                              {l.scan_image_url && (
                                <div className="mt-2">
                                  <a href={l.scan_image_url} target="_blank" rel="noopener noreferrer">
                                    <img src={l.scan_image_url} alt="AI meal scan" className="h-20 w-28 object-cover rounded-lg border border-gray-100 hover:opacity-80 transition-opacity" />
                                  </a>
                                  <p className="text-[10px] text-gray-400 mt-0.5">AI scanned meal</p>
                                </div>
                              )}
                            </div>
                            <div className="flex items-start gap-2 flex-shrink-0">
                              {l.meal_photo_url && (
                                <a href={l.meal_photo_url} target="_blank" rel="noopener noreferrer">
                                  <img src={l.meal_photo_url} alt="Meal photo" className="h-12 w-16 object-cover rounded-lg border border-gray-100 hover:opacity-80 transition-opacity" />
                                </a>
                              )}
                              <p className="text-xs text-gray-500 mt-0.5">{Math.round(l.calories)} kcal</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })}
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
            <div key={w.id} className="bg-white rounded-2xl border p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">{w.name}</p>
                <span className="text-xs text-gray-400">{duration(w.started_at, w.ended_at)}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{fmt(w.started_at)}</p>
              {w.exercises.length > 0 && (
                <div className="border-t border-gray-100 pt-3 space-y-2">
                  {w.exercises.map((ex, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-800">{ex.name}</p>
                        <span className="text-xs text-gray-400 capitalize">{ex.category}</span>
                        {ex.video_url && (
                          <a
                            href={ex.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1 ml-auto flex-shrink-0"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            View form video
                          </a>
                        )}
                      </div>
                      {ex.notes && (
                        <p className="text-xs text-gray-500 italic">"{ex.notes}"</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
