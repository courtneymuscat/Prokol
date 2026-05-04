'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ActiveWorkout from '@/app/workouts/ActiveWorkout'
import WorkoutEditor from '@/app/workouts/WorkoutEditor'

// ─── Exercise history (coached clients) ──────────────────────────────────────

type CalHistorySession = {
  workoutName: string
  date: string
  notes: string | null
  sets: { set_number: number; weight_lbs: number | null; reps: number | null; duration_seconds: number | null; calories: number | null }[]
}

function ExerciseHistoryPanel({ exerciseId }: { exerciseId: string }) {
  const [expanded, setExpanded] = useState(false)
  const [history, setHistory] = useState<CalHistorySession[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch(`/api/exercises/history?exerciseId=${exerciseId}`)
      .then((r) => r.json())
      .then((d) => { setHistory(Array.isArray(d) ? d : []); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [exerciseId])

  if (!loaded) return null
  if (history.length === 0) return (
    <div className="flex items-center gap-1.5 mt-1">
      <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-xs text-gray-400">No previous sessions yet</p>
    </div>
  )

  function fmtSet(s: CalHistorySession['sets'][0]): string {
    const parts: string[] = []
    if (s.weight_lbs != null) parts.push(`${s.weight_lbs}kg`)
    if (s.reps != null) parts.push(`${s.reps} reps`)
    if (s.duration_seconds != null) parts.push(`${s.duration_seconds}s`)
    if (s.calories != null) parts.push(`${s.calories} cal`)
    return parts.join(' × ') || '—'
  }

  const last = history[0]
  const lastDate = new Date(last.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })

  return (
    <div className="mt-2 rounded-xl border border-gray-200 overflow-hidden">
      <button type="button" onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-semibold text-gray-600">Last session</span>
          <span className="text-xs text-gray-400">{lastDate}</span>
          {last.sets.slice(0, 4).map((s) => (
            <span key={s.set_number} className="text-xs bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-600 font-medium">
              {fmtSet(s)}
            </span>
          ))}
          {last.sets.length > 4 && <span className="text-xs text-gray-400">+{last.sets.length - 4}</span>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {history.length > 1 && <span className="text-[10px] text-gray-400">{history.length} sessions</span>}
          <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {expanded && (
        <div className="divide-y divide-gray-100">
          {history.map((session, i) => (
            <div key={i} className="px-3 py-2.5 space-y-2 bg-white">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-semibold text-gray-700 truncate">{session.workoutName}</p>
                <p className="text-xs text-gray-400 flex-shrink-0">
                  {new Date(session.date).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {session.sets.map((s) => (
                  <span key={s.set_number} className="text-xs bg-gray-50 border border-gray-200 rounded px-2 py-0.5 text-gray-700 font-medium">
                    <span className="text-gray-400 mr-1">{s.set_number}.</span>{fmtSet(s)}
                  </span>
                ))}
              </div>
              {session.notes && <p className="text-xs text-gray-500 italic border-t border-gray-100 pt-1.5">{session.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ScoreType = 'time' | 'reps' | 'rounds' | 'weight' | 'distance' | 'calories' | 'custom' | 'none'

type ProgramSet = { setNumber: number; reps: string; weight: string; duration?: string; rest?: string }

type ProgramItem = {
  type: 'exercise' | 'section'
  id: string
  name?: string        // exercise
  title?: string       // section
  notes?: string
  scoreType?: ScoreType
  scoreValue?: string
  sets?: ProgramSet[]
  metrics?: string
}

type ProgramDay = {
  id?: string
  name?: string
  items?: ProgramItem[]
  // Old flat format
  exercises?: Array<{ name: string; sets: number; reps: string; notes?: string }>
}

type ClientProgram = {
  id: string
  name: string
  start_date: string
  content: Array<{ id?: string; label?: string; days: ProgramDay[] }>
  status: string
}

type CalendarEvent = {
  id: string
  event_date: string
  type: string
  title: string
  content: Record<string, unknown>
}

type WorkoutForDate = {
  programId: string
  programName: string
  weekIdx: number
  dayIdx: number
  day: ProgramDay
  dateStr: string
  result: CalendarEvent | null
}

// Logged state per exercise: sets with actual weight/reps
type LoggedExercises = Record<string, Array<{ weight: string; reps: string }>>
type LoggedSections  = Record<string, string> // section id → score value
type LoggedVideos    = Record<string, string>  // exercise id → storage path
type LoggedNotes     = Record<string, string>  // exercise id → client note text

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function differenceInDays(a: Date, b: Date): number {
  const aUTC = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const bUTC = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((aUTC - bUTC) / 86400000)
}

function getWorkoutsForDate(
  programs: ClientProgram[],
  date: Date,
  results: CalendarEvent[]
): WorkoutForDate[] {
  const out: WorkoutForDate[] = []
  const dateStr = toDateStr(date)

  for (const prog of programs) {
    // Parse start_date using local time components to avoid UTC-midnight → local-yesterday shift
    const start = new Date(prog.start_date + 'T00:00:00')
    const dayOffset = differenceInDays(date, start)
    if (dayOffset < 0) continue
    const weekIdx = Math.floor(dayOffset / 7)
    const dayIdx = dayOffset % 7
    const week = prog.content[weekIdx]
    if (!week) continue
    const day = week.days?.[dayIdx]
    if (!day) continue
    const hasContent = (day.items?.length ?? 0) > 0 || (day.exercises?.length ?? 0) > 0
    if (!hasContent) continue
    // Match result by program+week+day only (event_date may differ if workout was moved)
    const result = results.find(
      (e) =>
        e.type === 'program_workout_result' &&
        (e.content as Record<string, unknown>).program_id === prog.id &&
        (e.content as Record<string, unknown>).week_index === weekIdx &&
        (e.content as Record<string, unknown>).day_index === dayIdx
    ) ?? null
    // If the result was moved to a different date, skip this scheduled date
    // — the workout will appear on the date it was actually done (handled below)
    if (result && result.event_date !== dateStr) continue
    out.push({ programId: prog.id, programName: prog.name, weekIdx, dayIdx, day, dateStr, result })
  }

  // Show any moved workout results that land on this date but were scheduled on a different date
  for (const evt of results) {
    if (evt.type !== 'program_workout_result' || evt.event_date !== dateStr) continue
    const c = evt.content as Record<string, unknown>
    const prog = programs.find((p) => p.id === c.program_id)
    if (!prog) continue
    const weekIdx = c.week_index as number
    const dayIdx  = c.day_index  as number
    const progStart = new Date(prog.start_date)
    progStart.setHours(0, 0, 0, 0)
    const scheduledDate = addDays(progStart, weekIdx * 7 + dayIdx)
    if (toDateStr(scheduledDate) === dateStr) continue // not moved, already handled above
    const week = prog.content[weekIdx]
    if (!week) continue
    const day = week.days?.[dayIdx]
    if (!day) continue
    out.push({ programId: prog.id, programName: prog.name, weekIdx, dayIdx, day, dateStr, result: evt })
  }

  return out
}

function eventColour(type: string): string {
  switch (type) {
    case 'workout':        return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'steps':          return 'bg-green-100 text-green-800 border-green-200'
    case 'note':           return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'personal':       return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'birthday':       return 'bg-pink-100 text-pink-800 border-pink-200'
    case 'travel':         return 'bg-sky-100 text-sky-800 border-sky-200'
    case 'extra_activity': return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    case 'autoflow':       return 'bg-indigo-100 text-indigo-800 border-indigo-200'
    default:               return 'bg-purple-100 text-purple-800 border-purple-200'
  }
}

const CLIENT_EVENT_TYPES = [
  { value: 'personal',       label: 'Personal / Social', icon: '🎉', placeholder: 'Birthday dinner, date night…' },
  { value: 'travel',         label: 'Travel / Away',     icon: '✈️', placeholder: 'Holiday, trip, going away…' },
  { value: 'extra_activity', label: 'Extra Activity',    icon: '🏃', placeholder: 'Walk, swim, bike ride…' },
  { value: 'note',           label: 'Note',              icon: '📝', placeholder: 'Anything else…' },
  { value: 'workout',        label: 'Log a Workout',     icon: '💪', placeholder: '' },
] as const
type ClientEventType = 'personal' | 'travel' | 'extra_activity' | 'note' | 'workout'

// ─── Score input ──────────────────────────────────────────────────────────────

function ScoreInput({ scoreType, value, onChange }: { scoreType: ScoreType; value: string; onChange: (v: string) => void }) {
  if (scoreType === 'none') return null
  if (scoreType === 'time') {
    const [mm, ss] = value.split(':')
    return (
      <div className="flex items-center gap-1.5">
        <input type="number" min={0} placeholder="00" value={mm ?? ''}
          onChange={(e) => onChange(`${e.target.value}:${ss ?? '00'}`)}
          className="w-14 border rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-indigo-400" />
        <span className="text-gray-400 font-bold">:</span>
        <input type="number" min={0} max={59} placeholder="00" value={ss ?? ''}
          onChange={(e) => onChange(`${mm ?? '0'}:${e.target.value}`)}
          className="w-14 border rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-indigo-400" />
        <span className="text-xs text-gray-400">min : sec</span>
      </div>
    )
  }
  if (scoreType === 'rounds') {
    const [r, rp] = value.split('+')
    return (
      <div className="flex items-center gap-1.5">
        <input type="number" min={0} placeholder="0" value={r ?? ''}
          onChange={(e) => onChange(`${e.target.value}+${rp ?? '0'}`)}
          className="w-14 border rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-indigo-400" />
        <span className="text-gray-400 font-bold">+</span>
        <input type="number" min={0} placeholder="0" value={rp ?? ''}
          onChange={(e) => onChange(`${r ?? '0'}+${e.target.value}`)}
          className="w-14 border rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-indigo-400" />
        <span className="text-xs text-gray-400">rounds + reps</span>
      </div>
    )
  }
  const units: Partial<Record<ScoreType, string>> = { reps: 'reps', weight: 'kg', distance: 'm', calories: 'cals' }
  return (
    <div className="flex items-center gap-2">
      <input type={scoreType === 'custom' ? 'text' : 'number'} min={0} value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={scoreType === 'custom' ? 'e.g. Rx, scaled…' : '0'}
        className="w-28 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400" />
      {units[scoreType] && <span className="text-xs text-gray-400">{units[scoreType]}</span>}
    </div>
  )
}

// ─── Video trim + upload ──────────────────────────────────────────────────────

function fmtTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function VideoTrimModal({ file, onConfirm, onCancel }: {
  file: File
  onConfirm: (blob: Blob | File, ext: string) => void
  onCancel: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [duration, setDuration] = useState(0)
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(0)
  const [trimming, setTrimming] = useState(false)
  const [progress, setProgress] = useState(0)
  const [trimError, setTrimError] = useState<string | null>(null)
  const objectUrl = useRef(URL.createObjectURL(file))

  useEffect(() => {
    return () => URL.revokeObjectURL(objectUrl.current)
  }, [])

  const canTrim = typeof MediaRecorder !== 'undefined' &&
    typeof (document.createElement('video') as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream === 'function'

  function onLoadedMetadata() {
    const d = videoRef.current!.duration
    setDuration(d)
    setEndTime(d)
    // Auto-play preview
    videoRef.current?.play().catch(() => {})
  }

  async function handleUpload() {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'mp4'

    // On iOS/Safari or if no trim needed — upload as-is
    if (!canTrim || (startTime <= 0.1 && endTime >= duration - 0.1)) {
      onConfirm(file, ext)
      return
    }

    setTrimming(true)
    setTrimError(null)
    setProgress(0)

    try {
      const videoEl = videoRef.current!
      videoEl.muted = true
      videoEl.pause()
      videoEl.currentTime = startTime
      await new Promise<void>(res => { videoEl.onseeked = () => res() })

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : null
      if (!mimeType) { onConfirm(file, ext); return }

      const stream = (videoEl as HTMLVideoElement & { captureStream: () => MediaStream }).captureStream()
      const recorder = new MediaRecorder(stream, { mimeType })
      const chunks: BlobPart[] = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }

      await new Promise<void>((resolve, reject) => {
        recorder.onstop = () => resolve()
        recorder.onerror = () => reject(new Error('Recording failed'))
        recorder.start(200)
        videoEl.play()
        function tick() {
          const elapsed = videoEl.currentTime - startTime
          const total = endTime - startTime
          setProgress(Math.min(99, Math.round((elapsed / total) * 100)))
          if (videoEl.currentTime >= endTime) { recorder.stop(); videoEl.pause() }
          else requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      })

      setProgress(100)
      onConfirm(new Blob(chunks, { type: mimeType }), 'webm')
    } catch (err) {
      setTrimError(err instanceof Error ? err.message : 'Trim failed')
      setTrimming(false)
    }
  }

  const startPct = duration > 0 ? (startTime / duration) * 100 : 0
  const endPct = duration > 0 ? (endTime / duration) * 100 : 100
  const trimDuration = endTime - startTime

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/70">
        <button type="button" onClick={onCancel} className="text-white/70 hover:text-white font-medium text-sm px-2 py-1">
          Cancel
        </button>
        <p className="text-white font-semibold text-sm">Trim &amp; Upload</p>
        <button
          type="button"
          onClick={handleUpload}
          disabled={trimming || duration === 0}
          className="text-indigo-400 font-semibold text-sm px-2 py-1 disabled:opacity-40"
        >
          {trimming ? `${progress}%` : 'Upload'}
        </button>
      </div>

      {/* Video */}
      <div className="flex-1 flex items-center justify-center bg-black p-2 min-h-0">
        <video
          ref={videoRef}
          src={objectUrl.current}
          onLoadedMetadata={onLoadedMetadata}
          playsInline
          controls
          className="max-h-full max-w-full rounded-xl"
        />
      </div>

      {/* Trim controls */}
      <div className="bg-gray-900 px-5 pt-4 pb-8 space-y-3">
        {duration > 0 ? (
          <>
            {/* Timeline bar */}
            <div className="relative h-2.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="absolute h-full bg-indigo-500 rounded-full"
                style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
              />
            </div>

            <div className="flex justify-between text-xs text-white/50">
              <span>{fmtTime(startTime)}</span>
              <span className="text-indigo-400 font-semibold">{fmtTime(trimDuration)} selected</span>
              <span>{fmtTime(endTime)}</span>
            </div>

            {/* Start slider */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/50 w-10 flex-shrink-0">Start</span>
              <input type="range" min={0} max={duration} step={0.1} value={startTime}
                onChange={e => {
                  const v = Math.min(Number(e.target.value), endTime - 0.5)
                  setStartTime(v)
                  if (videoRef.current) videoRef.current.currentTime = v
                }}
                className="flex-1 accent-indigo-500"
              />
            </div>

            {/* End slider */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/50 w-10 flex-shrink-0">End</span>
              <input type="range" min={0} max={duration} step={0.1} value={endTime}
                onChange={e => {
                  const v = Math.max(Number(e.target.value), startTime + 0.5)
                  setEndTime(v)
                  if (videoRef.current) videoRef.current.currentTime = v
                }}
                className="flex-1 accent-indigo-500"
              />
            </div>

            {trimError && <p className="text-xs text-red-400 bg-red-900/30 rounded-lg px-3 py-2">{trimError}</p>}
            {!canTrim && (
              <p className="text-[11px] text-white/30 text-center">Trimming not supported on this browser — full video will upload</p>
            )}
          </>
        ) : (
          <p className="text-xs text-white/40 text-center py-2">Loading video…</p>
        )}
      </div>
    </div>
  )
}

function VideoUploadButton({ videoPath, onUploaded }: {
  videoPath?: string
  onUploaded: (path: string) => void
}) {
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 500 * 1024 * 1024) { setUploadError('Video must be under 500 MB'); return }
    setUploadError(null)
    e.target.value = ''
    setPendingFile(file)
  }

  async function handleConfirm(blob: Blob | File, ext: string) {
    setPendingFile(null)
    setUploading(true)
    setUploadError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploadError('Not signed in'); setUploading(false); return }
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('workout-videos').upload(path, blob, { contentType: blob instanceof File ? blob.type : `video/${ext}` })
    if (error) { setUploadError(error.message); setUploading(false); return }
    onUploaded(path)
    setUploading(false)
  }

  return (
    <div className="mt-2">
      {pendingFile && (
        <VideoTrimModal
          file={pendingFile}
          onConfirm={handleConfirm}
          onCancel={() => setPendingFile(null)}
        />
      )}
      <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={handleFileSelected} />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
          videoPath
            ? 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100'
            : 'border-indigo-200 text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
        } disabled:opacity-50`}
      >
        {uploading ? (
          <>
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Uploading…
          </>
        ) : videoPath ? (
          <>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Video uploaded · Replace
          </>
        ) : (
          <>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.89L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            Upload video
          </>
        )}
      </button>
      {uploadError && <p className="text-[10px] text-red-500 mt-1">{uploadError}</p>}
    </div>
  )
}

function VideoPlayer({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/workouts/video-url?path=${encodeURIComponent(path)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((j) => { if (j?.url) setUrl(j.url) })
      .finally(() => setLoading(false))
  }, [path])

  if (loading) return <div className="h-10 flex items-center text-xs text-gray-400">Loading video…</div>
  if (!url) return <div className="text-xs text-red-400">Could not load video</div>
  return (
    <video src={url} controls playsInline className="w-full rounded-lg mt-2 max-h-48 bg-black" />
  )
}

// ─── Workout modal ─────────────────────────────────────────────────────────────

function WorkoutModal({ workout, onClose, onSaved, onMoved }: {
  workout: WorkoutForDate
  onClose: () => void
  onSaved: (result: CalendarEvent) => void
  onMoved?: (updated: CalendarEvent) => void
}) {
  const [logging, setLogging] = useState(!workout.result)
  const [sectionScores, setSectionScores] = useState<LoggedSections>(() => {
    if (workout.result) {
      const saved = (workout.result.content.sections ?? []) as Array<{ id: string; scoreValue: string }>
      return Object.fromEntries(saved.map((s) => [s.id, s.scoreValue ?? '']))
    }
    return {}
  })
  const [exSets, setExSets] = useState<LoggedExercises>(() => {
    if (workout.result) {
      const saved = (workout.result.content.exercises ?? []) as Array<{ id: string; sets: Array<{ weight: string; reps: string }> }>
      return Object.fromEntries(saved.map((e) => [e.id, e.sets ?? []]))
    }
    return {}
  })
  const [exVideos, setExVideos] = useState<LoggedVideos>(() => {
    if (workout.result) {
      const saved = (workout.result.content.exercises ?? []) as Array<{ id: string; videoPath?: string }>
      return Object.fromEntries(saved.filter((e) => e.videoPath).map((e) => [e.id, e.videoPath!]))
    }
    return {}
  })
  const [exNotes, setExNotes] = useState<LoggedNotes>(() => {
    if (workout.result) {
      const saved = (workout.result.content.exercises ?? []) as Array<{ id: string; clientNote?: string }>
      return Object.fromEntries(saved.filter((e) => e.clientNote).map((e) => [e.id, e.clientNote!]))
    }
    return {}
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showMove, setShowMove] = useState(false)
  const [moveDate, setMoveDate] = useState(workout.result?.event_date ?? workout.dateStr)
  const [moving, setMoving] = useState(false)
  const [restCountdown, setRestCountdown] = useState<number | null>(null)
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [completedSets, setCompletedSets] = useState<Set<string>>(new Set())

  function startRest(seconds: number) {
    if (seconds <= 0) return
    if (restTimerRef.current) clearInterval(restTimerRef.current)
    setRestCountdown(seconds)
    restTimerRef.current = setInterval(() => {
      setRestCountdown(prev => {
        if (prev === null || prev <= 1) { if (restTimerRef.current) clearInterval(restTimerRef.current); return null }
        return prev - 1
      })
    }, 1000)
  }

  function skipRest() {
    if (restTimerRef.current) clearInterval(restTimerRef.current)
    setRestCountdown(null)
  }

  useEffect(() => () => { if (restTimerRef.current) clearInterval(restTimerRef.current) }, [])

  function toggleSetDone(key: string, restSecs?: string) {
    setCompletedSets(prev => {
      const next = new Set(prev)
      if (next.has(key)) { next.delete(key); skipRest() }
      else {
        next.add(key)
        const r = parseInt(restSecs ?? '0') || 0
        if (r > 0) startRest(r)
      }
      return next
    })
  }
  const [moveError, setMoveError] = useState<string | null>(null)

  const items = workout.day.items ?? []

  // Build initial exercise sets from program targets if not pre-filled
  function getExSets(ex: ProgramItem): Array<{ weight: string; reps: string }> {
    if (exSets[ex.id]) return exSets[ex.id]
    return (ex.sets ?? []).map((s) => ({ weight: '', reps: s.reps ?? '' }))
  }

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      const sections = items
        .filter((i) => i.type === 'section' && i.scoreType && i.scoreType !== 'none')
        .map((i) => ({ id: i.id, title: i.title, scoreType: i.scoreType, scoreValue: sectionScores[i.id] ?? '' }))

      const exercises = items
        .filter((i) => i.type === 'exercise')
        .map((i) => ({
          id: i.id,
          name: i.name,
          sets: exSets[i.id] ?? getExSets(i),
          ...(exVideos[i.id] ? { videoPath: exVideos[i.id] } : {}),
          ...(exNotes[i.id]?.trim() ? { clientNote: exNotes[i.id].trim() } : {}),
        }))

      const res = await fetch('/api/workouts/program-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_id: workout.programId,
          program_name: workout.programName,
          week_index: workout.weekIdx,
          day_index: workout.dayIdx,
          event_date: workout.dateStr,
          day_name: workout.day.name ?? `Day ${workout.dayIdx + 1}`,
          sections,
          exercises,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const saved = await res.json()
      onSaved(saved)
      setLogging(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleMove() {
    if (!moveDate || !workout.result || moveDate === workout.result.event_date) return
    setMoving(true); setMoveError(null)
    try {
      const res = await fetch(`/api/client/calendar/${workout.result.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_date: moveDate }),
      })
      if (!res.ok) throw new Error(await res.text())
      const updated = await res.json()
      onMoved?.(updated)
      setShowMove(false)
    } catch (e) {
      setMoveError(e instanceof Error ? e.message : 'Failed to move workout')
    } finally {
      setMoving(false)
    }
  }

  const scoredSections = items.filter((i) => i.type === 'section' && i.scoreType && i.scoreType !== 'none')
  const hasAnyScore = scoredSections.length > 0

  return (
    <>
    {/* Rest countdown */}
    {restCountdown !== null && (
      <div className="fixed bottom-24 left-0 right-0 z-[60] flex justify-center px-4 pointer-events-none">
        <div className="bg-orange-500 text-white rounded-2xl px-5 py-4 shadow-2xl flex items-center gap-4 max-w-sm w-full pointer-events-auto">
          <div className="w-14 h-14 rounded-full bg-orange-600 flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-bold tabular-nums">{restCountdown}</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Rest time</p>
            <p className="text-xs text-orange-100">Next set in {restCountdown}s</p>
          </div>
          <button onClick={skipRest} className="text-white/80 hover:text-white text-xs font-semibold bg-orange-600 px-3 py-1.5 rounded-lg">Skip</button>
        </div>
      </div>
    )}

    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full sm:rounded-2xl shadow-2xl sm:max-w-lg max-h-[90vh] flex flex-col rounded-t-2xl" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b">
          <div>
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">{workout.programName}</p>
            <h2 className="text-base font-bold text-gray-900 mt-0.5">{workout.day.name ?? `Day ${workout.dayIdx + 1}`}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{new Date(workout.dateStr + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-0.5">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {workout.result && (
            <div className="flex items-center gap-1.5 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
              <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-xs font-semibold text-green-700">
                Completed {new Date(workout.result.event_date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
            </div>
          )}
          {items.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No exercises scheduled.</p>
          )}

          {items.map((item) => {
            if (item.type === 'section') {
              const hasScore = item.scoreType && item.scoreType !== 'none'
              return (
                <div key={item.id} className="bg-indigo-50 rounded-xl px-4 py-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">{item.title}</span>
                    {hasScore && (
                      <span className="text-[10px] font-semibold bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase">{item.scoreType}</span>
                    )}
                  </div>
                  {item.notes && (
                    <p className="text-xs text-indigo-800 whitespace-pre-line leading-relaxed">{item.notes}</p>
                  )}
                  {hasScore && (
                    <div className="pt-1">
                      {logging ? (
                        <ScoreInput
                          scoreType={item.scoreType as ScoreType}
                          value={sectionScores[item.id] ?? ''}
                          onChange={(v) => setSectionScores((prev) => ({ ...prev, [item.id]: v }))}
                        />
                      ) : workout.result ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Score:</span>
                          <span className="text-sm font-bold text-indigo-700">
                            {(workout.result.content.sections as Array<{ id: string; scoreValue: string }>)?.find((s) => s.id === item.id)?.scoreValue || '—'}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )
            }

            // Exercise
            const sets = getExSets(item)
            const savedResult = workout.result
              ? ((workout.result.content.exercises ?? []) as Array<{ id: string; coachNote?: string; videoPath?: string; clientNote?: string }>).find((e) => e.id === item.id)
              : null
            return (
              <div key={item.id} className="border border-gray-100 rounded-xl px-4 py-3 space-y-2">
                <p className="text-sm font-semibold text-gray-800">{item.name}</p>
                {item.notes && <p className="text-xs text-gray-400">{item.notes}</p>}
                <div className="text-xs text-gray-400">
                  Target: {item.sets?.length ?? 0} sets × {item.sets?.[0]?.reps ?? '—'}
                </div>

                {/* Logged sets */}
                {(logging || workout.result) && (
                  <div className="space-y-1.5 pt-1">
                    {sets.map((s, si) => {
                      const setKey = `${item.id}-${si}`
                      const done = completedSets.has(setKey)
                      const restSecs = item.sets?.[si]?.rest
                      return (
                      <div key={si} className={`space-y-1 ${done ? 'opacity-60' : ''}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-8">Set {si + 1}</span>
                        {logging ? (
                          <>
                            <input type="number" inputMode="decimal" value={s.weight} placeholder="kg"
                              onChange={(e) => setExSets((prev) => {
                                const copy = [...(prev[item.id] ?? sets)]
                                copy[si] = { ...copy[si], weight: e.target.value }
                                return { ...prev, [item.id]: copy }
                              })}
                              disabled={done}
                              className="w-16 border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300 disabled:bg-gray-50" />
                            <span className="text-xs text-gray-300">×</span>
                            <input type="number" inputMode="numeric" value={s.reps} placeholder="reps"
                              onChange={(e) => setExSets((prev) => {
                                const copy = [...(prev[item.id] ?? sets)]
                                copy[si] = { ...copy[si], reps: e.target.value }
                                return { ...prev, [item.id]: copy }
                              })}
                              disabled={done}
                              className="w-14 border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300 disabled:bg-gray-50" />
                            {restSecs && <span className="text-[10px] text-orange-500 font-medium ml-1">⏱ {restSecs}s</span>}
                            <button
                              type="button"
                              onClick={() => toggleSetDone(setKey, restSecs)}
                              className={`ml-auto w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${done ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 text-transparent hover:border-green-400'}`}
                            >✓</button>
                          </>
                        ) : (
                          <span className="text-xs text-gray-600">{s.weight ? `${s.weight} kg × ` : ''}{s.reps} reps{restSecs ? ` — rest ${restSecs}s` : ''}</span>
                        )}
                      </div>
                      </div>
                    )})}
                  </div>
                )}

                {/* Exercise history — shown while logging so client can reference previous performance */}
                {logging && <ExerciseHistoryPanel exerciseId={item.id} />}

                {/* Video + notes — logging mode */}
                {logging && (
                  <div className="pt-1 space-y-2 border-t border-gray-50 mt-2">
                    <VideoUploadButton
                      videoPath={exVideos[item.id]}
                      onUploaded={(path) => setExVideos((prev) => ({ ...prev, [item.id]: path }))}
                    />
                    <textarea
                      value={exNotes[item.id] ?? ''}
                      onChange={(e) => setExNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      placeholder="Add a note (e.g. how it felt, any issues…)"
                      rows={2}
                      className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-300 placeholder:text-gray-300"
                    />
                  </div>
                )}

                {/* Video + notes — result view mode */}
                {!logging && workout.result && (
                  <div className="space-y-2">
                    {(savedResult?.videoPath || exVideos[item.id]) && (
                      <VideoPlayer path={savedResult?.videoPath ?? exVideos[item.id]} />
                    )}
                    {savedResult?.clientNote && (
                      <div className="bg-gray-50 rounded-lg px-3 py-2">
                        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Your note</p>
                        <p className="text-xs text-gray-600">{savedResult.clientNote}</p>
                      </div>
                    )}
                    {savedResult?.coachNote && (
                      <div className="rounded-lg px-3 py-2" style={{ backgroundColor: 'rgba(29,158,117,0.06)' }}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#1D9E75' }}>Coach feedback</p>
                        <p className="text-xs text-gray-700">{savedResult.coachNote}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t space-y-3">
          {error && <p className="text-xs text-red-500">{error}</p>}
          {logging ? (
            <div className="flex gap-3">
              {workout.result && (
                <button onClick={() => setLogging(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">
                  Cancel
                </button>
              )}
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : workout.result ? 'Update Workout' : 'Save Workout'}
              </button>
            </div>
          ) : workout.result ? (
            <div className="space-y-2.5">
              <div className="flex gap-2">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span className="text-sm font-semibold text-green-700 whitespace-nowrap">Logged</span>
                  {workout.result.event_date !== workout.dateStr && (
                    <span className="text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap">
                      Moved · {new Date(workout.result.event_date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => { setShowMove((v) => !v); setMoveDate(workout.result!.event_date) }}
                  className="border border-gray-200 text-gray-500 px-3 py-2 rounded-xl text-xs font-medium hover:bg-gray-50 transition-colors flex-shrink-0"
                  title="Move to another day"
                >
                  Move
                </button>
                <button onClick={() => setLogging(true)} className="border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-50 flex-shrink-0">
                  Edit
                </button>
              </div>

              {showMove && (
                <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-2 border border-gray-100">
                  <p className="text-xs font-semibold text-gray-600">Move to a different day</p>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={moveDate}
                      onChange={(e) => setMoveDate(e.target.value)}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    />
                    <button
                      onClick={handleMove}
                      disabled={moving || !moveDate || moveDate === workout.result.event_date}
                      className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                    >
                      {moving ? '…' : 'Move'}
                    </button>
                  </div>
                  {moveError && <p className="text-xs text-red-500">{moveError}</p>}
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => setLogging(true)}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">
              Start Workout
            </button>
          )}
        </div>
      </div>
    </div>
    </>
  )
}

// ─── Add Event Modal ──────────────────────────────────────────────────────────

function AddEventModal({ dateStr, onClose, onCreated, onStartWorkout }: {
  dateStr: string
  onClose: () => void
  onCreated: (event: CalendarEvent | CalendarEvent[]) => void
  onStartWorkout?: () => void
}) {
  const [type, setType] = useState<ClientEventType>('personal')
  const [title, setTitle] = useState('')
  const [endDate, setEndDate] = useState(dateStr)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const displayDate = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  // Reset end date when switching away from travel
  function handleTypeChange(t: ClientEventType) {
    setType(t)
    if (t !== 'travel') setEndDate(dateStr)
  }

  const isTravel = type === 'travel'
  const durationDays = isTravel && endDate >= dateStr
    ? Math.round((new Date(endDate + 'T00:00:00').getTime() - new Date(dateStr + 'T00:00:00').getTime()) / 86400000) + 1
    : 1

  async function handleSave() {
    if (!title.trim()) { setError('Please add a title'); return }
    if (isTravel && endDate < dateStr) { setError('End date must be on or after start date'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/client/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_date: dateStr,
          end_date: isTravel && endDate > dateStr ? endDate : undefined,
          type,
          title: title.trim(),
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      onCreated(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const placeholder = CLIENT_EVENT_TYPES.find((t) => t.value === type)?.placeholder ?? 'Add a title…'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full sm:rounded-2xl shadow-2xl sm:max-w-sm rounded-t-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b">
          <div>
            <p className="text-base font-bold text-gray-900">Add event</p>
            <p className="text-xs text-gray-400 mt-0.5">{displayDate}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {CLIENT_EVENT_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => handleTypeChange(t.value)}
                className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  t.value === 'workout' ? 'col-span-2' : ''
                } ${
                  type === t.value ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-base leading-none mb-1">{t.icon}</div>
                <p className="text-[11px] font-semibold text-gray-800">{t.label}</p>
                {t.placeholder && <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{t.placeholder}</p>}
              </button>
            ))}
          </div>

          {/* Date range — only for travel */}
          {isTravel && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 block">Duration</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Start</p>
                  <input
                    type="date"
                    value={dateStr}
                    disabled
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 text-gray-500"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">End</p>
                  <input
                    type="date"
                    value={endDate}
                    min={dateStr}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
              </div>
              {durationDays > 1 && (
                <p className="text-xs text-teal-600 font-medium">{durationDays} days away</p>
              )}
            </div>
          )}

          {type !== 'workout' && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={placeholder}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                autoFocus
              />
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="px-5 pb-5">
          {type === 'workout' ? (
            <button
              type="button"
              onClick={() => { onClose(); onStartWorkout?.() }}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Start Workout
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {saving ? 'Adding…' : 'Add event'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Day Detail Sheet ─────────────────────────────────────────────────────────

function DayDetailSheet({ date, workouts, events, onClose, onWorkoutTap, onAddEvent, onDeleteEvent, onOwnWorkoutTap }: {
  date: Date
  workouts: WorkoutForDate[]
  events: CalendarEvent[]
  onClose: () => void
  onWorkoutTap: (w: WorkoutForDate) => void
  onAddEvent: (dateStr: string) => void
  onDeleteEvent: (id: string) => void
  onOwnWorkoutTap?: (ev: CalendarEvent) => void
}) {
  const dateStr = toDateStr(date)
  const displayDate = date.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })
  const visibleEvents = events.filter((e) => e.type !== 'program_workout_result')

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white w-full sm:rounded-2xl shadow-2xl sm:max-w-sm rounded-t-2xl overflow-hidden max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b flex-shrink-0">
          <div>
            <p className="text-base font-bold text-gray-900">{displayDate}</p>
            {workouts.length === 0 && visibleEvents.length === 0 && (
              <p className="text-xs text-gray-400 mt-0.5">Rest day</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {/* Workouts */}
          {workouts.map((w, i) => {
            const sections = (w.day.items ?? []).filter((it) => it.type === 'section' && it.title?.trim())
            const exCount = (w.day.items ?? []).filter((it) => it.type === 'exercise').length
            return (
              <button
                key={i}
                onClick={() => { onClose(); onWorkoutTap(w) }}
                className={`w-full text-left rounded-xl border px-4 py-3 transition-colors hover:opacity-90 active:scale-[0.98] ${
                  w.result ? 'bg-green-50 border-green-200' : 'bg-indigo-50 border-indigo-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-indigo-900 truncate">{w.day.name ?? w.programName}</p>
                    <p className="text-xs text-indigo-500 mt-0.5">
                      {sections.length > 0 ? sections.map((s) => s.title).join(' · ') : `${exCount} exercise${exCount !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  {w.result ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-green-600 flex-shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      Done
                    </span>
                  ) : (
                    <svg className="w-4 h-4 text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              </button>
            )
          })}

          {/* Events */}
          {visibleEvents.map((ev) => {
            const isClientEvent = ['personal', 'travel', 'extra_activity', 'note'].includes(ev.type)
            const autoflowLink = ev.type === 'autoflow' ? (ev.content as Record<string, unknown>)?.link as string | undefined : undefined
            const eventIcons: Record<string, string> = {
              personal: '🎉', travel: '✈️', extra_activity: '🏃', note: '📝',
              birthday: '🎂', autoflow: '📋', workout: '💪',
            }
            const icon = eventIcons[ev.type] ?? '📌'

            if (ev.type === 'workout') {
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => { onClose(); onOwnWorkoutTap?.(ev) }}
                  className="w-full text-left rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 hover:bg-blue-100 transition-colors active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base flex-shrink-0">💪</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-blue-900 truncate">{ev.title}</p>
                      <p className="text-xs text-blue-600 mt-0.5">Tap to view or edit</p>
                    </div>
                    <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              )
            }

            const inner = (
              <div className="flex items-center gap-3">
                <span className="text-base flex-shrink-0">{icon}</span>
                <p className="text-sm text-gray-800 flex-1 truncate">{ev.title}</p>
                {isClientEvent && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDeleteEvent(ev.id) }}
                    className="flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors"
                    title="Remove"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )

            return autoflowLink ? (
              <a key={ev.id} href={autoflowLink} className="block rounded-xl border border-gray-200 bg-white px-4 py-3 hover:bg-gray-50 transition-colors">
                {inner}
              </a>
            ) : (
              <div key={ev.id} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                {inner}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t flex-shrink-0">
          <button
            type="button"
            onClick={() => { onClose(); onAddEvent(dateStr) }}
            className="w-full py-2.5 border-2 border-dashed border-gray-200 text-gray-400 text-sm font-medium rounded-xl hover:border-indigo-300 hover:text-indigo-500 transition-colors"
          >
            + Add event
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Day Cell ─────────────────────────────────────────────────────────────────

function DayCell({ date, workouts, events, isToday, isPast, compact, onWorkoutTap, onAddEvent, onDeleteEvent, onDayTap, onOwnWorkoutTap }: {
  date: Date
  workouts: WorkoutForDate[]
  events: CalendarEvent[]
  isToday: boolean
  isPast: boolean
  compact?: boolean
  onWorkoutTap: (w: WorkoutForDate) => void
  onAddEvent?: (dateStr: string) => void
  onDeleteEvent?: (id: string) => void
  onDayTap?: (dateStr: string) => void
  onOwnWorkoutTap?: (ev: CalendarEvent) => void
}) {
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const dayNameIndex = date.getDay() === 0 ? 6 : date.getDay() - 1

  return (
    <div className={[
      'rounded-xl border p-3 flex flex-col gap-2 transition-all',
      compact ? 'min-h-[100px]' : 'min-h-[120px]',
      isToday ? 'border-blue-400 bg-blue-50/60 shadow-sm' : 'border-gray-200 bg-white',
      isPast && !isToday ? 'opacity-60' : '',
    ].join(' ')}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-gray-400'}`}>
          {dayNames[dayNameIndex]}
        </span>
        <div className="flex items-center gap-1">
          {onAddEvent && (
            <button
              type="button"
              onClick={() => onAddEvent(toDateStr(date))}
              className="w-5 h-5 flex items-center justify-center rounded-full text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
              title="Add event"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={() => onDayTap?.(toDateStr(date))}
            title="View day"
            className={[
              'w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold transition-all',
              isToday ? 'bg-blue-500 text-white hover:bg-blue-600' : 'text-gray-700 hover:bg-gray-100',
            ].join(' ')}
          >
            {date.getDate()}
          </button>
        </div>
      </div>

      {/* Program workouts */}
      <div className="flex flex-col gap-1.5 flex-1">
        {workouts.map((w, i) => {
          const sections = (w.day.items ?? []).filter((it) => it.type === 'section' && it.title?.trim())
          const exCount = (w.day.items ?? []).filter((it) => it.type === 'exercise').length

          return (
            <button key={i} onClick={() => onWorkoutTap(w)}
              className={`w-full text-left rounded-lg px-2 py-1.5 transition-colors hover:opacity-90 active:scale-95 ${
                w.result ? 'bg-green-100 border border-green-200' : 'bg-indigo-100 border border-indigo-200'
              }`}>
              <div className="flex items-start justify-between gap-1">
                <p className="text-[11px] font-bold text-indigo-800 truncate leading-tight flex-1">
                  {w.day.name ?? w.programName}
                </p>
                {w.result && (
                  <svg className="w-3 h-3 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              {w.result ? (
                <p className="text-[10px] text-green-700 font-medium truncate">
                  Done {new Date(w.result.event_date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                </p>
              ) : sections.length > 0 ? (
                <p className="text-[10px] text-indigo-600 truncate">{sections.map((s) => s.title).join(' · ')}</p>
              ) : (
                <p className="text-[10px] text-indigo-600">{exCount} exercise{exCount !== 1 ? 's' : ''}</p>
              )}
            </button>
          )
        })}

        {/* Other events */}
        {events.filter((e) => e.type !== 'program_workout_result').map((ev) => {
          const isClientEvent = ['personal', 'travel', 'extra_activity', 'note'].includes(ev.type)
          const cls = `rounded-lg border px-2 py-1 text-[10px] font-medium flex items-center gap-1 ${eventColour(ev.type)}`
          const autoflowLink = ev.type === 'autoflow' ? (ev.content as Record<string, unknown>)?.link as string | undefined : undefined
          if (autoflowLink) {
            return (
              <a key={ev.id} href={autoflowLink} className={cls} onClick={(e) => e.stopPropagation()}>
                <span className="truncate flex-1">{ev.title}</span>
              </a>
            )
          }
          if (ev.type === 'workout') {
            return (
              <button key={ev.id} type="button" onClick={(e) => { e.stopPropagation(); onOwnWorkoutTap?.(ev) }} className={`${cls} w-full text-left`}>
                <span className="truncate flex-1">💪 {ev.title}</span>
              </button>
            )
          }
          return (
            <div key={ev.id} className={cls}>
              <span className="truncate flex-1">{ev.type === 'birthday' ? '🎂 ' : ''}{ev.title}</span>
              {isClientEvent && onDeleteEvent && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDeleteEvent(ev.id) }}
                  className="flex-shrink-0 opacity-40 hover:opacity-100 transition-opacity"
                  title="Remove"
                >
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )
        })}

        {workouts.length === 0 && events.filter((e) => e.type !== 'program_workout_result').length === 0 && (
          <span className="text-xs text-gray-300 italic mt-1 self-center">Rest</span>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TrainingCalendar() {
  const searchParams = useSearchParams()
  const deepLinkEventId = searchParams.get('event')

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()))
  const [programs, setPrograms] = useState<ClientProgram[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewingWorkout, setViewingWorkout] = useState<WorkoutForDate | null>(null)
  const [addingEventDate, setAddingEventDate] = useState<string | null>(null)
  const [addingWorkoutDate, setAddingWorkoutDate] = useState<string | null>(null)
  const [viewingDay, setViewingDay] = useState<string | null>(null)
  const [editingOwnWorkout, setEditingOwnWorkout] = useState<{ eventId: string; workoutId: string; title: string } | null>(null)
  const deepLinkHandled = useRef(false)

  const weekEnd = addDays(weekStart, 6)

  const fetchData = useCallback(async (wStart: Date, wEnd: Date) => {
    setLoading(true); setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const startStr = toDateStr(wStart)
      const endStr = toDateStr(wEnd)

      const [programsResult, eventsResult, activeFlowsResult, responsesResult] = await Promise.all([
        supabase
          .from('client_programs')
          .select('id, name, start_date, content, status')
          .eq('client_id', user.id)
          .in('status', ['active', 'completed']),
        supabase
          .from('calendar_events')
          .select('*')
          .eq('client_id', user.id)
          .gte('event_date', startStr)
          .lte('event_date', endStr),
        supabase
          .from('client_autoflows')
          .select('id')
          .eq('client_id', user.id)
          .eq('status', 'active'),
        supabase
          .from('autoflow_responses')
          .select('client_autoflow_id, step_number')
          .eq('client_id', user.id),
      ])

      const activeFlowIds = new Set((activeFlowsResult.data ?? []).map((f: { id: string }) => f.id))
      const completedStepKeys = new Set(
        (responsesResult.data ?? []).map((r: { client_autoflow_id: string; step_number: number }) =>
          `${r.client_autoflow_id}:${r.step_number}`
        )
      )
      const allEvents = eventsResult.data ?? []
      const filteredEvents = allEvents.filter((e: { type: string; content: Record<string, unknown> }) => {
        if (e.type !== 'autoflow') return true
        const flowId = e.content?.flow_id as string | undefined
        const stepNumber = e.content?.step_number as number | undefined
        if (!flowId || !activeFlowIds.has(flowId)) return false
        // Hide steps that have already been responded to
        if (stepNumber != null && completedStepKeys.has(`${flowId}:${stepNumber}`)) return false
        return true
      })

      setPrograms(programsResult.data ?? [])
      setEvents(filteredEvents)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(weekStart, weekEnd)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart])

  // Phase 1: when deep link present on mount, jump calendar to the correct week
  useEffect(() => {
    if (!deepLinkEventId) return
    const supabase = createClient()
    supabase
      .from('calendar_events')
      .select('event_date')
      .eq('id', deepLinkEventId)
      .single()
      .then(({ data }) => {
        if (data?.event_date) {
          const [y, m, d] = (data.event_date as string).split('-').map(Number)
          setWeekStart(startOfWeek(new Date(y, m - 1, d)))
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkEventId])

  // Phase 2: once data for the correct week is loaded, open the workout modal
  useEffect(() => {
    if (!deepLinkEventId || deepLinkHandled.current || loading) return
    const targetEvent = events.find((e) => e.id === deepLinkEventId)
    if (!targetEvent) return
    deepLinkHandled.current = true

    // Mark feedback as seen immediately — regardless of whether the modal opens.
    // The banner must clear even if the program is archived or not found.
    const c = targetEvent.content as Record<string, unknown>
    if (c.feedback_left_at) {
      fetch(`/api/client/calendar/${deepLinkEventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback_seen: true }),
      }).catch(() => {/* silent */})
    }

    const progId  = c.program_id as string | undefined
    const weekIdx = c.week_index as number | undefined
    const dayIdx  = c.day_index  as number | undefined

    const prog = programs.find((p) => p.id === progId)
    if (!prog || weekIdx === undefined || dayIdx === undefined) return

    const week = prog.content[weekIdx]
    const day  = week?.days?.[dayIdx]
    if (!day) return

    setViewingWorkout({
      programId: prog.id,
      programName: prog.name,
      weekIdx,
      dayIdx,
      day,
      dateStr: targetEvent.event_date,
      result: targetEvent,
    })
  }, [deepLinkEventId, loading, events, programs])

  const goToPrevWeek = () => setWeekStart((d) => addDays(d, -7))
  const goToNextWeek = () => setWeekStart((d) => addDays(d, 7))
  const goToThisWeek = () => setWeekStart(startOfWeek(new Date()))

  const datePickerRef = useRef<HTMLInputElement>(null)
  function handleDatePickerChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.value) return
    const [y, m, d] = e.target.value.split('-').map(Number)
    setWeekStart(startOfWeek(new Date(y, m - 1, d)))
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const monthLabel = weekStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const isCurrentWeek = toDateStr(weekStart) === toDateStr(startOfWeek(new Date()))

  function handleSaved(result: CalendarEvent) {
    setEvents((prev) => [...prev.filter((e) => e.id !== result.id), result])
    if (viewingWorkout) {
      setViewingWorkout({ ...viewingWorkout, result })
    }
  }

  function handleWorkoutMoved(updated: CalendarEvent) {
    setEvents((prev) => [...prev.filter((e) => e.id !== updated.id), updated])
    if (viewingWorkout?.result?.id === updated.id) {
      setViewingWorkout({ ...viewingWorkout, result: updated })
    }
  }

  function handleEventCreated(event: CalendarEvent | CalendarEvent[]) {
    const created = Array.isArray(event) ? event : [event]
    setEvents((prev) => [...prev, ...created])
    setAddingEventDate(null)
  }

  async function handleDeleteEvent(id: string) {
    const res = await fetch(`/api/client/calendar/${id}`, { method: 'DELETE' })
    if (res.ok) setEvents((prev) => prev.filter((e) => e.id !== id))
  }

  function handleOwnWorkoutTap(ev: CalendarEvent) {
    const workoutId = (ev.content as Record<string, unknown>)?.workout_id as string | undefined
    if (!workoutId) return
    setEditingOwnWorkout({ eventId: ev.id, workoutId, title: ev.title })
  }

  async function handleWorkoutFinished(workoutId?: string, workoutName?: string) {
    if (addingWorkoutDate) {
      try {
        const res = await fetch('/api/client/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_date: addingWorkoutDate,
            type: 'workout',
            title: workoutName || 'Workout',
            content: workoutId ? { workout_id: workoutId } : {},
          }),
        })
        if (res.ok) {
          const created = await res.json()
          const newEvents = Array.isArray(created) ? created : [created]
          setEvents((prev) => [...prev, ...newEvents])
        }
      } catch { /* calendar event is best-effort */ }
    }
    setAddingWorkoutDate(null)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-gray-900">Training Calendar</h2>
          <button
            onClick={() => datePickerRef.current?.showPicker()}
            className="text-sm text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
            title="Jump to date"
          >
            {monthLabel}
          </button>
          <input
            ref={datePickerRef}
            type="date"
            className="sr-only"
            value={toDateStr(weekStart)}
            onChange={handleDatePickerChange}
          />
        </div>
        <div className="flex items-center gap-1">
          {!isCurrentWeek && (
            <button onClick={goToThisWeek} className="text-xs px-2.5 py-1 rounded-lg text-blue-600 hover:bg-blue-50 font-medium transition-colors">
              Today
            </button>
          )}
          <button onClick={goToPrevWeek} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" aria-label="Previous week">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={goToNextWeek} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" aria-label="Next week">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        {error && <div className="text-sm text-red-500 text-center py-6">{error}</div>}

        {loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 min-h-[120px] animate-pulse" />
            ))}
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="hidden md:grid md:grid-cols-7 gap-3">
              {weekDays.map((date) => {
                const dateStr = toDateStr(date)
                const dayWorkouts = getWorkoutsForDate(programs, date, events)
                const dayEvents = events.filter((e) => e.event_date === dateStr)
                return (
                  <DayCell key={dateStr} date={date} workouts={dayWorkouts} events={dayEvents}
                    isToday={toDateStr(date) === toDateStr(today)} isPast={date < today && toDateStr(date) !== toDateStr(today)}
                    onWorkoutTap={setViewingWorkout}
                    onAddEvent={setAddingEventDate}
                    onDeleteEvent={handleDeleteEvent}
                    onDayTap={setViewingDay}
                    onOwnWorkoutTap={handleOwnWorkoutTap} />
                )
              })}
            </div>
            <div className="md:hidden flex flex-col gap-3">
              {weekDays.map((date) => {
                const dateStr = toDateStr(date)
                const dayWorkouts = getWorkoutsForDate(programs, date, events)
                const dayEvents = events.filter((e) => e.event_date === dateStr)
                return (
                  <DayCell key={dateStr} date={date} workouts={dayWorkouts} events={dayEvents}
                    isToday={toDateStr(date) === toDateStr(today)} isPast={date < today && toDateStr(date) !== toDateStr(today)}
                    compact onWorkoutTap={setViewingWorkout}
                    onAddEvent={setAddingEventDate}
                    onDeleteEvent={handleDeleteEvent}
                    onDayTap={setViewingDay}
                    onOwnWorkoutTap={handleOwnWorkoutTap} />
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Day detail sheet */}
      {viewingDay && (() => {
        const [y, m, d] = viewingDay.split('-').map(Number)
        const dayDate = new Date(y, m - 1, d)
        const dayWorkouts = getWorkoutsForDate(programs, dayDate, events)
        const dayEvents = events.filter((e) => e.event_date === viewingDay)
        return (
          <DayDetailSheet
            date={dayDate}
            workouts={dayWorkouts}
            events={dayEvents}
            onClose={() => setViewingDay(null)}
            onWorkoutTap={setViewingWorkout}
            onAddEvent={setAddingEventDate}
            onDeleteEvent={handleDeleteEvent}
            onOwnWorkoutTap={handleOwnWorkoutTap}
          />
        )
      })()}

      {/* Workout modal */}
      {viewingWorkout && (
        <WorkoutModal
          workout={viewingWorkout}
          onClose={() => setViewingWorkout(null)}
          onSaved={handleSaved}
          onMoved={handleWorkoutMoved}
        />
      )}

      {/* Add event modal */}
      {addingEventDate && (
        <AddEventModal
          dateStr={addingEventDate}
          onClose={() => setAddingEventDate(null)}
          onCreated={handleEventCreated}
          onStartWorkout={() => {
            setAddingWorkoutDate(addingEventDate)
            setAddingEventDate(null)
          }}
        />
      )}

      {/* Edit own workout overlay */}
      {editingOwnWorkout && (
        <div className="fixed inset-0 z-[60] bg-gray-50 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 pt-4">
            <WorkoutEditor
              workoutId={editingOwnWorkout.workoutId}
              onClose={() => setEditingOwnWorkout(null)}
              onSaved={() => {
                setEditingOwnWorkout(null)
                // Refresh title if name changed
                fetchData(weekStart, addDays(weekStart, 6))
              }}
            />
          </div>
        </div>
      )}

      {/* Personal workout overlay — same flow as individual clients */}
      {addingWorkoutDate && (
        <div className="fixed inset-0 z-[60] bg-gray-50 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 pt-4">
            <ActiveWorkout
              onFinish={(workoutId, workoutName) => handleWorkoutFinished(workoutId, workoutName)}
              onBack={() => setAddingWorkoutDate(null)}
              canUploadVideo={true}
            />
          </div>
        </div>
      )}
    </div>
  )
}
