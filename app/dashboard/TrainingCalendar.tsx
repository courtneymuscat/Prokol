'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

type ScoreType = 'time' | 'reps' | 'rounds' | 'weight' | 'distance' | 'calories' | 'custom' | 'none'

type ProgramSet = { setNumber: number; reps: string; weight: string; duration?: string }

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
  return date.toISOString().split('T')[0]
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
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24))
}

function getWorkoutsForDate(
  programs: ClientProgram[],
  date: Date,
  results: CalendarEvent[]
): WorkoutForDate[] {
  const out: WorkoutForDate[] = []
  const dateStr = toDateStr(date)

  for (const prog of programs) {
    const start = new Date(prog.start_date)
    start.setHours(0, 0, 0, 0)
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
    case 'travel':         return 'bg-teal-100 text-teal-800 border-teal-200'
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
] as const
type ClientEventType = 'personal' | 'travel' | 'extra_activity' | 'note'

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
  onConfirm: (blob: Blob, ext: string) => void
  onCancel: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [duration, setDuration] = useState(0)
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(0)
  const [trimming, setTrimming] = useState(false)
  const [progress, setProgress] = useState(0) // 0-100 during trim
  const [trimError, setTrimError] = useState<string | null>(null)
  const objectUrl = useRef(URL.createObjectURL(file))

  useEffect(() => {
    return () => { URL.revokeObjectURL(objectUrl.current) }
  }, [])

  function onLoadedMetadata() {
    const d = videoRef.current!.duration
    setDuration(d)
    setEndTime(d)
  }

  // Check browser support for captureStream
  const canTrim = typeof MediaRecorder !== 'undefined' &&
    typeof (document.createElement('video') as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream === 'function'

  async function handleTrim() {
    if (!canTrim) { onConfirm(file, 'webm'); return }
    setTrimming(true)
    setTrimError(null)
    setProgress(0)

    try {
      const videoEl = videoRef.current!
      videoEl.muted = true
      videoEl.currentTime = startTime

      await new Promise<void>((res) => {
        videoEl.onseeked = () => res()
      })

      const stream = (videoEl as HTMLVideoElement & { captureStream: () => MediaStream }).captureStream()
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : ''
      if (!mimeType) { setTrimError('Trimming not supported on this browser — uploading original.'); setTrimming(false); onConfirm(file, file.name.split('.').pop()?.toLowerCase() ?? 'mp4'); return }

      const recorder = new MediaRecorder(stream, { mimeType })
      const chunks: BlobPart[] = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

      await new Promise<void>((resolve, reject) => {
        recorder.onstop = () => resolve()
        recorder.onerror = () => reject(new Error('Recording failed'))
        recorder.start(200)
        videoEl.play()

        function tick() {
          if (!videoEl.paused) {
            const elapsed = videoEl.currentTime - startTime
            const total = endTime - startTime
            setProgress(Math.min(100, Math.round((elapsed / total) * 100)))
          }
          if (videoEl.currentTime >= endTime) {
            recorder.stop()
            videoEl.pause()
          } else {
            requestAnimationFrame(tick)
          }
        }
        requestAnimationFrame(tick)
      })

      const blob = new Blob(chunks, { type: mimeType })
      onConfirm(blob, 'webm')
    } catch (err) {
      setTrimError(err instanceof Error ? err.message : 'Trim failed')
      setTrimming(false)
    }
  }

  const trimDuration = endTime - startTime

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900">Trim video</p>
          <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Video preview */}
          <video
            ref={videoRef}
            src={objectUrl.current}
            onLoadedMetadata={onLoadedMetadata}
            playsInline
            className="w-full rounded-xl bg-black max-h-48 object-contain"
          />

          {duration > 0 && (
            <>
              {/* Start time */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Start</span>
                  <span className="font-mono font-medium text-gray-800">{fmtTime(startTime)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={duration}
                  step={0.1}
                  value={startTime}
                  onChange={(e) => {
                    const v = Math.min(Number(e.target.value), endTime - 0.5)
                    setStartTime(v)
                    if (videoRef.current) videoRef.current.currentTime = v
                  }}
                  className="w-full accent-indigo-600"
                />
              </div>

              {/* End time */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>End</span>
                  <span className="font-mono font-medium text-gray-800">{fmtTime(endTime)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={duration}
                  step={0.1}
                  value={endTime}
                  onChange={(e) => {
                    const v = Math.max(Number(e.target.value), startTime + 0.5)
                    setEndTime(v)
                    if (videoRef.current) videoRef.current.currentTime = v
                  }}
                  className="w-full accent-indigo-600"
                />
              </div>

              {/* Duration info */}
              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2 text-xs text-gray-500">
                <span>Clip length</span>
                <span className="font-mono font-semibold text-gray-800">{fmtTime(trimDuration)}</span>
              </div>

              {/* Trim progress */}
              {trimming && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Processing…</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}

              {trimError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{trimError}</p>}
            </>
          )}
        </div>

        <div className="px-5 pb-5 flex gap-2">
          {canTrim ? (
            <>
              <button
                type="button"
                onClick={handleTrim}
                disabled={trimming || duration === 0}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {trimming ? 'Trimming…' : 'Trim & upload'}
              </button>
              <button
                type="button"
                onClick={() => onConfirm(file, file.name.split('.').pop()?.toLowerCase() ?? 'mp4')}
                disabled={trimming}
                className="px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40"
              >
                Upload as-is
              </button>
            </>
          ) : (
            // iOS Safari / unsupported browsers — skip trim
            <button
              type="button"
              onClick={() => onConfirm(file, file.name.split('.').pop()?.toLowerCase() ?? 'mp4')}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Upload video
            </button>
          )}
        </div>
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
    setPendingFile(file)
    // Reset input so the same file can be re-selected after cancel
    e.target.value = ''
  }

  async function handleConfirm(blob: Blob, ext: string) {
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
                    {sets.map((s, si) => (
                      <div key={si} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-8">Set {si + 1}</span>
                        {logging ? (
                          <>
                            <input type="number" inputMode="decimal" value={s.weight} placeholder="Weight"
                              onChange={(e) => setExSets((prev) => {
                                const copy = [...(prev[item.id] ?? sets)]
                                copy[si] = { ...copy[si], weight: e.target.value }
                                return { ...prev, [item.id]: copy }
                              })}
                              className="w-20 border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                            <span className="text-xs text-gray-300">kg ×</span>
                            <input type="number" inputMode="numeric" value={s.reps} placeholder="Reps"
                              onChange={(e) => setExSets((prev) => {
                                const copy = [...(prev[item.id] ?? sets)]
                                copy[si] = { ...copy[si], reps: e.target.value }
                                return { ...prev, [item.id]: copy }
                              })}
                              className="w-16 border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                            <span className="text-xs text-gray-300">reps</span>
                          </>
                        ) : (
                          <span className="text-xs text-gray-600">{s.weight ? `${s.weight} kg × ` : ''}{s.reps} reps</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

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
                      <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                        <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wide mb-0.5">Coach feedback</p>
                        <p className="text-xs text-amber-900">{savedResult.coachNote}</p>
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
                    <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 whitespace-nowrap">
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
  )
}

// ─── Add Event Modal ──────────────────────────────────────────────────────────

function AddEventModal({ dateStr, onClose, onCreated }: {
  dateStr: string
  onClose: () => void
  onCreated: (event: CalendarEvent | CalendarEvent[]) => void
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
                  type === t.value ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-base leading-none mb-1">{t.icon}</div>
                <p className="text-[11px] font-semibold text-gray-800">{t.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{t.placeholder}</p>
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

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {saving ? 'Adding…' : 'Add event'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Day Cell ─────────────────────────────────────────────────────────────────

function DayCell({ date, workouts, events, isToday, isPast, compact, onWorkoutTap, onAddEvent, onDeleteEvent }: {
  date: Date
  workouts: WorkoutForDate[]
  events: CalendarEvent[]
  isToday: boolean
  isPast: boolean
  compact?: boolean
  onWorkoutTap: (w: WorkoutForDate) => void
  onAddEvent?: (dateStr: string) => void
  onDeleteEvent?: (id: string) => void
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
          <span className={[
            'w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold',
            isToday ? 'bg-blue-500 text-white' : 'text-gray-700',
          ].join(' ')}>
            {date.getDate()}
          </span>
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
              {sections.length > 0 ? (
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
          const autoflowLink = ev.type === 'autoflow'
            ? (ev.content as Record<string, unknown>)?.link as string | undefined
            : undefined

          const inner = (
            <>
              <span className="truncate flex-1">{ev.type === 'birthday' ? '🎂 ' : ev.type === 'autoflow' ? '📋 ' : ''}{ev.title}</span>
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
            </>
          )

          const cls = `rounded-lg border px-2 py-1 text-[10px] font-medium flex items-center gap-1 ${eventColour(ev.type)}`

          return autoflowLink ? (
            <a key={ev.id} href={autoflowLink} className={`${cls} hover:opacity-80 transition-opacity`}>
              {inner}
            </a>
          ) : (
            <div key={ev.id} className={cls}>
              {inner}
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
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()))
  const [programs, setPrograms] = useState<ClientProgram[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewingWorkout, setViewingWorkout] = useState<WorkoutForDate | null>(null)
  const [addingEventDate, setAddingEventDate] = useState<string | null>(null)

  const weekEnd = addDays(weekStart, 6)

  const fetchData = useCallback(async (wStart: Date, wEnd: Date) => {
    setLoading(true); setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const startStr = toDateStr(wStart)
      const endStr = toDateStr(wEnd)

      const [programsResult, eventsResult] = await Promise.all([
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
      ])

      setPrograms(programsResult.data ?? [])
      setEvents(eventsResult.data ?? [])
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

  const goToPrevWeek = () => setWeekStart((d) => addDays(d, -7))
  const goToNextWeek = () => setWeekStart((d) => addDays(d, 7))
  const goToThisWeek = () => setWeekStart(startOfWeek(new Date()))

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

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-gray-900">Training Calendar</h2>
          <span className="text-sm text-gray-400">{monthLabel}</span>
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
                    onDeleteEvent={handleDeleteEvent} />
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
                    onDeleteEvent={handleDeleteEvent} />
                )
              })}
            </div>
          </>
        )}
      </div>

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
        />
      )}
    </div>
  )
}
