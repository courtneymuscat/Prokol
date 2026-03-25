'use client'

import { useState, useEffect, useRef } from 'react'

export type Exercise = {
  id: string
  name: string
  category: string
  equipment: string
  muscles?: string
  video_url?: string | null
}

const CATEGORIES = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio']

function getYouTubeId(url: string) {
  return url.match(/[?&]v=([^&]+)/)?.[1] ?? null
}

function VideoModal({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  const videoId = getYouTubeId(url)
  if (!videoId) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg mx-4 bg-black rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-gray-900">
          <p className="text-white text-sm font-semibold truncate">{name}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none ml-3">
            ✕
          </button>
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

type Props = {
  onSelect: (exercise: Exercise) => void
  onClose: () => void
}

export default function ExerciseSearch({ onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Exercise[]>([])
  const [recent, setRecent] = useState<Exercise[]>([])
  const [category, setCategory] = useState('all')
  const [previewEx, setPreviewEx] = useState<Exercise | null>(null)
  const [creating, setCreating] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createCategory, setCreateCategory] = useState('other')
  const [createEquipment, setCreateEquipment] = useState('bodyweight')
  const [createSaving, setCreateSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    fetch('/api/exercises/recent')
      .then((r) => r.json())
      .then(setRecent)
  }, [])

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({ q: query })
      if (category !== 'all') params.set('category', category)
      const res = await fetch(`/api/exercises/search?${params}`)
      setResults(await res.json())
    }, 250)
    return () => clearTimeout(timer)
  }, [query, category])

  async function handleCreate() {
    if (!createName.trim()) return
    setCreateSaving(true)
    const res = await fetch('/api/exercises/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: createName, category: createCategory, equipment: createEquipment }),
    })
    setCreateSaving(false)
    if (res.ok) {
      const ex = await res.json()
      onSelect(ex)
    }
  }

  const list = query.length >= 2 ? results : recent
  const isRecent = query.length < 2

  return (
    <>
      {previewEx?.video_url && (
        <VideoModal
          url={previewEx.video_url}
          name={previewEx.name}
          onClose={() => setPreviewEx(null)}
        />
      )}

      <div className="bg-white rounded-xl border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises..."
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg px-1">
            ✕
          </button>
        </div>

        {/* Category filter */}
        <div className="flex gap-1.5 flex-wrap">
          {['all', ...CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                category === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="max-h-64 overflow-y-auto space-y-0.5">
          {isRecent && recent.length > 0 && (
            <p className="text-xs text-gray-400 font-medium px-3 pb-1">Recently used</p>
          )}
          {list.length === 0 && query.length >= 2 && !creating && (
            <div className="text-center py-4 space-y-2">
              <p className="text-sm text-gray-400">No exercises found</p>
              <button
                onClick={() => { setCreateName(query); setCreating(true) }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
              >
                + Create &quot;{query}&quot;
              </button>
            </div>
          )}
          {creating && (
            <div className="p-3 space-y-2 border rounded-xl bg-gray-50">
              <p className="text-xs font-semibold text-gray-700">New exercise</p>
              <input
                autoFocus
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Exercise name"
                className="w-full border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <div className="flex gap-2">
                <select
                  value={createCategory}
                  onChange={(e) => setCreateCategory(e.target.value)}
                  className="flex-1 border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {CATEGORIES.filter(c => c !== 'all').map(c => (
                    <option key={c} value={c} className="capitalize">{c}</option>
                  ))}
                  <option value="other">other</option>
                </select>
                <select
                  value={createEquipment}
                  onChange={(e) => setCreateEquipment(e.target.value)}
                  className="flex-1 border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {['bodyweight','barbell','dumbbell','machine','cable','kettlebell','bands','other'].map(e => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={createSaving || !createName.trim()}
                  className="flex-1 bg-blue-600 text-white text-xs font-semibold py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {createSaving ? 'Creating…' : 'Add to workout'}
                </button>
                <button onClick={() => setCreating(false)} className="text-xs text-gray-400 hover:text-gray-600 px-2">
                  Cancel
                </button>
              </div>
            </div>
          )}
          {list.length === 0 && query.length < 2 && (
            <p className="text-sm text-gray-400 text-center py-4">Type to search 800+ exercises</p>
          )}
          {list.map((ex) => (
            <div key={ex.id} className="flex items-center gap-1 rounded-lg hover:bg-gray-50 transition-colors">
              <button
                onClick={() => onSelect(ex)}
                className="flex-1 text-left px-3 py-2.5"
              >
                <p className="text-sm font-medium text-gray-900">{ex.name}</p>
                <p className="text-xs text-gray-400 capitalize">
                  {ex.category} · {ex.equipment}
                  {ex.muscles ? ` · ${ex.muscles}` : ''}
                </p>
              </button>
              {ex.video_url && (
                <button
                  onClick={() => setPreviewEx(ex)}
                  title="Watch demo"
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 transition-colors mr-2"
                >
                  <svg className="w-3.5 h-3.5 text-red-600 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
