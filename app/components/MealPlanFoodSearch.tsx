'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'

const BarcodeScanner = dynamic(() => import('@/app/dashboard/BarcodeScanner'), { ssr: false })

// ── Unit system (mirrors ClientMealPlanEditor) ────────────────────────────────

type ServingUnit = 'g' | 'ml' | 'oz' | 'cup' | 'tbsp' | 'tsp' | 'piece'

const VOLUME_GRAMS: Array<[RegExp, Partial<Record<'cup' | 'tbsp' | 'tsp', number>>]> = [
  [/\b(rolled |steel[- ]cut |instant )?oats?\b|\boatmeal\b/i,              { cup: 90,  tbsp: 10, tsp: 3 }],
  [/\bbasmati\b|\blong[- ]grain rice\b/i,                                  { cup: 185 }],
  [/\bbrown rice\b/i,                                                       { cup: 190 }],
  [/\bwhite rice\b|\brice\b/i,                                             { cup: 185 }],
  [/\bquinoa\b/i,                                                          { cup: 170, tbsp: 11 }],
  [/\balmond flour\b|\bcoconut flour\b|\bflour\b/i,                        { cup: 120, tbsp: 8, tsp: 3 }],
  [/\bgreek yogh?urt\b|\bgreek yogurt\b/i,                                 { cup: 245, tbsp: 15 }],
  [/\byogh?urt\b|\byogurt\b/i,                                             { cup: 245, tbsp: 15 }],
  [/\balmond milk\b|\boat milk\b|\bsoy milk\b|\bcoconut milk\b|\bmilk\b/i, { cup: 240, tbsp: 15 }],
  [/\bpeanut butter\b|\balmond butter\b|\bnut butter\b/i,                  { cup: 256, tbsp: 16, tsp: 5 }],
  [/\bcoconut oil\b|\bolive oil\b|\bvegetable oil\b|\boil\b/i,             { cup: 218, tbsp: 14, tsp: 4 }],
  [/\bbutter\b/i,                                                          { cup: 227, tbsp: 14, tsp: 5 }],
  [/\bhoney\b/i,                                                           { cup: 340, tbsp: 21, tsp: 7 }],
  [/\bmaple syrup\b/i,                                                     { cup: 322, tbsp: 20, tsp: 7 }],
  [/\bsugar\b/i,                                                           { cup: 200, tbsp: 12, tsp: 4 }],
  [/\bcocoa powder\b/i,                                                    { cup: 85,  tbsp: 7,  tsp: 2 }],
  [/\bchia seeds?\b/i,                                                     { cup: 160, tbsp: 12, tsp: 4 }],
  [/\bprotein powder\b|\bwhey protein\b|\bpea protein\b|\bplant protein\b/i, { cup: 120, tbsp: 15 }],
  [/\bcinnamon\b/i,                                                        { tbsp: 8,  tsp: 3 }],
  [/\bsalt\b/i,                                                            { tbsp: 18, tsp: 6 }],
]

const PIECE_WEIGHTS: Array<[RegExp, number]> = [
  [/\begg\b/i, 50], [/\bapple\b/i, 182], [/\bbanana\b/i, 118], [/\borange\b/i, 131],
  [/\btomato\b/i, 123], [/\bstrawberr/i, 12], [/\bpotato\b/i, 150],
  [/\bcarrot\b/i, 61], [/\bslice\b|\btoast\b/i, 28],
]

function gramsPerVolumeUnit(name: string, unit: 'cup' | 'tbsp' | 'tsp'): number | null {
  for (const [re, map] of VOLUME_GRAMS) { if (re.test(name)) return map[unit] ?? null }
  return null
}
function pieceWeightFor(name: string): number | null {
  for (const [re, g] of PIECE_WEIGHTS) { if (re.test(name)) return g }
  return null
}
function effG(name: string, qty: number, unit: ServingUnit, customPieceG: string): number {
  if (unit === 'g' || unit === 'ml') return qty
  if (unit === 'oz') return Math.round(qty * 28.35)
  if (unit === 'piece') {
    const pg = Number(customPieceG) || pieceWeightFor(name) || 0
    return Math.round(qty * pg)
  }
  const gpu = gramsPerVolumeUnit(name, unit as 'cup' | 'tbsp' | 'tsp')
  return gpu ? Math.round(qty * gpu) : 0
}

