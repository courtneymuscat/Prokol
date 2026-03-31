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

type ProgramExercise = {
  id: string
  name: string
  sets: number
  reps: string
  weight: string
  rest: number
  notes: string
  video_url: string
}

type ProgramDay = {
  id: string
  name: string
  exercises: ProgramExercise[]
}

type ProgramWeek = {
  id: string
  label: string
  days: ProgramDay[]
}

type ClientProgram = {
  id: string
  program_id: string | null
  name: string
  content: ProgramWeek[]
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

const REST_LABELS: Record<number, string> = {
  30: '30s', 45: '45s', 60: '1 min', 90: '90s',
  120: '2 min', 180: '3 min', 240: '4 min', 300: '5 min',
}

function fmtRestLabel(seconds: number): string {
  return REST_LABELS[seconds] ?? `${seconds}s`
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

function ProgramExerciseRow({
  exercise,
  editable,
  onChange,
  onDelete,
}: {
  exercise: ProgramExercise
  editable: boolean
  onChange?: (ex: ProgramExercise) => void
  onDelete?: () => void
}) {
  function field<K extends keyof ProgramExercise>(key: K, value: ProgramExercise[K]) {
    if (onChange) onChange({ ...exercise, [key]: value })
  }

  if (!editable) {
    return (
      <div className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{exercise.name || '—'}</p>
          {exercise.notes && <p className="text-xs text-gray-400 italic mt-0.5">"{exercise.notes}"</p>}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 flex-shrink-0">
          <span>{exercise.sets}×{exercise.reps}</span>
          {exercise.weight && <span className="text-gray-400">{exercise.weight}</span>}
          <span className="text-gray-300">{fmtRestLabel(exercise.rest)}</span>
          {exercise.video_url && (
            <a href={exercise.video_url} target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:text-purple-700">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="border border-gray-100 rounded-xl p-3 bg-white space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={exercise.name}
          onChange={(e) => field('name', e.target.value)}
          placeholder="Exercise name"
          className="flex-1 text-sm font-medium border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-300"
        />
        {onDelete && (
          <button onClick={onDelete} className="text-gray-200 hover:text-red-400 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1">
          <label className="text-[10px] text-gray-400 font-medium uppercase">Sets</label>
          <input
            type="number" min={1} max={20}
            value={exercise.sets}
            onChange={(e) => field('sets', parseInt(e.target.value) || 1)}
            className="w-14 text-xs border border-gray-200 rounded-lg px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-[10px] text-gray-400 font-medium uppercase">Reps</label>
          <input
            type="text" value={exercise.reps}
            onChange={(e) => field('reps', e.target.value)}
            placeholder="8-12"
            className="w-20 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-300"
          />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-[10px] text-gray-400 font-medium uppercase">Load</label>
          <input
            type="text" value={exercise.weight}
            onChange={(e) => field('weight', e.target.value)}
            placeholder="RPE 8"
            className="w-24 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-300"
          />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-[10px] text-gray-400 font-medium uppercase">Rest</label>
          <select
            value={exercise.rest}
            onChange={(e) => field('rest', parseInt(e.target.value))}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {[30,45,60,90,120,180,240,300].map((v) => (
              <option key={v} value={v}>{fmtRestLabel(v)}</option>
            ))}
          </select>
        </div>
      </div>
      <input
        type="text" value={exercise.notes}
        onChange={(e) => field('notes', e.target.value)}
        placeholder="Notes (optional)"
        className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-300"
      />
    </div>
  )
}

function AssignedProgramCard({
  assignment,
  clientId,
  onUnassign,
  onUpdated,
}: {
  assignment: ClientProgram
  clientId: string
  onUnassign: (id: string) => void
  onUpdated: (updated: ClientProgram) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [activeWeek, setActiveWeek] = useState(0)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [localContent, setLocalContent] = useState<ProgramWeek[]>(
    Array.isArray(assignment.content) ? assignment.content : []
  )
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function scheduleContentSave(content: ProgramWeek[]) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true)
      const res = await fetch(`/api/coach/clients/${clientId}/programs/${assignment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      setSaving(false)
      if (res.ok) {
        const updated = await res.json()
        onUpdated(updated)
      }
    }, 1500)
  }

  function updateExercise(weekIdx: number, dayIdx: number, exIdx: number, ex: ProgramExercise) {
    const next = localContent.map((w, wi) => {
      if (wi !== weekIdx) return w
      return {
        ...w,
        days: w.days.map((d, di) => {
          if (di !== dayIdx) return d
          const exercises = [...d.exercises]
          exercises[exIdx] = ex
          return { ...d, exercises }
        }),
      }
    })
    setLocalContent(next)
    scheduleContentSave(next)
  }

  function deleteExercise(weekIdx: number, dayIdx: number, exIdx: number) {
    const next = localContent.map((w, wi) => {
      if (wi !== weekIdx) return w
      return {
        ...w,
        days: w.days.map((d, di) => {
          if (di !== dayIdx) return d
          return { ...d, exercises: d.exercises.filter((_, ei) => ei !== exIdx) }
        }),
      }
    })
    setLocalContent(next)
    scheduleContentSave(next)
  }

  function addExercise(weekIdx: number, dayIdx: number) {
    const blank: ProgramExercise = {
      id: crypto.randomUUID(),
      name: '', sets: 3, reps: '8-12', weight: '', rest: 90, notes: '', video_url: '',
    }
    const next = localContent.map((w, wi) => {
      if (wi !== weekIdx) return w
      return {
        ...w,
        days: w.days.map((d, di) => {
          if (di !== dayIdx) return d
          return { ...d, exercises: [...d.exercises, blank] }
        }),
      }
    })
    setLocalContent(next)
    scheduleContentSave(next)
  }

  async function handleStatusChange(status: string) {
    const res = await fetch(`/api/coach/clients/${clientId}/programs/${assignment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const updated = await res.json()
      onUpdated(updated)
    }
  }

  async function handleUnassign() {
    if (!confirm(`Remove "${assignment.name}" from this client?`)) return
    const res = await fetch(`/api/coach/clients/${clientId}/programs/${assignment.id}`, {
      method: 'DELETE',
    })
    if (res.ok) onUnassign(assignment.id)
  }

  const currentWeek = localContent[activeWeek] ?? null

  return (
    <div className="bg-white rounded-2xl border overflow-hidden">
      {/* Card header */}
      <div className="flex items-start justify-between p-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-semibold text-gray-900">{assignment.name}</p>
            <StatusBadge status={assignment.status} />
            {saving && <span className="text-xs text-gray-400">Saving…</span>}
          </div>
          <p className="text-xs text-gray-400">
            Started {new Date(assignment.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            {' · '}{localContent.length} week{localContent.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          <select
            value={assignment.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="paused">Paused</option>
          </select>
          <button
            onClick={() => { setEditing((v) => !v); setExpanded(true) }}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
              editing
                ? 'bg-blue-50 text-blue-600 border-blue-200'
                : 'text-gray-500 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {editing ? 'Done' : 'Edit'}
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-gray-400 hover:text-gray-700 transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            onClick={handleUnassign}
            className="text-gray-300 hover:text-red-400 transition-colors"
            title="Remove program"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-100">
          {localContent.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No weeks in this program.</p>
          ) : (
            <>
              {/* Week tabs */}
              <div className="flex gap-1 px-5 pt-4 flex-wrap">
                {localContent.map((w, i) => (
                  <button
                    key={w.id}
                    onClick={() => setActiveWeek(i)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      i === activeWeek
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>

              {/* Days */}
              {currentWeek && (
                <div className="p-5 space-y-4">
                  {currentWeek.days.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">No days in this week.</p>
                  )}
                  {currentWeek.days.map((day, di) => (
                    <div key={day.id} className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">{day.name}</p>
                      <div className="space-y-2">
                        {day.exercises.length === 0 && !editing && (
                          <p className="text-xs text-gray-400">No exercises.</p>
                        )}
                        {day.exercises.map((ex, ei) => (
                          <ProgramExerciseRow
                            key={ex.id}
                            exercise={ex}
                            editable={editing}
                            onChange={editing ? (updated) => updateExercise(activeWeek, di, ei, updated) : undefined}
                            onDelete={editing ? () => deleteExercise(activeWeek, di, ei) : undefined}
                          />
                        ))}
                        {editing && (
                          <button
                            onClick={() => addExercise(activeWeek, di)}
                            className="w-full text-xs font-semibold text-blue-600 border border-dashed border-blue-200 rounded-lg py-2 hover:bg-blue-50 transition-colors"
                          >
                            + Add Exercise
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
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

  useEffect(() => {
    fetch(`/api/coach/clients/${clientId}/programs`)
      .then((r) => r.json())
      .then((d) => setAssignments(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [clientId])

  function handleAssigned(assignment: ClientProgram) {
    setAssignments((prev) => [assignment, ...prev])
  }

  function handleUnassign(id: string) {
    setAssignments((prev) => prev.filter((a) => a.id !== id))
  }

  function handleUpdated(updated: ClientProgram) {
    setAssignments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
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
        <button
          onClick={() => setShowAssignModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          + Assign Program
        </button>
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

type ProgramWeekSummary = {
  id: string
  name: string
  start_date: string
  content: { days: { name: string; exercises: { name: string }[] }[] }[]
}

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
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function toDateStr(date: Date) {
  return date.toISOString().slice(0, 10)
}

function getWorkoutsForDate(programs: ProgramWeekSummary[], date: Date) {
  const results: { programName: string; dayName: string; exerciseCount: number }[] = []
  const dateStr = toDateStr(date)
  for (const prog of programs) {
    const start = new Date(prog.start_date)
    start.setHours(0, 0, 0, 0)
    const targetDate = new Date(dateStr)
    targetDate.setHours(0, 0, 0, 0)
    const dayOffset = Math.round((targetDate.getTime() - start.getTime()) / 86400000)
    if (dayOffset < 0) continue
    const weekIdx = Math.floor(dayOffset / 7)
    const dayIdx = dayOffset % 7
    const week = prog.content[weekIdx]
    const day = week?.days[dayIdx]
    if (day && day.exercises.length > 0) {
      results.push({ programName: prog.name, dayName: day.name || `Day ${dayIdx + 1}`, exerciseCount: day.exercises.length })
    }
  }
  return results
}

function CalendarTab({ clientId }: { clientId: string }) {
  const supabase = createClient()
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [programs, setPrograms] = useState<ProgramWeekSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [addingEvent, setAddingEvent] = useState<string | null>(null)
  const [newEvent, setNewEvent] = useState({ type: 'note', title: '', content: '' })
  const [saving, setSaving] = useState(false)

  const weekEnd = addDays(weekStart, 6)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  async function loadData(start: Date, end: Date) {
    setLoading(true)
    const [{ data: evts }, { data: progs }] = await Promise.all([
      supabase.from('calendar_events').select('*').eq('client_id', clientId)
        .gte('event_date', toDateStr(start)).lte('event_date', toDateStr(end)),
      supabase.from('client_programs').select('id, name, start_date, content, status').eq('client_id', clientId).eq('status', 'active'),
    ])
    setEvents(evts ?? [])
    setPrograms(progs ?? [])
    setLoading(false)
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
    if (res.ok) {
      const created = await res.json()
      setEvents((prev) => [...prev, created])
    }
    setAddingEvent(null)
    setNewEvent({ type: 'note', title: '', content: '' })
    setSaving(false)
  }

  async function deleteEvent(id: string) {
    await fetch(`/api/coach/clients/${clientId}/calendar/${id}`, { method: 'DELETE' })
    setEvents((prev) => prev.filter((e) => e.id !== id))
  }

  const today = toDateStr(new Date())

  return (
    <div className="space-y-4">
      {/* Week nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button onClick={thisWeek} className="text-xs font-semibold text-blue-600 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors">
            Today
          </button>
          <button onClick={nextWeek} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <p className="text-sm font-semibold text-gray-700">
          {weekStart.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} – {weekEnd.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-10">Loading calendar…</p>
      ) : (
        <div className="grid grid-cols-7 gap-1.5">
          {weekDays.map((day) => {
            const dateStr = toDateStr(day)
            const isToday = dateStr === today
            const isPast = dateStr < today
            const dayEvents = events.filter((e) => e.event_date === dateStr)
            const workouts = getWorkoutsForDate(programs, day)

            return (
              <div
                key={dateStr}
                className={`rounded-xl border p-2 min-h-[120px] flex flex-col gap-1 ${
                  isToday ? 'border-blue-400 bg-blue-50/40' : isPast ? 'bg-gray-50/50 border-gray-100' : 'bg-white border-gray-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase">
                      {day.toLocaleDateString('en-AU', { weekday: 'short' })}
                    </p>
                    <p className={`text-sm font-bold leading-none ${isToday ? 'text-blue-600' : 'text-gray-800'}`}>
                      {day.getDate()}
                    </p>
                  </div>
                  <button
                    onClick={() => setAddingEvent(dateStr)}
                    className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-300 hover:text-gray-500 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>

                {workouts.length === 0 && dayEvents.length === 0 && (
                  <p className="text-[10px] text-gray-300 mt-auto text-center pb-1">Rest</p>
                )}

                {workouts.map((w, i) => (
                  <div key={i} className="text-[10px] bg-blue-100 text-blue-700 rounded-md px-1.5 py-0.5 font-medium truncate">
                    💪 {w.dayName}
                    {w.exerciseCount > 0 && <span className="opacity-60 ml-0.5">({w.exerciseCount})</span>}
                  </div>
                ))}

                {dayEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className={`text-[10px] rounded-md px-1.5 py-0.5 font-medium truncate border flex items-center justify-between gap-0.5 group ${
                      EVENT_COLORS[evt.type] ?? EVENT_COLORS.custom
                    }`}
                  >
                    <span className="truncate">{evt.title}</span>
                    <button
                      onClick={() => deleteEvent(evt.id)}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
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
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <select
              value={newEvent.type}
              onChange={(e) => setNewEvent((n) => ({ ...n, type: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="note">📝 Note</option>
              <option value="workout">💪 Workout</option>
              <option value="steps">👟 Steps Goal</option>
              <option value="habit">✅ Habit</option>
              <option value="custom">⚡ Custom</option>
            </select>

            <input
              type="text"
              value={newEvent.title}
              onChange={(e) => setNewEvent((n) => ({ ...n, title: e.target.value }))}
              placeholder="Title (e.g. 10,000 steps today)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <textarea
              value={newEvent.content}
              onChange={(e) => setNewEvent((n) => ({ ...n, content: e.target.value }))}
              placeholder="Notes (optional)"
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />

            <div className="flex gap-3">
              <button onClick={() => setAddingEvent(null)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={() => saveEvent(addingEvent)}
                disabled={!newEvent.title.trim() || saving}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
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

  useEffect(() => {
    Promise.all([
      fetch(`/api/coach/clients/${clientId}/meal-plans`).then((r) => r.json()),
      fetch('/api/coach/meal-plans').then((r) => r.json()),
    ]).then(([plans, tmpl]) => {
      setAssignments(Array.isArray(plans) ? plans : [])
      setTemplates(Array.isArray(tmpl) ? tmpl : [])
    }).finally(() => setLoading(false))
  }, [clientId])

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
        <button
          onClick={() => setShowAssign(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          + Assign Plan
        </button>
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
