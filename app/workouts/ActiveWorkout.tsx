'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import ExerciseSearch, { type Exercise } from './ExerciseSearch'

// ─── Types ───────────────────────────────────────────────────────────────────

type SetRow = {
  id: string
  dbId?: string
  setNumber: number
  weightLbs: string
  reps: string
  durationSeconds: string
  calories: string
  restSeconds: string
  completed: boolean
}

type Metrics = 'weight+reps' | 'reps' | 'weight+time' | 'time' | 'calories'

const METRICS_CONFIG: Record<Metrics, {
  col1: { label: string; field: keyof SetRow }
  col2?: { label: string; field: keyof SetRow }
}> = {
  'weight+reps': { col1: { label: 'Weight', field: 'weightLbs' }, col2: { label: 'Reps', field: 'reps' } },
  'reps':        { col1: { label: 'Reps', field: 'reps' } },
  'weight+time': { col1: { label: 'Weight', field: 'weightLbs' }, col2: { label: 'Time (sec)', field: 'durationSeconds' } },
  'time':        { col1: { label: 'Time (sec)', field: 'durationSeconds' } },
  'calories':    { col1: { label: 'Calories', field: 'calories' }, col2: { label: 'Time (sec)', field: 'durationSeconds' } },
}

const METRICS_LABELS: Record<Metrics, string> = {
  'weight+reps': 'Wt + Reps',
  'reps':        'Reps',
  'weight+time': 'Wt + Time',
  'time':        'Time',
  'calories':    'Cals',
}

function defaultMetrics(category: string): Metrics {
  return category === 'cardio' ? 'calories' : 'weight+reps'
}

type WorkoutExercise = {
  type: 'exercise'
  weId: string
  exercise: Exercise
  sets: SetRow[]
  metrics: Metrics
  showRest: boolean
  note: string
  formVideoUrl: string | null
}

export type ScoreType = 'time' | 'reps' | 'rounds' | 'weight' | 'distance' | 'calories' | 'custom'

export type FreestyleSection = {
  type: 'freestyle'
  id: string
  title: string
  notes: string
  linkedExercise: Exercise | null
  scoreType: ScoreType
  scoreValue: string
}

type WorkoutItem = WorkoutExercise | FreestyleSection

// ─── Helpers ─────────────────────────────────────────────────────────────────

