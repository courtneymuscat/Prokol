'use client'

import { useState, useEffect, useCallback } from 'react'

type Exercise = {
  id: string
  name: string
  category: string
  equipment: string
  muscles: string | null
  video_url: string | null
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

function VideoRow({ ex, onSaved }: { ex: Exercise; onSaved: (id: string, url: string | null) => void }) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState(ex.video_url ?? '')
  const [saving, setSaving] = useState(false)
  const [previewing, setPreviewing] = useState(false)

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/exercises/${ex.id}/video`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_url: input }),
    })
    setSaving(false)
    if (res.ok) {
      onSaved(ex.id, input.trim() || null)
      setEditing(false)
    }
  }

  return (
    <>
      {previewing && ex.video_url && (
        <VideoPreview url={ex.video_url} name={ex.name} onClose={() => setPreviewing(false)} />
      )}
      <div className="flex items-center gap-3 bg-white rounded-xl border px-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{ex.name}</p>
          <p className="text-xs text-gray-400 capitalize">{ex.category} · {ex.equipment}{ex.muscles ? ` · ${ex.muscles}` : ''}</p>
        </div>

        {editing ? (
          <div className="flex items-center gap-2 flex-shrink-0">
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="w-64 text-xs border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs font-semibold bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
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
              onClick={() => { setInput(ex.video_url ?? ''); setEditing(true) }}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors"
            >
              {ex.video_url ? 'Edit' : '+ Add URL'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

export default function CoachExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [filter, setFilter] = useState<'all' | 'with' | 'without'>('all')
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 30

  const fetchExercises = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) })
    if (query.trim().length >= 2) params.set('q', query.trim())
    if (category !== 'all') params.set('category', category)
    if (filter === 'with') params.set('has_video', 'true')
    if (filter === 'without') params.set('has_video', 'false')
    const res = await fetch(`/api/exercises/library?${params}`)
    const data = await res.json()
    setExercises(data)
    setLoading(false)
  }, [query, category, filter, page])

  useEffect(() => { setPage(0) }, [query, category, filter])
  useEffect(() => { fetchExercises() }, [fetchExercises])

  function handleSaved(id: string, url: string | null) {
    setExercises((prev) => prev.map((e) => e.id === id ? { ...e, video_url: url } : e))
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-lg font-bold text-gray-900">Exercise Library</h1>
        <p className="text-xs text-gray-400 mt-0.5">Add YouTube demo videos to exercises so clients can see proper form.</p>
      </div>

      <main className="flex-1 p-6 space-y-4 max-w-4xl w-full mx-auto">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises..."
            className="flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <div className="flex gap-2">
            {(['all', 'with', 'without'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  filter === f ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f === 'all' ? 'All' : f === 'with' ? 'Has video' : 'No video'}
              </button>
            ))}
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

        {/* List */}
        {loading ? (
          <div className="text-center text-sm text-gray-400 py-12">Loading exercises…</div>
        ) : exercises.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-12">No exercises found.</div>
        ) : (
          <div className="space-y-2">
            {exercises.map((ex) => (
              <VideoRow key={ex.id} ex={ex} onSaved={handleSaved} />
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
            <span className="text-xs text-gray-400">Page {page + 1}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={exercises.length < PAGE_SIZE}
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
