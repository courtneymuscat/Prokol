'use client'

import { useState, useEffect, useCallback } from 'react'

type Exercise = {
  id: string
  name: string
  category: string
  equipment: string
  muscles: string | null
  video_url: string | null
  how_to: string | null
}

const CATEGORIES = ['all', 'chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio']

function getYouTubeId(url: string) {
  return url.match(/(?:[?&]v=|youtu\.be\/)([^&\s]+)/)?.[1] ?? null
}

function VideoPreview({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  const videoId = getYouTubeId(url)
  if (!videoId) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="w-full max-w-lg mx-4 bg-black rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 bg-gray-900">
          <p className="text-white text-sm font-semibold truncate">{name}</p>
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

function ExerciseRow({ ex, onSavedVideo, onSavedHowTo }: {
  ex: Exercise
  onSavedVideo: (id: string, url: string | null) => void
  onSavedHowTo: (id: string, text: string | null) => void
}) {
  const [editingVideo, setEditingVideo] = useState(false)
  const [videoInput, setVideoInput] = useState(ex.video_url ?? '')
  const [savingVideo, setSavingVideo] = useState(false)
  const [previewing, setPreviewing] = useState(false)

  const [showHowTo, setShowHowTo] = useState(false)
  const [editingHowTo, setEditingHowTo] = useState(false)
  const [howToInput, setHowToInput] = useState(ex.how_to ?? '')
  const [savingHowTo, setSavingHowTo] = useState(false)

  async function handleSaveVideo() {
    setSavingVideo(true)
    const res = await fetch(`/api/exercises/${ex.id}/video`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_url: videoInput }),
    })
    setSavingVideo(false)
    if (res.ok) {
      onSavedVideo(ex.id, videoInput.trim() || null)
      setEditingVideo(false)
    }
  }

  async function handleSaveHowTo() {
    setSavingHowTo(true)
    // global: false — manual coach edit saves to their own override table only
    const res = await fetch('/api/exercises/auto-how-to', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exercise_id: ex.id, how_to: howToInput, global: false }),
    })
    setSavingHowTo(false)
    if (res.ok) {
      onSavedHowTo(ex.id, howToInput.trim() || null)
      setEditingHowTo(false)
    }
  }

  return (
    <>
      {previewing && ex.video_url && (
        <VideoPreview url={ex.video_url} name={ex.name} onClose={() => setPreviewing(false)} />
      )}
      <div className="bg-white rounded-xl border divide-y divide-gray-100">
        {/* Main row */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">{ex.name}</p>
            <p className="text-xs text-gray-400 capitalize">{ex.category} · {ex.equipment}{ex.muscles ? ` · ${ex.muscles}` : ''}</p>
          </div>

          {/* How-to toggle */}
          <button
            onClick={() => { setShowHowTo(!showHowTo); if (!showHowTo) setEditingHowTo(false) }}
            className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${
              ex.how_to
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : 'text-gray-400 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {ex.how_to ? 'How-to' : 'Add how-to'}
          </button>

          {/* Video section */}
          {editingVideo ? (
            <div className="flex items-center gap-2 flex-shrink-0">
              <input
                autoFocus
                value={videoInput}
                onChange={(e) => setVideoInput(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="w-64 text-xs border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveVideo(); if (e.key === 'Escape') setEditingVideo(false) }}
              />
              <button
                onClick={handleSaveVideo}
                disabled={savingVideo}
                className="text-xs font-semibold bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {savingVideo ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditingVideo(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-shrink-0">
              {ex.video_url ? (
                <>
                  <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">Video added</span>
                  <button
                    onClick={() => setPreviewing(true)}
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 transition-colors"
                    title="Preview video"
                  >
                    <svg className="w-3 h-3 text-red-600 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                </>
              ) : (
                <span className="text-xs text-gray-400">No video</span>
              )}
              <button
                onClick={() => { setVideoInput(ex.video_url ?? ''); setEditingVideo(true) }}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors"
              >
                {ex.video_url ? 'Edit' : '+ Add URL'}
              </button>
            </div>
          )}
        </div>

        {/* How-to panel */}
        {showHowTo && (
          <div className="px-4 py-3 bg-gray-50/60">
            {editingHowTo ? (
              <div className="space-y-2">
                <textarea
                  autoFocus
                  value={howToInput}
                  onChange={(e) => setHowToInput(e.target.value)}
                  rows={6}
                  placeholder="1. Setup and start position…&#10;2. The movement…&#10;3. Key cues…"
                  className="w-full text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white leading-relaxed"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveHowTo}
                    disabled={savingHowTo}
                    className="text-xs font-semibold bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingHowTo ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setEditingHowTo(false); setHowToInput(ex.how_to ?? '') }}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {ex.how_to ? (
                  <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">{ex.how_to}</p>
                ) : (
                  <p className="text-xs text-gray-400 italic">No how-to guide yet.</p>
                )}
                <button
                  onClick={() => { setHowToInput(ex.how_to ?? ''); setEditingHowTo(true) }}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800"
                >
                  {ex.how_to ? 'Edit guide' : '+ Write guide'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

type AutoResult = { id: string; name: string; url: string | null }
type AutoHowToResult = { id: string; name: string; how_to: string | null }
type AutoState = 'idle' | 'searching' | 'reviewing' | 'done'

function getYouTubeThumbnail(url: string) {
  const id = getYouTubeId(url)
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null
}

export default function CoachExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [totalExercises, setTotalExercises] = useState(0)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [filter, setFilter] = useState<'all' | 'with' | 'without'>('all')
  const [howToFilter, setHowToFilter] = useState<'all' | 'with' | 'without'>('all')
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 30

  // Video auto-fill state
  const [autoState, setAutoState] = useState<AutoState>('idle')
  const [autoResults, setAutoResults] = useState<AutoResult[]>([])
  const [autoProgress, setAutoProgress] = useState({ done: 0, total: 0 })
  const [savingId, setSavingId] = useState<string | null>(null)

  // How-to auto-generate state
  const [howToAutoState, setHowToAutoState] = useState<AutoState>('idle')
  const [howToResults, setHowToResults] = useState<AutoHowToResult[]>([])
  const [howToProgress, setHowToProgress] = useState({ done: 0, total: 0 })
  const [savingHowToId, setSavingHowToId] = useState<string | null>(null)
  // editable drafts while reviewing
  const [howToDrafts, setHowToDrafts] = useState<Record<string, string>>({})

  const fetchExercises = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) })
    if (query.trim().length >= 2) params.set('q', query.trim())
    if (category !== 'all') params.set('category', category)
    if (filter === 'with') params.set('has_video', 'true')
    if (filter === 'without') params.set('has_video', 'false')
    if (howToFilter === 'with') params.set('has_how_to', 'true')
    if (howToFilter === 'without') params.set('has_how_to', 'false')
    const res = await fetch(`/api/exercises/library?${params}`)
    const data = await res.json()
    setExercises(data.exercises ?? data)
    setTotalExercises(data.total ?? data.exercises?.length ?? data.length ?? 0)
    setLoading(false)
  }, [query, category, filter, howToFilter, page])

  useEffect(() => { setPage(0) }, [query, category, filter, howToFilter])
  useEffect(() => { fetchExercises() }, [fetchExercises])

  const visibleExercises = exercises

  function handleSavedVideo(id: string, url: string | null) {
    setExercises((prev) => prev.map((e) => e.id === id ? { ...e, video_url: url } : e))
  }

  function handleSavedHowTo(id: string, text: string | null) {
    setExercises((prev) => prev.map((e) => e.id === id ? { ...e, how_to: text } : e))
  }

  async function startAutoFill() {
    const res = await fetch('/api/exercises/library?has_video=false&limit=100&offset=0')
    const raw = await res.json()
    const noVideo: Exercise[] = raw.exercises ?? raw
    if (!noVideo.length) { alert('All exercises already have videos!'); return }

    setAutoState('searching')
    setAutoResults([])
    setAutoProgress({ done: 0, total: noVideo.length })

    const BATCH = 5
    const all: AutoResult[] = []
    for (let i = 0; i < noVideo.length; i += BATCH) {
      const batch = noVideo.slice(i, i + BATCH)
      const r = await fetch('/api/exercises/auto-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exercise_ids: batch.map(e => e.id) }),
      })
      const { results } = await r.json()
      all.push(...(results ?? []))
      setAutoProgress({ done: Math.min(i + BATCH, noVideo.length), total: noVideo.length })
    }

    setAutoResults(all.filter(r => r.url))
    setAutoState('reviewing')
  }

  async function approveVideo(result: AutoResult) {
    setSavingId(result.id)
    const res = await fetch('/api/exercises/auto-videos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exercise_id: result.id, video_url: result.url }),
    })
    if (res.ok) {
      setExercises(prev => prev.map(e => e.id === result.id ? { ...e, video_url: result.url } : e))
      setAutoResults(prev => prev.filter(r => r.id !== result.id))
    } else {
      const d = await res.json()
      alert(`Failed to save ${result.name}: ${d.error ?? res.status}`)
    }
    setSavingId(null)
  }

  function skipVideo(id: string) {
    setAutoResults(prev => prev.filter(r => r.id !== id))
  }

  async function approveAll() {
    let saved = 0, failed = 0
    for (const result of autoResults) {
      setSavingId(result.id)
      const res = await fetch('/api/exercises/auto-videos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exercise_id: result.id, video_url: result.url }),
      })
      if (res.ok) {
        saved++
        setExercises(prev => prev.map(e => e.id === result.id ? { ...e, video_url: result.url } : e))
      } else {
        failed++
      }
    }
    setSavingId(null)
    setAutoResults([])
    setAutoState('idle')
    fetchExercises()
    if (failed > 0) alert(`${saved} videos saved. ${failed} failed — check console.`)
  }

  async function startAutoHowTo() {
    const res = await fetch('/api/exercises/library?limit=100&offset=0')
    const raw = await res.json()
    const all: Exercise[] = raw.exercises ?? raw
    const noHowTo = all.filter(e => !e.how_to)
    if (!noHowTo.length) { alert('All exercises already have how-to guides!'); return }

    setHowToAutoState('searching')
    setHowToResults([])
    setHowToProgress({ done: 0, total: noHowTo.length })

    const BATCH = 10
    const generated: AutoHowToResult[] = []
    for (let i = 0; i < noHowTo.length; i += BATCH) {
      const batch = noHowTo.slice(i, i + BATCH)
      const r = await fetch('/api/exercises/auto-how-to', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exercise_ids: batch.map(e => e.id) }),
      })
      const { results } = await r.json()
      generated.push(...(results ?? []))
      setHowToProgress({ done: Math.min(i + BATCH, noHowTo.length), total: noHowTo.length })
    }

    const withContent = generated.filter(r => r.how_to)
    if (!withContent.length) {
      setHowToAutoState('idle')
      alert('AI generation returned no results. Check that OPENAI_API_KEY is set and try again.')
      return
    }
    const drafts: Record<string, string> = {}
    withContent.forEach(r => { drafts[r.id] = r.how_to ?? '' })
    setHowToResults(withContent)
    setHowToDrafts(drafts)
    setHowToAutoState('reviewing')
  }

  async function approveHowTo(result: AutoHowToResult) {
    const text = howToDrafts[result.id] ?? result.how_to ?? ''
    setSavingHowToId(result.id)
    // global: true — approved auto-generated guide saves to shared exercises table
    const res = await fetch('/api/exercises/auto-how-to', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exercise_id: result.id, how_to: text, global: true }),
    })
    if (res.ok) {
      setExercises(prev => prev.map(e => e.id === result.id ? { ...e, how_to: text } : e))
      setHowToResults(prev => prev.filter(r => r.id !== result.id))
    } else {
      const d = await res.json()
      alert(`Failed to save ${result.name}: ${d.error ?? res.status}`)
    }
    setSavingHowToId(null)
  }

  function skipHowTo(id: string) {
    setHowToResults(prev => prev.filter(r => r.id !== id))
  }

  async function approveAllHowTo() {
    let saved = 0, failed = 0
    for (const result of howToResults) {
      const text = howToDrafts[result.id] ?? result.how_to ?? ''
      setSavingHowToId(result.id)
      // global: true — saving to shared exercises table
      const res = await fetch('/api/exercises/auto-how-to', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exercise_id: result.id, how_to: text, global: true }),
      })
      if (res.ok) {
        saved++
        setExercises(prev => prev.map(e => e.id === result.id ? { ...e, how_to: text } : e))
      } else {
        failed++
      }
    }
    setSavingHowToId(null)
    setHowToResults([])
    setHowToFilter('all')
    setHowToAutoState(saved > 0 ? 'done' : 'idle')
    if (failed > 0) alert(`${saved} guides saved. ${failed} failed — check console for details.`)
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Exercise Library</h1>
          <p className="text-xs text-gray-400 mt-0.5">Add YouTube demo videos and how-to guides so clients know exactly how to perform each movement.</p>
        </div>
        <div className="flex items-center gap-2">
          {howToAutoState === 'idle' && autoState === 'idle' && (
            <button
              onClick={startAutoHowTo}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors bg-violet-600 hover:bg-violet-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Auto-generate how-to
            </button>
          )}
          {autoState === 'idle' && howToAutoState === 'idle' && (
            <button
              onClick={startAutoFill}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors"
              style={{ backgroundColor: '#1D9E75' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Auto-fill videos
            </button>
          )}
        </div>
      </div>

      <main className="flex-1 p-6 space-y-4 w-full">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises..."
            className="flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <div className="flex gap-2 flex-wrap">
            <div className="flex gap-1.5">
              {(['all', 'with', 'without'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                    filter === f ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {f === 'all' ? 'All videos' : f === 'with' ? 'Has video' : 'No video'}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              {(['all', 'with', 'without'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setHowToFilter(f)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                    howToFilter === f ? 'bg-violet-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {f === 'all' ? 'All guides' : f === 'with' ? 'Has guide' : 'No guide'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                category === cat ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* How-to auto-generate progress */}
        {howToAutoState === 'searching' && (
          <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin flex-shrink-0" />
              <p className="text-sm font-semibold text-violet-800">
                Generating guides with AI… {howToProgress.done} / {howToProgress.total} exercises
              </p>
            </div>
            <div className="w-full bg-violet-100 rounded-full h-2">
              <div
                className="bg-violet-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${howToProgress.total > 0 ? (howToProgress.done / howToProgress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* How-to review panel */}
        {howToAutoState === 'reviewing' && howToResults.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-sm font-bold text-gray-900">Review generated how-to guides</p>
                <p className="text-xs text-gray-400 mt-0.5">{howToResults.length} guides generated — edit if needed, then approve or skip</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setHowToAutoState('idle'); setHowToResults([]); setHowToFilter('all') }}
                  className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200"
                >
                  Dismiss all
                </button>
                <button
                  onClick={approveAllHowTo}
                  disabled={!!savingHowToId}
                  className="text-xs font-semibold text-white px-4 py-1.5 rounded-lg disabled:opacity-50 transition-colors bg-violet-600 hover:bg-violet-700"
                >
                  {savingHowToId ? 'Saving…' : `Approve all (${howToResults.length})`}
                </button>
              </div>
            </div>
            <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
              {howToResults.map(result => (
                <div key={result.id} className="px-5 py-4 space-y-2">
                  <p className="text-sm font-semibold text-gray-900">{result.name}</p>
                  <textarea
                    value={howToDrafts[result.id] ?? result.how_to ?? ''}
                    onChange={(e) => setHowToDrafts(prev => ({ ...prev, [result.id]: e.target.value }))}
                    rows={5}
                    className="w-full text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 leading-relaxed"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => skipHowTo(result.id)}
                      className="text-xs border border-gray-200 text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                    >
                      Skip
                    </button>
                    <button
                      onClick={() => approveHowTo(result)}
                      disabled={savingHowToId === result.id}
                      className="text-xs font-semibold text-white px-4 py-1.5 rounded-lg disabled:opacity-50 transition-colors bg-violet-600 hover:bg-violet-700"
                    >
                      {savingHowToId === result.id ? 'Saving…' : '✓ Approve'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {howToAutoState === 'done' && (
          <div className="bg-violet-50 border border-violet-200 rounded-2xl px-5 py-4 flex items-center gap-3">
            <span className="text-violet-600 text-lg">✓</span>
            <div>
              <p className="text-sm font-semibold text-violet-800">All done! Guides saved.</p>
              <button onClick={() => { setHowToAutoState('idle'); setHowToFilter('all') }} className="text-xs text-violet-600 hover:underline">Close</button>
            </div>
          </div>
        )}

        {/* Video auto-fill progress */}
        {autoState === 'searching' && (
          <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-teal-500 border-t-transparent animate-spin flex-shrink-0" />
              <p className="text-sm font-semibold text-teal-800">
                Searching YouTube… {autoProgress.done} / {autoProgress.total} exercises
              </p>
            </div>
            <div className="w-full bg-teal-100 rounded-full h-2">
              <div
                className="bg-teal-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${autoProgress.total > 0 ? (autoProgress.done / autoProgress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs text-teal-600">Using 100 YouTube API units per batch — free quota: 100 searches/day</p>
          </div>
        )}

        {/* Video review panel */}
        {autoState === 'reviewing' && autoResults.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-sm font-bold text-gray-900">Review suggested videos</p>
                <p className="text-xs text-gray-400 mt-0.5">{autoResults.length} videos found — approve or skip each one</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setAutoState('idle'); setAutoResults([]) }}
                  className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200"
                >
                  Dismiss all
                </button>
                <button
                  onClick={approveAll}
                  disabled={!!savingId}
                  className="text-xs font-semibold text-white px-4 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                  style={{ backgroundColor: '#1D9E75' }}
                >
                  {savingId ? 'Saving…' : `Approve all (${autoResults.length})`}
                </button>
              </div>
            </div>
            <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
              {autoResults.map(result => {
                const thumb = getYouTubeThumbnail(result.url!)
                return (
                  <div key={result.id} className="flex items-center gap-4 px-5 py-4">
                    {thumb && (
                      <a href={result.url!} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                        <img src={thumb} alt={result.name} className="w-28 h-16 object-cover rounded-lg border border-gray-100" />
                      </a>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{result.name}</p>
                      <a
                        href={result.url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline truncate block"
                      >
                        {result.url}
                      </a>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => skipVideo(result.id)}
                        className="text-xs border border-gray-200 text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                      >
                        Skip
                      </button>
                      <button
                        onClick={() => approveVideo(result)}
                        disabled={savingId === result.id}
                        className="text-xs font-semibold text-white px-4 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                        style={{ backgroundColor: '#1D9E75' }}
                      >
                        {savingId === result.id ? 'Saving…' : '✓ Approve'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {autoState === 'reviewing' && autoResults.length === 0 && (
          <div className="bg-teal-50 border border-teal-200 rounded-2xl px-5 py-4 flex items-center gap-3">
            <span className="text-teal-600 text-lg">✓</span>
            <div>
              <p className="text-sm font-semibold text-teal-800">All done! Videos saved.</p>
              <button onClick={() => { setAutoState('idle'); fetchExercises() }} className="text-xs text-teal-600 hover:underline">Close</button>
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="text-center text-sm text-gray-400 py-12">Loading exercises…</div>
        ) : visibleExercises.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-12">No exercises found.</div>
        ) : (
          <div className="space-y-2">
            {visibleExercises.map((ex) => (
              <ExerciseRow key={ex.id} ex={ex} onSavedVideo={handleSavedVideo} onSavedHowTo={handleSavedHowTo} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && exercises.length > 0 && (
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="text-sm text-gray-500 hover:text-gray-800 disabled:opacity-30"
            >
              ← Previous
            </button>
            <span className="text-xs text-gray-400">
              Page {page + 1} of {Math.max(1, Math.ceil(totalExercises / PAGE_SIZE))}
              <span className="text-gray-300 ml-1">({totalExercises} total)</span>
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= Math.ceil(totalExercises / PAGE_SIZE) - 1}
              className="text-sm text-gray-500 hover:text-gray-800 disabled:opacity-30"
            >
              Next →
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