// ── Types ─────────────────────────────────────────────────────────────────────

type FoodResult = {
  id: string
  name: string
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  unit?: string
  custom?: boolean
  source?: string
  serving_size?: string | null
  serving_quantity?: number | null
  barcode?: string | null
  image_url?: string | null
}

export type MealFood = {
  food_id?: string
  food_name: string
  grams: number
  calories: number
  protein: number
  carbs: number
  fat: number
  _calories_per_100g?: number
  _protein_per_100g?: number
  _carbs_per_100g?: number
  _fat_per_100g?: number
  serving_qty?: number
  unit?: string
  image_url?: string | null
  coach_note?: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function searchOFF(q: string, pageSize = 50, page = 1): Promise<{ results: FoodResult[]; total: number }> {
  try {
    const params = new URLSearchParams({ q, page: String(page), page_size: String(pageSize) })
    const res = await fetch(`/api/foods/off-search?${params}`, { signal: AbortSignal.timeout(14000) })
    if (!res.ok) return { results: [], total: 0 }
    return await res.json()
  } catch {
    return { results: [], total: 0 }
  }
}

function getRelevanceScore(name: string, terms: string[]): number {
  if (terms.length === 0) return 0
  const n = name.toLowerCase()
  const words = n.split(/[\s,\-—\/]+/)
  if (n === terms.join(' ') || n === terms.join(', ')) return 1000
  let score = 0
  let allFound = true
  for (const term of terms) {
    const pos = n.indexOf(term)
    if (pos === -1) { allFound = false; continue }
    const posBonus = Math.max(0, 20 - Math.floor(pos / 4))
    if (words.some(w => w === term))             score += 15 + posBonus
    else if (words.some(w => w.startsWith(term))) score += 10 + posBonus
    else                                          score += 4  + posBonus
  }
  if (allFound) {
    score += 50
    score += Math.max(0, 40 - Math.floor(n.length / 4))
  }
  return score
}

function mergeResults(local: FoodResult[], off: FoodResult[], query: string): FoodResult[] {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(t => t.length >= 2)
  const localNames = new Set(local.map(f => f.name.toLowerCase()))
  // Require ALL terms in name — matches the server-side filter in off-search and search routes
  const offFiltered = terms.length > 0
    ? off.filter(f => { const n = f.name.toLowerCase(); return terms.every(t => n.includes(t)) })
    : off
  const combined = [...local, ...offFiltered.filter(f => !localNames.has(f.name.toLowerCase()))]
  return [...combined].sort((a, b) => getRelevanceScore(b.name, terms) - getRelevanceScore(a.name, terms))
}

function toMealFood(r: FoodResult, grams?: number): MealFood {
  const defaultGrams = grams ?? r.serving_quantity ?? 100
  const factor = defaultGrams / 100
  return {
    food_id: r.id,
    food_name: r.name,
    grams: defaultGrams,
    calories: Math.round(r.calories_per_100g * factor),
    protein: Math.round(r.protein_per_100g  * factor * 10) / 10,
    carbs:   Math.round(r.carbs_per_100g    * factor * 10) / 10,
    fat:     Math.round(r.fat_per_100g      * factor * 10) / 10,
    ...(r.image_url ? { image_url: r.image_url } : {}),
    _calories_per_100g: r.calories_per_100g,
    _protein_per_100g: r.protein_per_100g,
    _carbs_per_100g: r.carbs_per_100g,
    _fat_per_100g: r.fat_per_100g,
  }
}

async function saveOFFFood(food: FoodResult): Promise<FoodResult> {
  try {
    const res = await fetch('/api/foods/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: food.name,
        calories_per_100g: food.calories_per_100g,
        protein_per_100g: food.protein_per_100g,
        carbs_per_100g: food.carbs_per_100g,
        fat_per_100g: food.fat_per_100g,
      }),
    })
    if (res.ok) {
      const saved = await res.json()
      // Merge back extra fields the save endpoint doesn't store
      return {
        ...saved,
        serving_quantity: food.serving_quantity ?? saved.serving_quantity,
        serving_size:     food.serving_size     ?? saved.serving_size,
        barcode:          food.barcode          ?? saved.barcode,
        image_url:        food.image_url        ?? saved.image_url,
      }
    }
  } catch { /* use as-is */ }
  return food
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function ResultRow({ food, onSelect }: { food: FoodResult; onSelect: (f: FoodResult) => void }) {
  return (
    <button
      type="button"
      onMouseDown={() => onSelect(food)}
      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 truncate">{food.name}</p>
            {food.custom && (
              <span className="flex-shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">My food</span>
            )}
            {food.source === 'off' && (
              <span className="flex-shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full bg-green-50 text-green-600">Global</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">per 100{food.unit === 'ml' ? 'ml' : 'g'}</p>
        </div>
        <span className="text-sm font-bold text-gray-700 whitespace-nowrap flex-shrink-0">
          {food.calories_per_100g ?? 0} kcal
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        <span className="text-[11px] bg-purple-50 text-purple-600 font-medium px-1.5 py-0.5 rounded-full">P {food.protein_per_100g}g</span>
        <span className="text-[11px] bg-green-50 text-green-600 font-medium px-1.5 py-0.5 rounded-full">C {food.carbs_per_100g}g</span>
        <span className="text-[11px] bg-blue-50 text-blue-500 font-medium px-1.5 py-0.5 rounded-full">F {food.fat_per_100g}g</span>
      </div>
    </button>
  )
}

// ── Expanded modal (full OFF search with pagination) ──────────────────────────

function ExpandedModal({ initialQuery, onSelect, onClose }: {
  initialQuery: string
  onSelect: (f: FoodResult) => void
  onClose: () => void
}) {
  const [q, setQ] = useState(initialQuery)
  const [results, setResults] = useState<FoodResult[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalOff, setTotalOff] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const activeQuery = useRef(initialQuery)

  const hasMore = results.filter(r => r.source === 'off').length < totalOff

  const fetchPage = useCallback(async (query: string, p: number, reset: boolean) => {
    activeQuery.current = query
    setLoading(true)
    try {
      const [localRes, { results: offResults, total }] = await Promise.all([
        p === 1
          ? fetch(`/api/foods/search?q=${encodeURIComponent(query)}`).then(r => r.json()).catch(() => [])
          : Promise.resolve([]),
        searchOFF(query, 50, p),
      ])
      if (activeQuery.current !== query) return
      const local: FoodResult[] = Array.isArray(localRes) ? localRes : []
      if (reset) {
        setResults(mergeResults(local, offResults, query))
        setTotalOff(total)
      } else {
        setResults(prev => {
          const prevNames = new Set(prev.map(r => r.name.toLowerCase()))
          return [...prev, ...offResults.filter(f => !prevNames.has(f.name.toLowerCase()))]
        })
        setTotalOff(total)
      }
      setPage(p)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialQuery.length >= 2) fetchPage(initialQuery, 1, true)
    inputRef.current?.focus()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (q === initialQuery) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.length < 2) { setResults([]); return }
    debounceRef.current = setTimeout(() => fetchPage(q, 1, true), 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [q, fetchPage, initialQuery])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-gray-100">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search all foods…"
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {totalOff > 0 && (
          <div className="px-4 py-1.5 bg-gray-50 border-b border-gray-100">
            <p className="text-xs text-gray-400">
              {results.length} shown · {totalOff.toLocaleString()} total matches on Open Food Facts
            </p>
          </div>
        )}
        {/* Results */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {loading && results.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
              <Spinner /> Searching…
            </div>
          )}
          {!loading && results.length === 0 && q.length >= 2 && (
            <p className="text-sm text-gray-400 text-center py-10">No results found for &ldquo;{q}&rdquo;</p>
          )}
          {q.length < 2 && (
            <p className="text-sm text-gray-400 text-center py-10">Type at least 2 characters to search</p>
          )}
          {results.map((food, i) => (
            <ResultRow key={`${food.id}-${i}`} food={food} onSelect={onSelect} />
          ))}
          {hasMore && (
            <button
              type="button"
              onClick={() => fetchPage(q, page + 1, false)}
              disabled={loading}
              className="w-full py-3 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading
                ? <><Spinner /> Loading…</>
                : `Load more (${(totalOff - results.filter(r => r.source === 'off').length).toLocaleString()} remaining from Open Food Facts)`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Barcode lookup ───────────────────────────────────────────────────────────

async function lookupBarcode(code: string): Promise<FoodResult | null> {
  try {
    const res = await fetch(`/api/foods/barcode?code=${encodeURIComponent(code)}`)
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

async function rotateImageBitmap(bitmap: ImageBitmap, degrees: number): Promise<ImageBitmap> {
  const rad = (degrees * Math.PI) / 180
  const w = degrees === 90 || degrees === 270 ? bitmap.height : bitmap.width
  const h = degrees === 90 || degrees === 270 ? bitmap.width : bitmap.height

  // OffscreenCanvas isn't available in all browsers — fall back to a regular canvas
  try {
    const oc = new OffscreenCanvas(w, h)
    const ctx = oc.getContext('2d')!
    ctx.translate(w / 2, h / 2)
    ctx.rotate(rad)
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2)
    return oc.transferToImageBitmap()
  } catch {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.translate(w / 2, h / 2)
    ctx.rotate(rad)
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2)
    return createImageBitmap(canvas)
  }
}

function makeRotatedCanvas(img: HTMLImageElement, angle: number): HTMLCanvasElement {
  const sw = img.naturalWidth  || img.width
  const sh = img.naturalHeight || img.height
  const flipped = angle === 90 || angle === 270
  const canvas = document.createElement('canvas')
  canvas.width  = flipped ? sh : sw
  canvas.height = flipped ? sw : sh
  const ctx = canvas.getContext('2d')!
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((angle * Math.PI) / 180)
  ctx.drawImage(img, -sw / 2, -sh / 2)
  return canvas
}

async function decodeFromImageFile(file: File): Promise<string | null> {
  // Load image once, reuse for all attempts
  const url = URL.createObjectURL(file)
  const img = new Image()
  await new Promise<void>((res, rej) => {
    img.onload = () => res()
    img.onerror = rej
    img.src = url
  })

  try {
    // 1. Try native BarcodeDetector with all 4 rotations (Chrome/Edge/Safari 17+)
    if ('BarcodeDetector' in window) {
      try {
        type BD = { detect(src: unknown): Promise<Array<{ rawValue: string }>> }
        const detector = new (window as unknown as { BarcodeDetector: new (opts?: object) => BD }).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code', 'data_matrix'],
        })
        for (const angle of [0, 90, 270, 180]) {
          const canvas = angle === 0 ? makeRotatedCanvas(img, 0) : makeRotatedCanvas(img, angle)
          const codes = await detector.detect(canvas)
          if (codes.length > 0) return codes[0].rawValue
        }
      } catch { /* fall through to @zxing */ }
    }

    // 2. @zxing — decode directly from canvas (more reliable than re-encoding to dataURL)
    const { BrowserMultiFormatReader } = await import('@zxing/browser')
    for (const angle of [0, 90, 270, 180]) {
      try {
        const canvas = makeRotatedCanvas(img, angle)
        const result = await new BrowserMultiFormatReader().decodeFromCanvas(canvas)
        return result.getText()
      } catch { /* next rotation */ }
    }

    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

function BarcodeLookupModal({ onFound, onClose }: {
  onFound: (food: FoodResult) => void
  onClose: () => void
}) {
  // 'choose' = landing screen, 'camera' = live scanner, 'photo' = processing
  const [mode, setMode] = useState<'choose' | 'camera' | 'photo'>('choose')
  const [status, setStatus] = useState<'idle' | 'decoding' | 'looking' | 'not_found'>('idle')
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [scannedCode, setScannedCode] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [manualCode, setManualCode] = useState('')

  function reset() { setMode('choose'); setStatus('idle'); setPhotoPreview(null); setScannedCode(null); setManualCode('') }

  function submitManual() {
    const code = manualCode.replace(/\s/g, '').trim()
    if (code.length >= 8) handleCode(code)
  }

  async function handleCode(code: string) {
    setScannedCode(code)
    setStatus('looking')
    const food = await lookupBarcode(code)
    if (food) { onFound(food); onClose() }
    else setStatus('not_found')
  }

  async function handlePhotoFile(file: File) {
    setMode('photo')
    setPhotoPreview(URL.createObjectURL(file))
    setStatus('decoding')
    const code = await decodeFromImageFile(file)
    if (!code) { setStatus('not_found'); return }
    await handleCode(code)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {mode !== 'choose' && (
              <button type="button" onClick={reset}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <p className="text-sm font-semibold text-gray-900">
              {mode === 'choose' ? 'Add by Barcode' : mode === 'camera' ? 'Scan Barcode' : 'Photo Barcode'}
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4">

          {/* Choose screen — shown first, always */}
          {mode === 'choose' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400 text-center mb-4">How would you like to scan the barcode?</p>
              {/* Hidden file inputs */}
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoFile(f); e.target.value = '' }} />

              {/* Camera option */}
              <button type="button" onClick={() => setMode('camera')}
                className="w-full flex items-center gap-4 p-4 border-2 border-gray-100 rounded-2xl hover:border-blue-300 hover:bg-blue-50 transition-colors text-left group">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8H3a2 2 0 00-2 2v8a2 2 0 002 2h3m0-12V4a2 2 0 012-2h8a2 2 0 012 2v4m0 0h2" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Scan with Camera</p>
                  <p className="text-xs text-gray-400 mt-0.5">Point your camera at the barcode</p>
                </div>
                <svg className="w-4 h-4 text-gray-300 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Photo upload option */}
              <button type="button" onClick={() => photoInputRef.current?.click()}
                className="w-full flex items-center gap-4 p-4 border-2 border-gray-100 rounded-2xl hover:border-purple-300 hover:bg-purple-50 transition-colors text-left group">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-200 transition-colors">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Upload Barcode Photo</p>
                  <p className="text-xs text-gray-400 mt-0.5">Upload or take a photo of the barcode</p>
                </div>
                <svg className="w-4 h-4 text-gray-300 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Manual entry */}
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <p className="text-xs text-gray-400 text-center">Or type the barcode number directly</p>
                <div className="flex gap-2">
                  <input
                    type="text" inputMode="numeric" value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitManual()}
                    placeholder="e.g. 9310036079385"
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-300"
                  />
                  <button type="button" onClick={submitManual}
                    disabled={manualCode.replace(/\s/g,'').length < 8}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition-colors">
                    Look up
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Live camera scanner */}
          {mode === 'camera' && status === 'idle' && (
            <BarcodeScanner onScan={handleCode} onClose={onClose} />
          )}

          {/* Processing / looking up */}
          {(status === 'decoding' || status === 'looking') && (
            <div className="flex flex-col items-center gap-3 py-6">
              {photoPreview && <img src={photoPreview} alt="barcode" className="h-28 w-auto rounded-xl object-contain border" />}
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <svg className="animate-spin h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {status === 'decoding' ? 'Reading barcode from photo…' : `Looking up ${scannedCode}…`}
              </div>
            </div>
          )}

          {/* Not found */}
          {status === 'not_found' && (
            <div className="py-2 space-y-3">
              <p className="text-sm text-amber-700 bg-amber-50 rounded-xl px-3 py-2.5 text-center">
                {scannedCode
                  ? `Barcode ${scannedCode} wasn't found in the food database.`
                  : 'Couldn\'t read a barcode from that image — try a clearer photo or type the number below.'}
              </p>
              <div className="flex gap-2">
                <input
                  type="text" inputMode="numeric" value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitManual()}
                  placeholder={scannedCode ?? 'Type barcode number…'}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-300"
                />
                <button type="button" onClick={submitManual}
                  disabled={manualCode.replace(/\s/g,'').length < 8}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition-colors">
                  Look up
                </button>
              </div>
              <button type="button" onClick={reset}
                className="text-xs font-semibold text-blue-600 hover:underline block text-center w-full">
                ← Try again
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MealPlanFoodSearch({ onAdd }: { onAdd: (food: MealFood) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FoodResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showBarcode, setShowBarcode] = useState(false)
  // Pending food — shown in adjustment panel before adding to meal
  const [pendingFood, setPendingFood] = useState<FoodResult | null>(null)
  const [pendingUnit, setPendingUnit] = useState<ServingUnit>('g')
  const [pendingQty, setPendingQty] = useState(100)
  const [pendingCustomPieceG, setPendingCustomPieceG] = useState('')
  const [pendingMode, setPendingMode] = useState<'serving' | '100g' | 'custom'>('100g')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const [localRes, { results: offResults }] = await Promise.all([
          fetch(`/api/foods/search?q=${encodeURIComponent(query)}`).then(r => r.json()).catch(() => []),
          searchOFF(query, 30, 1),
        ])
        const local: FoodResult[] = Array.isArray(localRes) ? localRes : []
        setResults(mergeResults(local, offResults, query))
        setOpen(true)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function nameGrams(name: string): number | null {
    const m = name.match(/\b(\d{2,4})\s*g\b/i) ?? name.match(/\s(\d{3,4})$/)
    return m ? parseFloat(m[1]) : null
  }

  async function handleSelect(food: FoodResult) {
    let resolved = food
    if (food.source === 'off') resolved = await saveOFFFood(food)

    // If serving_quantity missing but barcode known, fetch from product API
    if ((food.barcode ?? (food as Record<string, unknown>).barcode)) {
      const bc = (food.barcode ?? (food as Record<string, unknown>).barcode) as string
      try {
        const r = await fetch(`/api/foods/barcode?code=${encodeURIComponent(bc)}`)
        if (r.ok) {
          const full = await r.json()
          if (full?.serving_quantity && !resolved.serving_quantity) {
            resolved = { ...resolved, serving_quantity: full.serving_quantity, serving_size: full.serving_size ?? resolved.serving_size }
          }
          if (full?.image_url && !resolved.image_url) {
            resolved = { ...resolved, image_url: full.image_url }
          }
        }
      } catch { /* non-critical */ }
    }

    const initialServingQty = resolved.serving_quantity ?? nameGrams(resolved.name)
    const initialMode = initialServingQty ? 'serving' : '100g'
    setPendingFood(resolved)
    setPendingUnit('g')
    setPendingQty(initialServingQty ?? 100)
    setPendingCustomPieceG('')
    setPendingMode(initialMode)
    setQuery('')
    setResults([])
    setOpen(false)
    setShowModal(false)
  }

  function handlePendingModeChange(mode: 'serving' | '100g' | 'custom') {
    setPendingMode(mode)
    setPendingCustomPieceG('')
    if (mode === '100g') {
      setPendingUnit('g')
      setPendingQty(100)
    } else if (mode === 'serving') {
      setPendingUnit('g')
      setPendingQty(pendingFood?.serving_quantity ?? nameGrams(pendingFood?.name ?? '') ?? 100)
    }
    // 'custom' keeps whatever qty/unit are currently set
  }

  function handlePendingUnitChange(u: ServingUnit) {
    setPendingUnit(u)
    setPendingMode('custom')
    setPendingCustomPieceG('')
    if (u === 'g' || u === 'ml') {
      setPendingQty(pendingFood?.serving_quantity ?? nameGrams(pendingFood?.name ?? '') ?? 100)
    } else if (u === 'oz') {
      const g = pendingFood?.serving_quantity ?? 100
      setPendingQty(Math.round((g / 28.35) * 10) / 10 || 1)
    } else {
      setPendingQty(1)
    }
  }

  function confirmAdd() {
    if (!pendingFood) return
    const grams = effG(pendingFood.name, pendingQty, pendingUnit, pendingCustomPieceG)
    onAdd(toMealFood(pendingFood, grams || 100))
    setPendingFood(null)
    setPendingUnit('g')
    setPendingQty(100)
    setPendingCustomPieceG('')
    setPendingMode('100g')
  }

  return (
    <>
      <div ref={containerRef} className="relative mt-2">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search foods to add…"
            className="w-full border border-gray-200 rounded-xl pl-9 pr-16 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {loading && <Spinner />}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setShowModal(true) }}
              className="text-xs font-semibold text-blue-500 hover:text-blue-700 transition-colors px-1.5"
            >
              More
            </button>
          </div>
        </div>

        {/* Inline dropdown */}
        {open && results.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-72 overflow-y-auto divide-y divide-gray-50">
            {results.map((food, i) => (
              <ResultRow key={`${food.id}-${i}`} food={food} onSelect={handleSelect} />
            ))}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setShowModal(true) }}
              className="w-full py-2.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
            >
              Search all of Open Food Facts →
            </button>
          </div>
        )}

        {/* No local results — prompt to try expanded */}
        {open && !loading && results.length === 0 && query.length >= 2 && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-gray-400">No foods found for &ldquo;{query}&rdquo;</p>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setShowModal(true) }}
              className="text-xs font-semibold text-blue-600 hover:underline whitespace-nowrap"
            >
              Search Open Food Facts →
            </button>
          </div>
        )}

        {/* Pending food panel — adjust serving before adding */}
        {pendingFood && (() => {
          const f = pendingFood
          const displayGrams = effG(f.name, pendingQty, pendingUnit, pendingCustomPieceG)
          const factor = displayGrams / 100
          const cal  = Math.round(f.calories_per_100g * factor)
          const pro  = Math.round(f.protein_per_100g  * factor * 10) / 10
          const carb = Math.round(f.carbs_per_100g    * factor * 10) / 10
          const fat  = Math.round(f.fat_per_100g      * factor * 10) / 10
          const knownPieceG = pieceWeightFor(f.name)
          const showCustomPiece = pendingUnit === 'piece' && !knownPieceG
          return (
            <div className="mt-2 border border-blue-200 bg-blue-50 rounded-xl p-3 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900 leading-tight flex-1 min-w-0">{f.name}</p>
                <button type="button" onClick={() => setPendingFood(null)}
                  className="text-gray-400 hover:text-gray-600 flex-shrink-0 text-xs">✕</button>
              </div>

              {/* Serving size quick tabs */}
              <div className="flex gap-1.5">
                {f.serving_quantity && (
                  <button
                    type="button"
                    onClick={() => handlePendingModeChange('serving')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                      pendingMode === 'serving'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-blue-200 hover:border-blue-400'
                    }`}
                  >
                    Serving{f.serving_size ? ` (${f.serving_size})` : ` (${f.serving_quantity}g)`}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handlePendingModeChange('100g')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                    pendingMode === '100g'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-blue-200 hover:border-blue-400'
                  }`}
                >
                  100g
                </button>
                <button
                  type="button"
                  onClick={() => handlePendingModeChange('custom')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                    pendingMode === 'custom'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-blue-200 hover:border-blue-400'
                  }`}
                >
                  Custom
                </button>
              </div>

              {/* Amount + unit — always shown, editable in any mode */}
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-xs text-gray-600 whitespace-nowrap">Amount:</label>
                <input
                  type="number" min={0.25} step={pendingUnit === 'g' || pendingUnit === 'ml' ? 1 : 0.25}
                  value={pendingQty}
                  onChange={(e) => { setPendingQty(parseFloat(e.target.value) || 1); setPendingMode('custom') }}
                  className="w-20 border border-blue-200 rounded-lg px-2 py-1.5 text-sm text-center font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <select
                  value={pendingUnit}
                  onChange={(e) => handlePendingUnitChange(e.target.value as ServingUnit)}
                  className="border border-blue-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {(['g','ml','oz','cup','tbsp','tsp','piece'] as ServingUnit[]).map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                {pendingUnit !== 'g' && pendingUnit !== 'ml' && displayGrams > 0 && (
                  <span className="text-xs text-gray-400">= {displayGrams}g</span>
                )}
              </div>

              {/* Custom piece weight input */}
              {showCustomPiece && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Weight per piece (g):</label>
                  <input type="number" min={1} value={pendingCustomPieceG}
                    onChange={(e) => setPendingCustomPieceG(e.target.value)}
                    placeholder="e.g. 120"
                    className="w-20 border border-blue-200 rounded-lg px-2 py-1.5 text-sm text-center bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              )}

              {/* Macro preview */}
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: 'kcal', val: cal, color: 'text-gray-800' },
                  { label: 'P', val: `${pro}g`, color: 'text-pink-600' },
                  { label: 'C', val: `${carb}g`, color: 'text-purple-500' },
                  { label: 'F', val: `${fat}g`, color: 'text-blue-400' },
                ].map(m => (
                  <div key={m.label} className="bg-white rounded-lg p-1.5 text-center">
                    <p className={`text-sm font-bold ${m.color}`}>{m.val}</p>
                    <p className="text-[10px] text-gray-400">{m.label}</p>
                  </div>
                ))}
              </div>

              <button type="button" onClick={confirmAdd}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
                Add to meal
              </button>
            </div>
          )
        })()}

        {/* Barcode scan button — visible below the search bar */}
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); setShowBarcode(true) }}
          className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-xs font-medium rounded-xl transition-colors"
        >
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8H3a2 2 0 00-2 2v8a2 2 0 002 2h3m0-12V4a2 2 0 012-2h8a2 2 0 012 2v4m0 0h2" />
          </svg>
          Scan or upload a barcode
        </button>
      </div>

      {showModal && (
        <ExpandedModal
          initialQuery={query}
          onSelect={handleSelect}
          onClose={() => setShowModal(false)}
        />
      )}

      {showBarcode && (
        <BarcodeLookupModal
          onFound={(food) => handleSelect(food)}
          onClose={() => setShowBarcode(false)}
        />
      )}
    </>
  )
}
