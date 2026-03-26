'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Types ──────────────────────────────────────────────────────────────────
type Category = 'front' | 'back' | 'side_left' | 'side_right'

type ProgressPhoto = {
  id: string
  storage_path: string
  taken_at: string
  category: Category
  notes: string | null
  weight_kg: number | null
  url: string
}

const CATEGORIES: { value: Category; label: string; short: string }[] = [
  { value: 'front',      label: 'Front',       short: 'F' },
  { value: 'back',       label: 'Back',        short: 'B' },
  { value: 'side_left',  label: 'Left Side',   short: 'L' },
  { value: 'side_right', label: 'Right Side',  short: 'R' },
]

const CAT_COLORS: Record<Category, string> = {
  front:      'bg-blue-100 text-blue-700',
  back:       'bg-purple-100 text-purple-700',
  side_left:  'bg-teal-100 text-teal-700',
  side_right: 'bg-orange-100 text-orange-700',
}

function catLabel(c: Category) { return CATEGORIES.find(x => x.value === c)?.label ?? c }

function fmtDate(d: string) {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtMonth(d: string) {
  const [y, m] = d.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
}

// ── X button ──────────────────────────────────────────────────────────────
function CloseBtn({ onClick, className = '' }: { onClick: () => void; className?: string }) {
  return (
    <button onClick={onClick} className={`flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors ${className}`}>
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  )
}

// ── Upload Modal ───────────────────────────────────────────────────────────
function UploadModal({ onClose, onUploaded }: {
  onClose: () => void
  onUploaded: (photo: ProgressPhoto) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [category, setCategory] = useState<Category>('front')
  const [weightKg, setWeightKg] = useState('')
  const [notes, setNotes] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setError(null)

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Not signed in'); setUploading(false); return }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('progress-photos')
      .upload(path, file, { contentType: file.type })

    if (uploadErr) { setError(uploadErr.message); setUploading(false); return }

    const { data: row, error: insertErr } = await supabase
      .from('progress_photos')
      .insert({
        user_id: session.user.id,
        storage_path: path,
        taken_at: date,
        category,
        notes: notes.trim() || null,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
      })
      .select('id, storage_path, taken_at, category, notes, weight_kg')
      .single()

    if (insertErr) { setError(insertErr.message); setUploading(false); return }

    const { data: signed } = await supabase.storage.from('progress-photos').createSignedUrl(path, 3600)

    onUploaded({ ...row, url: signed?.signedUrl ?? '' })
    setUploading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[92vh] flex flex-col shadow-2xl">

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <p className="text-base font-bold text-gray-900">Add progress photo</p>
          <CloseBtn onClick={onClose} />
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Photo picker */}
          {preview ? (
            <div className="relative">
              <img src={preview} alt="Preview" className="w-full max-h-72 object-cover rounded-2xl" />
              <button onClick={() => { setFile(null); setPreview(null) }}
                className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()}
              className="w-full h-48 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-gray-300 transition-colors text-gray-400">
              <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-sm font-medium">Choose or take photo</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />

          {/* Date */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>

          {/* Position */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Position</label>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map(c => (
                <button key={c.value} type="button" onClick={() => setCategory(c.value)}
                  className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                    category === c.value ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'
                  }`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Weight (optional) */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
              Weight (kg) <span className="font-normal text-gray-400 normal-case">— optional</span>
            </label>
            <input type="number" step="0.1" min="30" max="300" value={weightKg}
              onChange={e => setWeightKg(e.target.value)} placeholder="e.g. 72.5"
              className="w-32 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
              Notes <span className="font-normal text-gray-400 normal-case">— optional</span>
            </label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Week 8 of cut, feeling lean"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
        </div>

        <div className="flex-shrink-0 p-4 border-t border-gray-100">
          <button onClick={handleUpload} disabled={!file || uploading}
            className="w-full py-3 rounded-2xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-gray-900"
            style={{ backgroundColor: '#FFD885' }}>
            {uploading ? 'Uploading…' : 'Save photo'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Photo detail modal ────────────────────────────────────────────────────
function PhotoDetailModal({ photo, onClose, onDelete }: {
  photo: ProgressPhoto
  onClose: () => void
  onDelete: (id: string) => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    const supabase = createClient()
    await supabase.storage.from('progress-photos').remove([photo.storage_path])
    await supabase.from('progress_photos').delete().eq('id', photo.id)
    onDelete(photo.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/85" />
      <div className="relative w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
        <img src={photo.url} alt={catLabel(photo.category)}
          className="w-full max-h-[75vh] object-contain rounded-2xl" />

        {/* Info overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent rounded-b-2xl p-5">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-white font-bold text-base">{fmtDate(photo.taken_at)}</p>
              <p className="text-white/70 text-sm mt-0.5">
                {catLabel(photo.category)}{photo.weight_kg ? ` · ${photo.weight_kg}kg` : ''}
              </p>
              {photo.notes && <p className="text-white/60 text-xs mt-1">{photo.notes}</p>}
            </div>

            {!confirming ? (
              <button onClick={() => setConfirming(true)}
                className="flex-shrink-0 text-xs text-red-400 hover:text-red-300 font-medium bg-black/40 px-3 py-1.5 rounded-lg transition-colors">
                Delete
              </button>
            ) : (
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => setConfirming(false)}
                  className="text-xs text-white/70 hover:text-white font-medium bg-black/40 px-3 py-1.5 rounded-lg transition-colors">
                  Cancel
                </button>
                <button onClick={handleDelete} disabled={deleting}
                  className="text-xs text-white font-semibold bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                  {deleting ? '…' : 'Confirm'}
                </button>
              </div>
            )}
          </div>
        </div>

        <button onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ── Photo picker modal (for compare) ──────────────────────────────────────
function PickPhotoModal({ photos, onPick, onClose }: {
  photos: ProgressPhoto[]
  onPick: (photo: ProgressPhoto) => void
  onClose: () => void
}) {
  const [filter, setFilter] = useState<Category | 'all'>('all')
  const filtered = filter === 'all' ? photos : photos.filter(p => p.category === filter)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl w-full max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <p className="font-bold text-gray-900">Select photo</p>
          <CloseBtn onClick={onClose} />
        </div>

        <div className="flex gap-2 px-5 py-3 border-b border-gray-50 flex-shrink-0 overflow-x-auto">
          {(['all', ...CATEGORIES.map(c => c.value)] as (Category | 'all')[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                filter === f ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'
              }`}>
              {f === 'all' ? 'All' : catLabel(f)}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No photos in this category</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {filtered.map(photo => (
                <button key={photo.id} onClick={() => { onPick(photo); onClose() }}
                  className="aspect-[3/4] rounded-xl overflow-hidden relative group">
                  <img src={photo.url} alt={catLabel(photo.category)} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  <div className="absolute top-1.5 left-1.5">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${CAT_COLORS[photo.category]}`}>
                      {catLabel(photo.category).charAt(0)}
                    </span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                    <p className="text-white text-xs font-medium leading-tight">{fmtDate(photo.taken_at)}</p>
                    {photo.weight_kg && <p className="text-white/70 text-xs">{photo.weight_kg}kg</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Compare panel ─────────────────────────────────────────────────────────
function ComparePanel({ label, photo, onSelect }: {
  label: string
  photo: ProgressPhoto | null
  onSelect: () => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-gray-500 text-center uppercase tracking-wide">{label}</p>
      <button onClick={onSelect}
        className={`w-full aspect-[3/4] rounded-xl overflow-hidden relative group ${
          !photo ? 'border-2 border-dashed border-gray-200 hover:border-gray-300 bg-gray-50' : ''
        }`}>
        {photo ? (
          <>
            <img src={photo.url} alt={catLabel(photo.category)} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-semibold bg-black/50 px-3 py-1.5 rounded-lg transition-opacity">
                Change
              </span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 to-transparent p-3">
              <p className="text-white text-xs font-bold">{fmtDate(photo.taken_at)}</p>
              <p className="text-white/70 text-xs">
                {catLabel(photo.category)}{photo.weight_kg ? ` · ${photo.weight_kg}kg` : ''}
              </p>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-400">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-xs font-medium">Select photo</span>
          </div>
        )}
      </button>
    </div>
  )
}

// ── Main ProgressPhotos component ─────────────────────────────────────────
export default function ProgressPhotos({ canCompare = false }: { canCompare?: boolean }) {
  const [photos, setPhotos] = useState<ProgressPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const [compareLeft, setCompareLeft] = useState<ProgressPhoto | null>(null)
  const [compareRight, setCompareRight] = useState<ProgressPhoto | null>(null)
  const [pickingFor, setPickingFor] = useState<'left' | 'right' | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<ProgressPhoto | null>(null)
  const [filterCat, setFilterCat] = useState<Category | 'all'>('all')

  const fetchPhotos = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }

    const { data: rows } = await supabase
      .from('progress_photos')
      .select('id, storage_path, taken_at, category, notes, weight_kg')
      .eq('user_id', session.user.id)
      .order('taken_at', { ascending: false })

    if (!rows?.length) { setPhotos([]); setLoading(false); return }

    const { data: signedList } = await supabase.storage
      .from('progress-photos')
      .createSignedUrls(rows.map(r => r.storage_path), 3600)

    const urlMap: Record<string, string> = {}
    for (const s of signedList ?? []) {
      if (s.signedUrl && s.path) urlMap[s.path] = s.signedUrl
    }

    setPhotos(rows.map(r => ({ ...r, url: urlMap[r.storage_path] ?? '' })))
    setLoading(false)
  }, [])

  useEffect(() => { fetchPhotos() }, [fetchPhotos])

  function handleUploaded(photo: ProgressPhoto) {
    setPhotos(prev => [photo, ...prev])
  }

  function handleDeleted(id: string) {
    setPhotos(prev => prev.filter(p => p.id !== id))
    if (compareLeft?.id === id) setCompareLeft(null)
    if (compareRight?.id === id) setCompareRight(null)
  }

  const filtered = filterCat === 'all' ? photos : photos.filter(p => p.category === filterCat)

  // Group by month (YYYY-MM)
  const grouped = filtered.reduce<Record<string, ProgressPhoto[]>>((acc, p) => {
    const m = p.taken_at.slice(0, 7)
    ;(acc[m] ??= []).push(p)
    return acc
  }, {})

  // Weight delta for compare
  const weightDelta = compareLeft?.weight_kg && compareRight?.weight_kg
    ? (compareRight.weight_kg - compareLeft.weight_kg).toFixed(1)
    : null

  return (
    <>
      <div className="space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Progress Photos</h3>
          <div className="flex items-center gap-2">
            {/* Compare button */}
            {photos.length >= 2 && (
              canCompare ? (
                <button onClick={() => setCompareMode(m => !m)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                    compareMode ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-700 hover:border-gray-400'
                  }`}>
                  Compare
                </button>
              ) : (
                <a href="/pricing"
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-gray-400 hover:border-gray-500 transition-colors flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Compare
                </a>
              )
            )}
            <button onClick={() => setShowUpload(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-gray-900 transition-colors hover:opacity-90"
              style={{ backgroundColor: '#FFD885' }}>
              + Add photo
            </button>
          </div>
        </div>

        {/* Compare view */}
        {compareMode && canCompare && (
          <div className="bg-white rounded-2xl border p-4 space-y-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Side-by-side comparison</p>

            <div className="grid grid-cols-2 gap-3">
              <ComparePanel label="Before" photo={compareLeft} onSelect={() => setPickingFor('left')} />
              <ComparePanel label="After" photo={compareRight} onSelect={() => setPickingFor('right')} />
            </div>

            {weightDelta !== null && (
              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <span className="text-xs font-medium text-gray-500">Weight change</span>
                <span className={`text-sm font-bold ${
                  parseFloat(weightDelta) < 0 ? 'text-teal-600' :
                  parseFloat(weightDelta) > 0 ? 'text-orange-500' : 'text-gray-600'
                }`}>
                  {parseFloat(weightDelta) > 0 ? '+' : ''}{weightDelta}kg
                </span>
              </div>
            )}

            {compareLeft && compareRight && (
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-400">
                  {(() => {
                    const [ly, lm, ld] = compareLeft.taken_at.split('-').map(Number)
                    const [ry, rm, rd] = compareRight.taken_at.split('-').map(Number)
                    const days = Math.abs(Math.round((new Date(ry, rm - 1, rd).getTime() - new Date(ly, lm - 1, ld).getTime()) / 86400000))
                    return days === 0 ? 'Same day' : `${days} days between photos`
                  })()}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Category filter tabs */}
        {photos.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {(['all', ...CATEGORIES.map(c => c.value)] as (Category | 'all')[]).map(f => (
              <button key={f} onClick={() => setFilterCat(f)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  filterCat === f ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'
                }`}>
                {f === 'all' ? `All (${photos.length})` : catLabel(f)}
              </button>
            ))}
          </div>
        )}

        {/* States */}
        {loading && (
          <div className="bg-white rounded-2xl border p-10 text-center text-sm text-gray-400">Loading…</div>
        )}

        {!loading && photos.length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed p-10 text-center space-y-4">
            <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">No progress photos yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Take front, back, and side photos today to start tracking your transformation.
              </p>
            </div>
            <button onClick={() => setShowUpload(true)}
              className="inline-block text-xs font-semibold px-4 py-2 rounded-xl text-gray-900 hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#FFD885' }}>
              Add your first photo →
            </button>
          </div>
        )}

        {/* Photo gallery grouped by month */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-6">
            {Object.entries(grouped)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([month, monthPhotos]) => (
                <div key={month} className="space-y-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                    {fmtMonth(month + '-01')}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {monthPhotos.map(photo => (
                      <button key={photo.id} onClick={() => setSelectedPhoto(photo)}
                        className="aspect-[3/4] rounded-xl overflow-hidden relative group">
                        <img src={photo.url} alt={catLabel(photo.category)} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                        <div className="absolute top-1.5 left-1.5">
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${CAT_COLORS[photo.category]}`}>
                            {catLabel(photo.category).charAt(0)}
                          </span>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/65 to-transparent p-2">
                          <p className="text-white text-xs font-medium leading-tight">{fmtDate(photo.taken_at)}</p>
                          {photo.weight_kg && <p className="text-white/70 text-xs">{photo.weight_kg}kg</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}

        {!loading && filtered.length === 0 && photos.length > 0 && (
          <p className="text-sm text-gray-400 text-center py-6">No photos in this category yet</p>
        )}
      </div>

      {/* Modals */}
      {showUpload && (
        <UploadModal onClose={() => setShowUpload(false)} onUploaded={handleUploaded} />
      )}
      {selectedPhoto && (
        <PhotoDetailModal photo={selectedPhoto} onClose={() => setSelectedPhoto(null)} onDelete={handleDeleted} />
      )}
      {pickingFor && (
        <PickPhotoModal
          photos={photos}
          onPick={photo => {
            if (pickingFor === 'left') setCompareLeft(photo)
            else setCompareRight(photo)
            setPickingFor(null)
          }}
          onClose={() => setPickingFor(null)}
        />
      )}
    </>
  )
}