function newSet(num: number, prev?: SetRow): SetRow {
  return {
    id: `${Date.now()}-${num}`,
    setNumber: num,
    weightLbs: prev?.weightLbs ?? '',
    reps: prev?.reps ?? '',
    durationSeconds: prev?.durationSeconds ?? '',
    calories: prev?.calories ?? '',
    restSeconds: prev?.restSeconds ?? '',
    completed: false,
  }
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function getYouTubeId(url: string) {
  return url.match(/[?&]v=([^&]+)/)?.[1] ?? null
}

function moveArr<T>(arr: T[], idx: number, dir: 'up' | 'down'): T[] {
  const next = dir === 'up' ? idx - 1 : idx + 1
  if (next < 0 || next >= arr.length) return arr
  const out = [...arr]
  ;[out[idx], out[next]] = [out[next], out[idx]]
  return out
}

// ─── Shared move buttons ──────────────────────────────────────────────────────

function MoveButtons({ onUp, onDown, canUp, canDown }: { onUp: () => void; onDown: () => void; canUp: boolean; canDown: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <button
        onClick={onUp}
        disabled={!canUp}
        className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 disabled:opacity-20 disabled:cursor-default transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
        </svg>
      </button>
      <button
        onClick={onDown}
        disabled={!canDown}
        className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 disabled:opacity-20 disabled:cursor-default transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  )
}

// ─── Video modal ──────────────────────────────────────────────────────────────

function VideoModal({ videoId, title, onClose }: { videoId: string; title: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="w-full max-w-lg mx-4 bg-black rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 bg-gray-900">
          <p className="text-white text-sm font-semibold truncate">{title}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none ml-3">✕</button>
        </div>
        <div className="relative" style={{ paddingBottom: '56.25%' }}>
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  )
}

// ─── Score input ──────────────────────────────────────────────────────────────

function ScoreInput({ type, value, onChange }: { type: ScoreType; value: string; onChange: (v: string) => void }) {
  if (type === 'time') {
    const [mm, ss] = value.split(':')
    const update = (m: string, s: string) => onChange(`${m}:${s}`)
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 flex-1">
          <input type="number" inputMode="numeric" placeholder="00" value={mm ?? ''} onChange={(e) => update(e.target.value, ss ?? '')} className="w-full border rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-1 focus:ring-purple-300" />
          <span className="text-gray-400 font-bold">:</span>
          <input type="number" inputMode="numeric" placeholder="00" min={0} max={59} value={ss ?? ''} onChange={(e) => update(mm ?? '', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-1 focus:ring-purple-300" />
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0">min : sec</span>
      </div>
    )
  }

  if (type === 'rounds') {
    const [rounds, reps] = value.split('+')
    const update = (r: string, rep: string) => onChange(`${r}+${rep}`)
    return (
      <div className="flex items-center gap-2">
        <input type="number" inputMode="numeric" placeholder="0" value={rounds ?? ''} onChange={(e) => update(e.target.value, reps ?? '')} className="flex-1 border rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-1 focus:ring-purple-300" />
        <span className="text-xs text-gray-400">rounds +</span>
        <input type="number" inputMode="numeric" placeholder="0" value={reps ?? ''} onChange={(e) => update(rounds ?? '', e.target.value)} className="flex-1 border rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-1 focus:ring-purple-300" />
        <span className="text-xs text-gray-400">reps</span>
      </div>
    )
  }

  const UNITS: Record<ScoreType, string> = { reps: 'reps', weight: 'lbs', distance: 'm', calories: 'cals', custom: '', time: '', rounds: '' }
  return (
    <div className="flex items-center gap-2">
      <input
        type={type === 'custom' ? 'text' : 'number'}
        inputMode={type === 'custom' ? 'text' : 'numeric'}
        placeholder={type === 'custom' ? 'e.g. 21-15-9, Rx, scaled...' : '0'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-300"
      />
      {UNITS[type] && <span className="text-xs text-gray-400 flex-shrink-0">{UNITS[type]}</span>}
    </div>
  )
}

// ─── Freestyle block ──────────────────────────────────────────────────────────

function FreestyleBlock({ section, canUp, canDown, onChange, onRemove, onMoveUp, onMoveDown }: {
  section: FreestyleSection
  canUp: boolean
  canDown: boolean
  onChange: (updated: FreestyleSection) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const [showExSearch, setShowExSearch] = useState(false)
  const [showVideo, setShowVideo] = useState(false)
  const ex = section.linkedExercise
  const videoId = ex?.video_url ? getYouTubeId(ex.video_url) : null

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      {showVideo && videoId && <VideoModal videoId={videoId} title={ex?.name ?? 'Demo'} onClose={() => setShowVideo(false)} />}

      {/* Header */}
      <div className="flex items-center gap-2">
        <MoveButtons onUp={onMoveUp} onDown={onMoveDown} canUp={canUp} canDown={canDown} />
        <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0">
          Section
        </span>
        <input
          value={section.title}
          onChange={(e) => onChange({ ...section, title: e.target.value })}
          placeholder="Section title (e.g. Warm Up, Metcon, Notes)"
          className="flex-1 text-sm font-semibold text-gray-900 bg-transparent outline-none border-b border-transparent focus:border-gray-300 min-w-0"
        />
        <button onClick={onRemove} className="text-gray-300 hover:text-red-400 text-xl leading-none flex-shrink-0">×</button>
      </div>

      {/* Notes */}
      <textarea
        value={section.notes}
        onChange={(e) => onChange({ ...section, notes: e.target.value })}
        placeholder="Add notes, instructions, or reminders..."
        rows={3}
        className="w-full text-sm text-gray-700 border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-purple-300 placeholder:text-gray-300"
      />

      {/* Score */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Score</p>
        <div className="flex gap-1.5 flex-wrap">
          {(['time', 'reps', 'rounds', 'weight', 'distance', 'calories', 'custom'] as ScoreType[]).map((t) => (
            <button
              key={t}
              onClick={() => onChange({ ...section, scoreType: t, scoreValue: '' })}
              className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize transition-colors ${section.scoreType === t ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {t === 'rounds' ? 'Rounds + Reps' : t}
            </button>
          ))}
        </div>
        <ScoreInput type={section.scoreType} value={section.scoreValue} onChange={(v) => onChange({ ...section, scoreValue: v })} />
      </div>

      {/* Linked exercise */}
      {ex ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{ex.name}</p>
              <p className="text-xs text-gray-400 capitalize">{ex.category} · {ex.equipment}</p>
            </div>
            {videoId && (
              <button onClick={() => setShowVideo(true)} className="w-7 h-7 flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 transition-colors flex-shrink-0">
                <svg className="w-3 h-3 text-red-600 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              </button>
            )}
            <button onClick={() => onChange({ ...section, linkedExercise: null })} className="text-gray-300 hover:text-red-400 text-lg leading-none flex-shrink-0">×</button>
          </div>
          {videoId && (
            <button onClick={() => setShowVideo(true)} className="relative w-full rounded-lg overflow-hidden group">
              <img src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`} alt="Exercise demo" className="w-full object-cover rounded-lg" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors rounded-lg">
                <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                  <svg className="w-5 h-5 text-white ml-1" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                </div>
              </div>
            </button>
          )}
          <button onClick={() => setShowExSearch(true)} className="text-xs text-gray-400 hover:text-gray-600">Change exercise</button>
        </div>
      ) : (
        <button
          onClick={() => setShowExSearch(true)}
          className="w-full flex items-center gap-2 border border-dashed border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-400 hover:border-purple-300 hover:text-purple-500 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          Link an exercise demo video
        </button>
      )}

      {showExSearch && (
        <ExerciseSearch
          onSelect={(exercise) => { onChange({ ...section, linkedExercise: exercise }); setShowExSearch(false) }}
          onClose={() => setShowExSearch(false)}
        />
      )}
    </div>
  )
}

// ─── Exercise history ─────────────────────────────────────────────────────────

type HistorySession = {
  workoutName: string
  date: string
  notes: string | null
  sets: { set_number: number; weight_lbs: number | null; reps: number | null; duration_seconds: number | null; calories: number | null }[]
}

function ExerciseHistory({ exerciseId, metrics }: { exerciseId: string; metrics: Metrics }) {
  const [expanded, setExpanded] = useState(false)
  const [history, setHistory] = useState<HistorySession[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch(`/api/exercises/history?exerciseId=${exerciseId}`)
      .then((r) => r.json())
      .then((data) => { setHistory(data); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [exerciseId])

  function formatSet(set: HistorySession['sets'][0]): string {
    const w = set.weight_lbs
    const r = set.reps
    const d = set.duration_seconds
    const c = set.calories
    const wLabel = w != null ? `${w}` : null
    switch (metrics) {
      case 'weight+reps': return [wLabel ? `${wLabel}kg` : '—', r != null ? `${r} reps` : '—'].join(' × ')
      case 'reps':        return r != null ? `${r} reps` : '—'
      case 'weight+time': return [wLabel ? `${wLabel}kg` : '—', d != null ? `${d}s` : '—'].join(' × ')
      case 'time':        return d != null ? `${d}s` : '—'
      case 'calories':    return [c != null ? `${c} cal` : null, d != null ? `${d}s` : null].filter(Boolean).join(' · ') || '—'
    }
  }

  // Don't render anything while loading
  if (!loaded) return null

  // No history yet
  if (history.length === 0) return (
    <div className="flex items-center gap-1.5 mt-1">
      <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-xs text-gray-400">No previous sessions yet</p>
    </div>
  )

  const last = history[0]
  const lastDate = new Date(last.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })

  return (
    <div className="mt-2 rounded-xl border border-gray-200 overflow-hidden">
      {/* Always-visible last session summary */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-semibold text-gray-600">Last session</span>
          <span className="text-xs text-gray-400">{lastDate}</span>
          {/* Inline set chips for the most recent session */}
          <div className="flex items-center gap-1 flex-wrap">
            {last.sets.slice(0, 4).map((set) => (
              <span key={set.set_number} className="text-xs bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-600 font-medium">
                {formatSet(set)}
              </span>
            ))}
            {last.sets.length > 4 && (
              <span className="text-xs text-gray-400">+{last.sets.length - 4}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {history.length > 1 && (
            <span className="text-[10px] text-gray-400">{history.length} sessions</span>
          )}
          <svg
            className={`w-3.5 h-3.5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded: all sessions */}
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
                {session.sets.map((set) => (
                  <span key={set.set_number} className="text-xs bg-gray-50 border border-gray-200 rounded px-2 py-0.5 text-gray-700 font-medium">
                    <span className="text-gray-400 mr-1">{set.set_number}.</span>{formatSet(set)}
                  </span>
                ))}
              </div>
              {session.notes && (
                <p className="text-xs text-gray-500 italic border-t border-gray-100 pt-1.5">{session.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Video trim modal ─────────────────────────────────────────────────────────

function VideoTrimModal({ file, onUpload, onCancel }: {
  file: File
  onUpload: (blob: Blob | File) => void
  onCancel: () => void
}) {
  const [videoUrl] = useState(() => URL.createObjectURL(file))
  const [duration, setDuration] = useState(0)
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(0)
  const [processing, setProcessing] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => () => URL.revokeObjectURL(videoUrl), [videoUrl])

  function onLoaded() {
    const d = videoRef.current?.duration ?? 0
    setDuration(d)
    setEndTime(d)
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  async function handleUpload() {
    setProcessing(true)
    const video = videoRef.current
    const trimDuration = endTime - startTime

    // Try captureStream for trimming; fall back to uploading the full file
    if (video && typeof (video as unknown as Record<string, unknown>).captureStream === 'function' && trimDuration < duration - 0.5) {
      try {
        const stream = (video as unknown as { captureStream: () => MediaStream }).captureStream()
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9'
          : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4'
        const recorder = new MediaRecorder(stream, { mimeType })
        const chunks: Blob[] = []
        recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType })
          onUpload(blob)
        }
        video.currentTime = startTime
        await video.play()
        recorder.start()
        setTimeout(() => { video.pause(); recorder.stop() }, trimDuration * 1000)
        return
      } catch {
        // fall through to full upload
      }
    }
    // Fallback: upload original
    onUpload(file)
  }

  const trimDuration = endTime - startTime
  const startPct = duration > 0 ? (startTime / duration) * 100 : 0
  const endPct = duration > 0 ? (endTime / duration) * 100 : 100

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/60 safe-area-top">
        <button onClick={onCancel} className="text-white/70 hover:text-white text-sm font-medium px-2 py-1">Cancel</button>
        <p className="text-white font-semibold text-sm">Trim Video</p>
        <button
          onClick={handleUpload}
          disabled={processing || trimDuration <= 0.1}
          className="text-orange-400 font-semibold text-sm px-2 py-1 disabled:opacity-40"
        >
          {processing ? 'Processing…' : 'Upload'}
        </button>
      </div>

      {/* Video */}
      <div className="flex-1 flex items-center justify-center bg-black p-2">
        <video
          ref={videoRef}
          src={videoUrl}
          onLoadedMetadata={onLoaded}
          className="max-h-full max-w-full rounded-xl"
          playsInline
          controls
        />
      </div>

      {/* Trim controls */}
      <div className="bg-gray-900 px-5 pt-4 pb-8 space-y-4">
        <div className="flex justify-between text-xs text-white/60">
          <span>Start: {fmt(startTime)}</span>
          <span className="text-orange-400 font-semibold">{fmt(trimDuration)} selected</span>
          <span>End: {fmt(endTime)}</span>
        </div>

        {/* Visual timeline */}
        <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
          <div
            className="absolute h-full bg-orange-500/70 rounded-full"
            style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
          />
        </div>

        {/* Sliders */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/50 w-10 flex-shrink-0">Start</span>
            <input
              type="range" min={0} max={duration} step={0.1} value={startTime}
              onChange={e => {
                const v = Math.min(parseFloat(e.target.value), endTime - 0.5)
                setStartTime(v)
                if (videoRef.current) videoRef.current.currentTime = v
              }}
              className="flex-1 accent-orange-500"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/50 w-10 flex-shrink-0">End</span>
            <input
              type="range" min={0} max={duration} step={0.1} value={endTime}
              onChange={e => {
                const v = Math.max(parseFloat(e.target.value), startTime + 0.5)
                setEndTime(v)
                if (videoRef.current) videoRef.current.currentTime = v
              }}
              className="flex-1 accent-orange-500"
            />
          </div>
        </div>

        <p className="text-[11px] text-white/40 text-center">
          {typeof (document.createElement('video') as unknown as Record<string, unknown>).captureStream === 'function'
            ? 'Drag sliders to trim, then tap Upload'
            : 'Trimming not supported on this browser — full video will upload'}
        </p>
      </div>
    </div>
  )
}

// ─── Exercise notes ───────────────────────────────────────────────────────────

function ExerciseNotes({
  weId, note, onNoteChange,
  canUploadVideo, formVideoUrl, onFormVideoChange,
}: {
  weId: string
  note: string
  onNoteChange: (v: string) => void
  canUploadVideo: boolean
  formVideoUrl: string | null
  onFormVideoChange: (url: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [trimFile, setTrimFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    Promise.resolve(
      supabase.from('workout_exercises').select('notes, video_url').eq('id', weId).single()
    ).then(({ data }) => {
      const existing = (data as Record<string, unknown>)?.notes as string | null
      const existingVideo = (data as Record<string, unknown>)?.video_url as string | null
      if (existing) { onNoteChange(existing); setOpen(true) }
      if (existingVideo) { onFormVideoChange(existingVideo); setOpen(true) }
    }).catch(() => {})
  }, [weId])

  async function uploadBlob(blob: Blob | File) {
    setTrimFile(null)
    setUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploading(false); return }
    const ext = blob instanceof File ? (blob.name.split('.').pop() ?? 'mp4') : 'webm'
    const path = `${user.id}/${weId}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('exercise-videos').upload(path, blob, { upsert: true })
    if (!error) {
      const { data: signed } = await supabase.storage.from('exercise-videos').createSignedUrl(path, 315360000)
      if (signed?.signedUrl) onFormVideoChange(signed.signedUrl)
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setTrimFile(f)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Add note
      </button>
    )
  }

  return (
    <div className="space-y-2">
      {trimFile && (
        <VideoTrimModal
          file={trimFile}
          onUpload={uploadBlob}
          onCancel={() => { setTrimFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
        />
      )}
      <textarea
        autoFocus={!note && !formVideoUrl}
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder="e.g. Weight felt heavy today, rest 90s between sets..."
        rows={2}
        className="w-full text-xs text-gray-600 border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-300 placeholder:text-gray-300"
      />
      {canUploadVideo ? (
        formVideoUrl ? (
          <div className="flex items-center gap-3 bg-purple-50 rounded-lg px-3 py-2">
            <svg className="w-4 h-4 text-purple-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <a href={formVideoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-700 font-medium flex-1 truncate">
              View form video
            </a>
            <button onClick={() => onFormVideoChange(null)} className="text-xs text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">Remove</button>
          </div>
        ) : (
          <label className="cursor-pointer flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleFileSelected}
            />
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {uploading ? 'Uploading…' : 'Add form video'}
          </label>
        )
      ) : (
        <a href="/pricing" className="text-xs text-purple-400 hover:text-purple-600 flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Upload form videos with Elite →
        </a>
      )}
    </div>
  )
}

// ─── Exercise block ───────────────────────────────────────────────────────────

function ExerciseBlock({ we, canUp, canDown, onMoveUp, onMoveDown, onAddSet, onRemove, onUpdateSet, onToggleComplete, onSetMetrics, onToggleRest, onNoteChange, onVideoChange, canUploadVideo, onFormVideoChange }: {
  we: WorkoutExercise
  canUp: boolean
  canDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onAddSet: () => void
  onRemove: () => void
  onUpdateSet: (setId: string, field: keyof SetRow, value: string | boolean) => void
  onToggleComplete: (set: SetRow) => void
  onSetMetrics: (m: Metrics) => void
  onToggleRest: () => void
  onNoteChange: (note: string) => void
  onVideoChange: (url: string | null) => void
  canUploadVideo: boolean
  onFormVideoChange: (url: string | null) => void
}) {
  const [showVideo, setShowVideo] = useState(false)
  const [editingVideo, setEditingVideo] = useState(false)
  const [videoInput, setVideoInput] = useState(we.exercise.video_url ?? '')
  const [savingVideo, setSavingVideo] = useState(false)
  const videoId = we.exercise.video_url ? getYouTubeId(we.exercise.video_url) : null

  async function handleSaveVideo() {
    setSavingVideo(true)
    const url = videoInput.trim() || null
    await fetch(`/api/exercises/${we.exercise.id}/video`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_url: url }),
    })
    setSavingVideo(false)
    onVideoChange(url)
    setEditingVideo(false)
  }
  const cfg = METRICS_CONFIG[we.metrics]
  const hasTwoCols = !!cfg.col2
  const gridCols = we.showRest
    ? hasTwoCols ? 'grid-cols-[24px_1fr_1fr_64px_36px]' : 'grid-cols-[24px_1fr_64px_36px]'
    : hasTwoCols ? 'grid-cols-[24px_1fr_1fr_36px]' : 'grid-cols-[24px_1fr_36px]'

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      {showVideo && videoId && <VideoModal videoId={videoId} title={we.exercise.name} onClose={() => setShowVideo(false)} />}

      {/* Header */}
      <div className="flex items-start gap-2">
        <MoveButtons onUp={onMoveUp} onDown={onMoveDown} canUp={canUp} canDown={canDown} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">{we.exercise.name}</p>
          <p className="text-xs text-gray-400 capitalize mt-0.5">{we.exercise.category} · {we.exercise.equipment}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {videoId ? (
            <>
              <button onClick={() => setShowVideo(true)} title="Watch demo" className="w-7 h-7 flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 transition-colors">
                <svg className="w-3 h-3 text-red-600 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              </button>
              <button onClick={() => { setVideoInput(we.exercise.video_url ?? ''); setEditingVideo(true) }} title="Change video" className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
                <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" /></svg>
              </button>
            </>
          ) : (
            <button onClick={() => { setVideoInput(''); setEditingVideo(true) }} className="text-xs text-gray-400 hover:text-blue-600 transition-colors whitespace-nowrap">+ video</button>
          )}
          <button onClick={onRemove} className="text-gray-300 hover:text-red-400 text-xl leading-none">×</button>
        </div>
      </div>

      {editingVideo && (
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
          <input
            autoFocus
            value={videoInput}
            onChange={(e) => setVideoInput(e.target.value)}
            placeholder="Paste YouTube URL..."
            className="flex-1 text-xs border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveVideo(); if (e.key === 'Escape') setEditingVideo(false) }}
          />
          <button onClick={handleSaveVideo} disabled={savingVideo} className="text-xs font-semibold bg-blue-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {savingVideo ? '…' : 'Save'}
          </button>
          <button onClick={() => setEditingVideo(false)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
        </div>
      )}

      {/* Metric selector */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(Object.keys(METRICS_LABELS) as Metrics[]).map((m) => (
          <button
            key={m}
            onClick={() => onSetMetrics(m)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${we.metrics === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            {METRICS_LABELS[m]}
          </button>
        ))}
        <button
          onClick={onToggleRest}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ml-auto ${we.showRest ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
        >
          {we.showRest ? '⏱ Rest on' : '⏱ Rest'}
        </button>
      </div>

      {/* Column headers */}
      <div className={`${gridCols} gap-2 text-xs text-gray-400 font-medium px-1 grid`}>
        <span className="text-center">#</span>
        <span className="text-center">{cfg.col1.label}</span>
        {cfg.col2 && <span className="text-center">{cfg.col2.label}</span>}
        {we.showRest && <span className="text-center">Rest (s)</span>}
        <span />
      </div>

      {/* Set rows */}
      {we.sets.map((set) => (
        <div key={set.id} className={`${gridCols} gap-2 items-center grid transition-opacity ${set.completed ? 'opacity-50' : ''}`}>
          <span className="text-sm text-gray-500 text-center">{set.setNumber}</span>
          <input
            type="number" inputMode="decimal" placeholder="—"
            value={set[cfg.col1.field] as string}
            onChange={(e) => onUpdateSet(set.id, cfg.col1.field, e.target.value)}
            disabled={set.completed}
            className="border rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-300 disabled:bg-gray-50 disabled:cursor-default"
          />
          {cfg.col2 && (
            <input
              type="number" inputMode="numeric" placeholder="—"
              value={set[cfg.col2.field] as string}
              onChange={(e) => onUpdateSet(set.id, cfg.col2!.field, e.target.value)}
              disabled={set.completed}
              className="border rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-300 disabled:bg-gray-50 disabled:cursor-default"
            />
          )}
          {we.showRest && (
            <input
              type="number" inputMode="numeric" placeholder="60"
              value={set.restSeconds}
              onChange={(e) => onUpdateSet(set.id, 'restSeconds', e.target.value)}
              disabled={set.completed}
              className="border rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-1 focus:ring-orange-300 disabled:bg-gray-50 disabled:cursor-default"
            />
          )}
          <button
            onClick={() => onToggleComplete(set)}
            className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-colors ${set.completed ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 text-transparent hover:border-green-400'}`}
          >✓</button>
        </div>
      ))}

      <button onClick={onAddSet} className="text-sm text-blue-600 hover:text-blue-700 font-medium">+ Add Set</button>
      <ExerciseHistory exerciseId={we.exercise.id} metrics={we.metrics} />
      <ExerciseNotes
        weId={we.weId}
        note={we.note}
        onNoteChange={onNoteChange}
        canUploadVideo={canUploadVideo}
        formVideoUrl={we.formVideoUrl}
        onFormVideoChange={onFormVideoChange}
      />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  onFinish: (workoutId?: string, workoutName?: string) => void
  onBack: () => void
  template?: { name: string; exercises: Exercise[]; sections: FreestyleSection[] }
  canUploadVideo?: boolean
}

export default function ActiveWorkout({ onFinish, onBack, template, canUploadVideo = false }: Props) {
  const supabase = createClient()
  const [workoutId, setWorkoutId] = useState<string | null>(null)
  const [creating, setCreating] = useState(true)
  const [workoutName, setWorkoutName] = useState(template?.name ?? 'Workout')
  const [items, setItems] = useState<WorkoutItem[]>([])
  const [showSearch, setShowSearch] = useState(false)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [finishing, setFinishing] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [restCountdown, setRestCountdown] = useState<number | null>(null)
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAt = useRef(new Date())
  const nameRef = useRef(workoutName)
  nameRef.current = workoutName

  function startRestTimer(seconds: number) {
    if (seconds <= 0) return
    if (restTimerRef.current) clearInterval(restTimerRef.current)
    setRestCountdown(seconds)
    restTimerRef.current = setInterval(() => {
      setRestCountdown(prev => {
        if (prev === null || prev <= 1) {
          if (restTimerRef.current) clearInterval(restTimerRef.current)
          return null
        }
        return prev - 1
      })
    }, 1000)
  }

  function stopRestTimer() {
    if (restTimerRef.current) clearInterval(restTimerRef.current)
    setRestCountdown(null)
  }

  useEffect(() => {
    async function createWorkout() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('workouts')
        .insert({ name: 'Workout', user_id: user.id, started_at: startedAt.current.toISOString() })
        .select('id').single()
      if (data) {
        setWorkoutId(data.id)
        // Auto-load template exercises + sections if cloning
        if (template && (template.exercises.length || template.sections.length)) {
          const templateItems: WorkoutItem[] = []
          for (let i = 0; i < template.exercises.length; i++) {
            const exercise = template.exercises[i]
            const { data: we } = await supabase
              .from('workout_exercises')
              .insert({ workout_id: data.id, exercise_id: exercise.id, order_index: i })
              .select('id').single()
            if (we) {
              templateItems.push({ type: 'exercise', weId: we.id, exercise, sets: [newSet(1)], metrics: defaultMetrics(exercise.category), showRest: true, note: '', formVideoUrl: null })
            }
          }
          // Restore freestyle sections with fresh IDs
          for (const section of template.sections) {
            templateItems.push({ ...section, id: `fs-${Date.now()}-${Math.random()}` })
          }
          setItems(templateItems)
        }
      }
      setCreating(false)
    }
    createWorkout()
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current.getTime()) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!workoutId) return
    const timer = setTimeout(() => supabase.from('workouts').update({ name: nameRef.current }).eq('id', workoutId), 600)
    return () => clearTimeout(timer)
  }, [workoutName, workoutId])

  // ── Item helpers ──

  function moveItem(idx: number, dir: 'up' | 'down') {
    setItems((prev) => moveArr(prev, idx, dir))
  }

  async function addExercise(exercise: Exercise) {
    if (!workoutId) return
    setShowSearch(false)
    setShowAddMenu(false)
    const exerciseCount = items.filter((i) => i.type === 'exercise').length
    const { data } = await supabase
      .from('workout_exercises')
      .insert({ workout_id: workoutId, exercise_id: exercise.id, order_index: exerciseCount })
      .select('id').single()
    if (!data) return
    setItems((prev) => [...prev, { type: 'exercise', weId: data.id, exercise, sets: [newSet(1)], metrics: defaultMetrics(exercise.category), showRest: false, note: '', formVideoUrl: null }])
  }

  function addFreestyleSection() {
    setShowAddMenu(false)
    setItems((prev) => [...prev, { type: 'freestyle', id: `fs-${Date.now()}`, title: '', notes: '', linkedExercise: null, scoreType: 'time', scoreValue: '' }])
  }

  function addSet(weId: string) {
    setItems((prev) => prev.map((item) => {
      if (item.type !== 'exercise' || item.weId !== weId) return item
      const prev_set = item.sets[item.sets.length - 1]
      return { ...item, sets: [...item.sets, newSet(item.sets.length + 1, prev_set)] }
    }))
  }

  function setMetrics(weId: string, metrics: Metrics) {
    setItems((prev) => prev.map((item) =>
      item.type === 'exercise' && item.weId === weId ? { ...item, metrics } : item
    ))
  }

  function toggleRest(weId: string) {
    setItems((prev) => prev.map((item) =>
      item.type === 'exercise' && item.weId === weId ? { ...item, showRest: !item.showRest } : item
    ))
  }

  function removeExercise(weId: string) {
    setItems((prev) => prev.filter((i) => !(i.type === 'exercise' && i.weId === weId)))
    supabase.from('workout_exercises').delete().eq('id', weId)
  }

  function setExerciseNote(weId: string, note: string) {
    setItems((prev) => prev.map((item) =>
      item.type === 'exercise' && item.weId === weId ? { ...item, note } : item
    ))
  }

  function setFormVideoUrl(weId: string, url: string | null) {
    setItems((prev) => prev.map((item) =>
      item.type === 'exercise' && item.weId === weId ? { ...item, formVideoUrl: url } : item
    ))
  }

  function updateFreestyle(id: string, updated: FreestyleSection) {
    setItems((prev) => prev.map((item) => item.type === 'freestyle' && item.id === id ? updated : item))
  }

  function removeFreestyle(id: string) {
    setItems((prev) => prev.filter((i) => !(i.type === 'freestyle' && i.id === id)))
  }

  function updateSet(weId: string, setId: string, field: keyof SetRow, value: string | boolean) {
    setItems((prev) => prev.map((item) =>
      item.type === 'exercise' && item.weId === weId
        ? { ...item, sets: item.sets.map((s) => s.id === setId ? { ...s, [field]: value } : s) }
        : item
    ))
  }

  async function toggleComplete(weId: string, set: SetRow) {
    const nowComplete = !set.completed
    updateSet(weId, set.id, 'completed', nowComplete)

    if (nowComplete) {
      const restSecs = parseInt(set.restSeconds || '0') || 0
      if (restSecs > 0) startRestTimer(restSecs)
    } else {
      stopRestTimer()
    }

    if (nowComplete) {
      const { data } = await supabase.from('exercise_sets').insert({
        workout_exercise_id: weId,
        set_number: set.setNumber,
        weight_lbs: set.weightLbs ? parseFloat(set.weightLbs) : null,
        reps: set.reps ? parseInt(set.reps) : null,
        duration_seconds: set.durationSeconds ? parseInt(set.durationSeconds) : null,
        calories: set.calories ? parseInt(set.calories) : null,
        completed: true,
      }).select('id').single()
      if (data) {
        setItems((prev) => prev.map((item) =>
          item.type === 'exercise' && item.weId === weId
            ? { ...item, sets: item.sets.map((s) => s.id === set.id ? { ...s, dbId: data.id } : s) }
            : item
        ))
      }
    } else if (set.dbId) {
      await supabase.from('exercise_sets').delete().eq('id', set.dbId)
      setItems((prev) => prev.map((item) =>
        item.type === 'exercise' && item.weId === weId
          ? { ...item, sets: item.sets.map((s) => s.id === set.id ? { ...s, dbId: undefined } : s) }
          : item
      ))
    }
  }

  async function discardWorkout() {
    if (!workoutId) { onBack(); return }
    setDiscarding(false)
    await supabase.from('workouts').delete().eq('id', workoutId)
    onBack()
  }

  async function finishWorkout() {
    if (!workoutId) return
    setFinishing(true)

    // Save exercise notes and form videos
    for (const item of items) {
      if (item.type !== 'exercise') continue
      try {
        await supabase.from('workout_exercises')
          .update({ notes: item.note || null, video_url: item.formVideoUrl || null })
          .eq('id', item.weId)
      } catch { /* column missing — skip */ }
    }

    // Save any sets that have values but were never checked off
    for (const item of items) {
      if (item.type !== 'exercise') continue
      for (const set of item.sets) {
        if (set.dbId) continue // already saved when checked off
        const hasValue = set.weightLbs || set.reps || set.durationSeconds || set.calories
        if (!hasValue) continue
        await supabase.from('exercise_sets').insert({
          workout_exercise_id: item.weId,
          set_number: set.setNumber,
          weight_lbs: set.weightLbs ? parseFloat(set.weightLbs) : null,
          reps: set.reps ? parseInt(set.reps) : null,
          duration_seconds: set.durationSeconds ? parseInt(set.durationSeconds) : null,
          calories: set.calories ? parseInt(set.calories) : null,
          completed: false,
        })
      }
    }

    const freestyles = items.filter((i): i is FreestyleSection => i.type === 'freestyle')
    const sectionNotes = freestyles.length > 0
      ? JSON.stringify(freestyles.map(({ title, notes: sNotes, linkedExercise, scoreType, scoreValue }) => ({
          title, notes: sNotes, linkedExercise: linkedExercise ?? null, scoreType, scoreValue,
        })))
      : null

    const base = { ended_at: new Date().toISOString(), name: nameRef.current }
    const payload = sectionNotes !== null ? { ...base, notes: sectionNotes } : base

    let { error } = await supabase.from('workouts').update(payload).eq('id', workoutId)

    // If saving with notes failed (column missing), retry without notes
    if (error && sectionNotes !== null) {
      const { error: e2 } = await supabase.from('workouts').update(base).eq('id', workoutId)
      error = e2 ?? null
    }

    if (error) {
      alert(`Failed to save workout: ${error.message}`)
      setFinishing(false)
      return
    }
    onFinish(workoutId ?? undefined, nameRef.current)
  }

  const exercises = items.filter((i): i is WorkoutExercise => i.type === 'exercise')
  const completedSets = exercises.reduce((acc, we) => acc + we.sets.filter((s) => s.completed).length, 0)

  return (
    <div className="space-y-4 pb-28">

      {/* Rest countdown banner */}
      {restCountdown !== null && (
        <div className="fixed bottom-24 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
          <div className="bg-orange-500 text-white rounded-2xl px-5 py-4 shadow-2xl flex items-center gap-4 max-w-sm w-full pointer-events-auto">
            <div className="w-14 h-14 rounded-full bg-orange-600 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold tabular-nums">{restCountdown}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Rest time</p>
              <p className="text-xs text-orange-100">{restCountdown === 1 ? 'Next set in 1 second' : `Next set in ${restCountdown}s`}</p>
            </div>
            <button onClick={stopRestTimer} className="text-white/80 hover:text-white text-xs font-semibold bg-orange-600 px-3 py-1.5 rounded-lg transition-colors">
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setDiscarding(true)}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <span className="text-sm text-gray-400 font-mono">{formatTime(elapsed)}</span>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Workout Title</p>
          <input
            value={workoutName}
            onChange={(e) => setWorkoutName(e.target.value)}
            placeholder="e.g. Monday Push, Leg Day, WOD..."
            className="text-2xl font-semibold text-gray-900 bg-transparent border-b-2 border-gray-200 focus:border-blue-400 outline-none w-full placeholder:text-gray-300"
          />
        </div>
      </div>

      {/* Discard confirm */}
      {discarding && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-red-800">Discard this workout?</p>
          <p className="text-xs text-red-600">All logged sets will be permanently deleted.</p>
          <div className="flex gap-2">
            <button onClick={() => setDiscarding(false)} className="flex-1 border border-red-200 text-red-600 py-2 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors">
              Keep going
            </button>
            <button onClick={discardWorkout} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors">
              Discard
            </button>
          </div>
        </div>
      )}

      {creating && <p className="text-sm text-gray-400 text-center py-2">Setting up workout...</p>}

      {/* Unified item list */}
      {items.map((item, idx) =>
        item.type === 'exercise' ? (
          <ExerciseBlock
            key={item.weId}
            we={item}
            canUp={idx > 0}
            canDown={idx < items.length - 1}
            onMoveUp={() => moveItem(idx, 'up')}
            onMoveDown={() => moveItem(idx, 'down')}
            onAddSet={() => addSet(item.weId)}
            onRemove={() => removeExercise(item.weId)}
            onUpdateSet={(setId, field, val) => updateSet(item.weId, setId, field, val)}
            onToggleComplete={(set) => toggleComplete(item.weId, set)}
            onSetMetrics={(m) => setMetrics(item.weId, m)}
            onToggleRest={() => toggleRest(item.weId)}
            onNoteChange={(note) => setExerciseNote(item.weId, note)}
            onVideoChange={(url) => setItems((prev) => prev.map((i) =>
              i.type === 'exercise' && i.weId === item.weId
                ? { ...i, exercise: { ...i.exercise, video_url: url } }
                : i
            ))}
            canUploadVideo={canUploadVideo}
            onFormVideoChange={(url) => setFormVideoUrl(item.weId, url)}
          />
        ) : (
          <FreestyleBlock
            key={item.id}
            section={item}
            canUp={idx > 0}
            canDown={idx < items.length - 1}
            onMoveUp={() => moveItem(idx, 'up')}
            onMoveDown={() => moveItem(idx, 'down')}
            onChange={(updated) => updateFreestyle(item.id, updated)}
            onRemove={() => removeFreestyle(item.id)}
          />
        )
      )}

      {/* Exercise search */}
      {showSearch && <ExerciseSearch onSelect={addExercise} onClose={() => setShowSearch(false)} />}

      {/* Add menu */}
      {!showSearch && (
        <div className="space-y-2">
          {showAddMenu ? (
            <div className="bg-white rounded-xl border p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Add to workout</p>
              <button
                onClick={() => { setShowAddMenu(false); setShowSearch(true) }}
                disabled={creating || !workoutId}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 text-left"
              >
                <span className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">Ex</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">Exercise</p>
                  <p className="text-xs text-gray-400">Search 800+ exercises with video demos</p>
                </div>
              </button>
              <button
                onClick={addFreestyleSection}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left"
              >
                <span className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-sm flex-shrink-0">§</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">Section</p>
                  <p className="text-xs text-gray-400">Notes, score logging, and exercise demo</p>
                </div>
              </button>
              <button onClick={() => setShowAddMenu(false)} className="w-full text-center text-sm text-gray-400 py-1 hover:text-gray-600">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddMenu(true)}
              disabled={creating || !workoutId}
              className="w-full border-2 border-dashed border-gray-200 rounded-xl py-4 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {creating ? 'Setting up...' : '+ Add Exercise or Section'}
            </button>
          )}
        </div>
      )}

      {/* Finish bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-3 flex items-center justify-between z-10">
        <p className="text-sm text-gray-500">
          {exercises.length} exercise{exercises.length !== 1 ? 's' : ''} · {completedSets} sets done
        </p>
        <button
          onClick={finishWorkout}
          disabled={finishing || !workoutId}
          className="bg-green-600 text-white px-6 py-2 rounded-xl font-semibold text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {finishing ? 'Saving...' : 'Finish Workout'}
        </button>
      </div>
    </div>
  )
}
