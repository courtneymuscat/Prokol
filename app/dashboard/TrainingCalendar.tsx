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
    const result = results.find(
      (e) =>
        e.type === 'program_workout_result' &&
        e.event_date === dateStr &&
        (e.content as Record<string, unknown>).program_id === prog.id &&
        (e.content as Record<string, unknown>).week_index === weekIdx &&
        (e.content as Record<string, unknown>).day_index === dayIdx
    ) ?? null
    out.push({ programId: prog.id, programName: prog.name, weekIdx, dayIdx, day, dateStr, result })
  }
  return out
}

function eventColour(type: string): string {
  switch (type) {
    case 'workout': return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'steps':   return 'bg-green-100 text-green-800 border-green-200'
    case 'note':    return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    default:        return 'bg-purple-100 text-purple-800 border-purple-200'
  }
}

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

function WorkoutModal({ workout, onClose, onSaved }: {
  workout: WorkoutForDate
  onClose: () => void
  onSaved: (result: CalendarEvent) => void
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
            <div className="flex gap-3">
              <div className="flex items-center gap-1.5 flex-1">
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                <span className="text-sm font-semibold text-green-700">Logged</span>
                {!hasAnyScore && <span className="text-xs text-gray-400">· {new Date((workout.result.content.completed_at as string) ?? '').toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}</span>}
              </div>
              <button onClick={() => setLogging(true)} className="border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">
                Edit
              </button>
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

// ─── Day Cell ─────────────────────────────────────────────────────────────────

function DayCell({ date, workouts, events, isToday, isPast, compact, onWorkoutTap }: {
  date: Date
  workouts: WorkoutForDate[]
  events: CalendarEvent[]
  isToday: boolean
  isPast: boolean
  compact?: boolean
  onWorkoutTap: (w: WorkoutForDate) => void
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
        <span className={[
          'w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold',
          isToday ? 'bg-blue-500 text-white' : 'text-gray-700',
        ].join(' ')}>
          {date.getDate()}
        </span>
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
        {events.filter((e) => e.type !== 'program_workout_result').map((ev) => (
          <div key={ev.id} className={`rounded-lg border px-2 py-1 text-[10px] font-medium truncate ${eventColour(ev.type)}`}>
            {ev.title}
          </div>
        ))}

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
    setEvents((prev) => {
      const filtered = prev.filter((e) => e.id !== result.id)
      return [...filtered, result]
    })
    // Update the viewing workout to reflect the saved result
    if (viewingWorkout) {
      setViewingWorkout({ ...viewingWorkout, result })
    }
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
                    onWorkoutTap={setViewingWorkout} />
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
                    compact onWorkoutTap={setViewingWorkout} />
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
        />
      )}
    </div>
  )
}
