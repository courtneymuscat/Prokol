'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'

// Calls our server proxy which forwards to search.openfoodfacts.org (Meilisearch).
// Direct browser calls fail: search.openfoodfacts.org blocks CORS, cgi/search.pl returns 503.
// Server-to-server calls to search.openfoodfacts.org work reliably.
export async function searchOpenFoodFacts(q: string, pageSize = 50, page = 1): Promise<{ results: FoodResult[]; total: number }> {
  try {
    const params = new URLSearchParams({ q, page: String(page), page_size: String(pageSize) })
    const res = await fetch(`/api/foods/off-search?${params}`, {
      signal: AbortSignal.timeout(14000),
    })
    if (!res.ok) return { results: [], total: 0 }
    return await res.json()
  } catch {
    return { results: [], total: 0 }
  }
}

// Rank results by relevance to all query terms.
// Factors: exact word match, position in name (earlier = better), name length (shorter = more specific).
function getRelevanceScore(name: string, terms: string[]): number {
  if (terms.length === 0) return 0
  const n = name.toLowerCase()
  const words = n.split(/[\s,\-—\/]+/)

  // Exact full-name match
  if (n === terms.join(' ') || n === terms.join(', ')) return 1000

  let score = 0
  let allFound = true

  for (const term of terms) {
    const pos = n.indexOf(term)
    if (pos === -1) { allFound = false; continue }

    // Earlier position in name = higher score (max +20 bonus at pos 0, tapers off)
    const posBonus = Math.max(0, 20 - Math.floor(pos / 4))

    if (words.some(w => w === term))            score += 15 + posBonus  // exact word match
    else if (words.some(w => w.startsWith(term))) score += 10 + posBonus  // word starts with term
    else                                        score += 4  + posBonus  // substring
  }

  if (allFound) {
    // All terms present: big bonus
    score += 50
    // Prefer shorter names — "Chicken, raw" beats "Chicken breast, raw, skinless, boneless"
    score += Math.max(0, 40 - Math.floor(n.length / 4))
  }

  return score
}

function sortByRelevance<T extends { name: string }>(items: T[], query: string): T[] {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return items
  return [...items].sort((a, b) => getRelevanceScore(b.name, terms) - getRelevanceScore(a.name, terms))
}

// Merge local + OFF results, deduplicate by name, sort by relevance.
// For multi-word queries, OFF results that don't contain ALL terms are deprioritised
// so branded noise (e.g. Campbell's Chicken Soup when querying "chicken raw") stays out.
export function mergeResults(local: FoodResult[], off: FoodResult[], query: string): FoodResult[] {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(t => t.length >= 2)
  const localNames = new Set(local.map(f => f.name.toLowerCase()))

  // Require ALL terms to appear in the name — same rule as the server routes.
  const offFiltered = terms.length > 0
    ? off.filter(f => {
        const n = f.name.toLowerCase()
        return terms.every(t => n.includes(t))
      })
    : off

  const combined = [...local, ...offFiltered.filter(f => !localNames.has(f.name.toLowerCase()))]
  return sortByRelevance(combined, query)
}

const BarcodeScanner = dynamic(() => import('./BarcodeScanner'), { ssr: false })

export type FoodResult = {
  id: string
  name: string
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  unit?: string
  custom?: boolean
  source?: string
  serving_size?: string | null       // e.g. "160 g" or "1 pot (160g)"
  serving_quantity?: number | null   // grams per serving, e.g. 160
  barcode?: string | null            // EAN/UPC code from OFD search
  image_url?: string | null
}

type BarcodeState =
  | { status: 'idle' }
  | { status: 'looking'; code: string }
  | { status: 'not_found'; code: string }
  | { status: 'saving' }

type ServingUnit = 'g' | 'ml' | 'oz' | 'cup' | 'tbsp' | 'tsp' | 'piece'
type VolumeUnit = 'cup' | 'tbsp' | 'tsp'

const PIECE_WEIGHTS: Array<[RegExp, number]> = [
  [/\begg\b/i, 50],
  [/\bapple\b/i, 182],
  [/\bbanana\b/i, 118],
  [/\borange\b/i, 131],
  [/\btomato\b/i, 123],
  [/\bstrawberr/i, 12],
  [/\bpotato\b/i, 150],
  [/\bcarrot\b/i, 61],
  [/\bslice\b|\btoast\b/i, 28],
]

function getPieceWeight(name: string): number | null {
  for (const [re, g] of PIECE_WEIGHTS) {
    if (re.test(name)) return g
  }
  return null
}

// Gram-per-unit lookup for common whole foods. Most-specific patterns first.
const FOOD_UNIT_GRAMS: Array<[RegExp, Partial<Record<VolumeUnit, number>>]> = [
  [/\b(rolled |steel[- ]cut |instant )?oats?\b|\boatmeal\b/i,                 { cup: 90,  tbsp: 10, tsp: 3  }],
  [/\bbasmati\b|\blong[- ]grain rice\b/i,                                      { cup: 185              }],
  [/\bbrown rice\b/i,                                                           { cup: 190              }],
  [/\bwhite rice\b/i,                                                           { cup: 185              }],
  [/\brice\b/i,                                                                 { cup: 185              }],
  [/\bquinoa\b/i,                                                               { cup: 170, tbsp: 11   }],
  [/\balmond flour\b/i,                                                         { cup: 96,  tbsp: 7    }],
  [/\bcoconut flour\b/i,                                                        { cup: 112, tbsp: 8    }],
  [/\bself[- ]rai?sing flour\b|\ball[- ]purpose flour\b|\bplain flour\b/i,     { cup: 120, tbsp: 8, tsp: 3 }],
  [/\bflour\b/i,                                                                { cup: 120, tbsp: 8, tsp: 3 }],
  [/\bgreek yogh?urt\b|\bgreek yogurt\b/i,                                     { cup: 245, tbsp: 15   }],
  [/\byogh?urt\b|\byogurt\b/i,                                                 { cup: 245, tbsp: 15   }],
  [/\balmond milk\b|\boat milk\b|\bsoy milk\b|\bcoconut milk\b/i,              { cup: 240, tbsp: 15   }],
  [/\bmilk\b/i,                                                                 { cup: 240, tbsp: 15   }],
  [/\bpeanut butter\b/i,                                                        { cup: 256, tbsp: 16, tsp: 5 }],
  [/\balmond butter\b|\bcashew butter\b|\bnut butter\b/i,                      { cup: 256, tbsp: 16, tsp: 5 }],
  [/\bcoconut oil\b/i,                                                                               { cup: 218, tbsp: 14, tsp: 5 }],
  [/\bolive oil\b|\bvegetable oil\b|\bcanola oil\b|\bsunflower oil\b|\bsesame oil\b|\bavocado oil\b/i, { cup: 218, tbsp: 14, tsp: 4 }],
  [/\boil\b/i,                                                                                        { cup: 218, tbsp: 14, tsp: 4 }],
  [/\bbutter\b/i,                                                                                     { cup: 227, tbsp: 14, tsp: 5 }],
  [/\bhoney\b/i,                                                                { cup: 340, tbsp: 21, tsp: 7 }],
  [/\bmaple syrup\b/i,                                                          { cup: 322, tbsp: 20, tsp: 7 }],
  [/\bbrown sugar\b/i,                                                          { cup: 200, tbsp: 12, tsp: 4 }],
  [/\bsugar\b/i,                                                                { cup: 200, tbsp: 12, tsp: 4 }],
  [/\bcocoa powder\b/i,                                                         { cup: 85,  tbsp: 7,  tsp: 2 }],
  [/\bchia seeds?\b/i,                                                          { cup: 160, tbsp: 12, tsp: 4 }],
  [/\bflax(seed|s)?\b/i,                                                        { cup: 149, tbsp: 10, tsp: 3 }],
  [/\bhemp seeds?\b/i,                                                          { cup: 160, tbsp: 10, tsp: 3 }],
  [/\bprotein powder\b|\bwhey protein\b|\bpea protein\b/i,                     { cup: 120, tbsp: 15   }],
  [/\bcottage cheese\b/i,                                                       { cup: 225, tbsp: 14   }],
  [/\bcream cheese\b/i,                                                         { cup: 232, tbsp: 15   }],
  [/\bsour cream\b/i,                                                           { cup: 230, tbsp: 14   }],
  [/\bmayonnaise\b|\bmayo\b/i,                                                  { cup: 220, tbsp: 14   }],
  [/\blentils?\b/i,                                                             { cup: 192              }],
  [/\bchickpeas?\b|\bgarbanzo\b/i,                                              { cup: 164              }],
  [/\bbeans?\b/i,                                                               { cup: 172              }],
  [/\bricotta\b/i,                                                              { cup: 246, tbsp: 15   }],
  [/\bcinnamon\b/i,                                                             {            tbsp: 8, tsp: 3 }],
  [/\bsalt\b/i,                                                                 {            tbsp: 18, tsp: 6 }],
]

function getStaticGramsPerUnit(name: string, unit: VolumeUnit): number | null {
  for (const [pattern, grams] of FOOD_UNIT_GRAMS) {
    if (pattern.test(name)) return grams[unit] ?? null
  }
  return null
}

function buildServingDescription(qty: number, unit: ServingUnit): string {
  if (unit === 'tbsp') return `${qty} tbsp`
  if (unit === 'tsp') return `${qty} tsp`
  if (unit === 'cup') return `${qty} cup${qty !== 1 ? 's' : ''}`
  if (unit === 'oz') return `${qty}oz`
  if (unit === 'piece') return `${qty} piece${qty !== 1 ? 's' : ''}`
  return `${qty}${unit}`
}

type Props = {
  onSelect: (food: FoodResult, grams: number, servingDescription?: string) => void
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function MacroPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      <span className="opacity-70">{label}</span>
      <span>{value}g</span>
    </span>
  )
}

function FoodResultRow({ food, onSelect, highlighted }: { food: FoodResult; onSelect: (f: FoodResult) => void; highlighted?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(food)}
      className={`w-full text-left px-4 py-3 transition-colors ${highlighted ? 'bg-blue-50 border-l-2 border-blue-500' : 'hover:bg-gray-50'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className={`text-sm font-semibold truncate ${highlighted ? 'text-blue-700' : 'text-gray-900'}`}>{food.name}</p>
            {food.custom && <span className="flex-shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">My food</span>}
            {food.source === 'off' && <span className="flex-shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full bg-green-50 text-green-600">Global</span>}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">per 100{food.unit === 'ml' ? 'ml' : 'g'}</p>
        </div>
        <span className={`text-sm font-bold whitespace-nowrap ${highlighted ? 'text-blue-600' : 'text-gray-700'}`}>{food.calories_per_100g ?? 0} kcal</span>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        <MacroPill label="P" value={food.protein_per_100g ?? 0} color="bg-macro-p text-macro-p" />
        <MacroPill label="C" value={food.carbs_per_100g ?? 0} color="bg-macro-c text-macro-c" />
        <MacroPill label="F" value={food.fat_per_100g ?? 0} color="bg-macro-f text-macro-f" />
      </div>
    </button>
  )
}

function ExpandedSearchModal({ initialQuery, onSelect, onClose }: {
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
      // Local DB + OFF called in parallel directly from browser
      const [localRes, { results: offResults, total }] = await Promise.all([
        p === 1
          ? fetch(`/api/foods/search?q=${encodeURIComponent(query)}`).then(r => r.json()).catch(() => [])
          : Promise.resolve([]),
        searchOpenFoodFacts(query, 50, p),
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
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  // Fire immediately on mount for the initial query
  useEffect(() => {
    if (initialQuery.length >= 2) fetchPage(initialQuery, 1, true)
    inputRef.current?.focus()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce subsequent user-typed changes
  useEffect(() => {
    if (q === initialQuery) return // already fetched on mount
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
              placeholder="Search all foods..."
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
            <FoodResultRow key={`${food.id}-${i}`} food={food} onSelect={onSelect} />
          ))}
          {hasMore && (
            <button
              type="button"
              onClick={() => fetchPage(q, page + 1, false)}
              disabled={loading}
              className="w-full py-3 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <><Spinner /> Loading…</> : `Load more (${(totalOff - results.filter(r => r.source === 'off').length).toLocaleString()} remaining from Open Food Facts)`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function FoodSearch({ onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FoodResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<FoodResult | null>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [customFood, setCustomFood] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '' })
  const [savingCustom, setSavingCustom] = useState(false)
  const [foodScope, setFoodScope] = useState<'personal' | 'global'>('personal')
  const [recentFoods, setRecentFoods] = useState<FoodResult[]>([])

  const fetchRecent = useCallback(async () => {
    const res = await fetch('/api/foods/recent')
    if (res.ok) setRecentFoods(await res.json())
  }, [])

  useEffect(() => { fetchRecent() }, [fetchRecent])
  const [grams, setGrams] = useState(100)
  const [unit, setUnit] = useState<'g' | 'ml'>('g')
  // Serving size extras — kept separate so search/factor logic is untouched
  const [servingUnit, setServingUnit] = useState<ServingUnit>('g')
  const [servingQty, setServingQty] = useState(100)
  const [gramsPerUnit, setGramsPerUnit] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [expandedSearch, setExpandedSearch] = useState(false)
  const [barcode, setBarcode] = useState<BarcodeState>({ status: 'idle' })
  const [newFood, setNewFood] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '' })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (selected) return // food already selected — don't reopen dropdown
    if (query.length < 2) { setResults([]); setOpen(false); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        // Call local DB and Open Food Facts in parallel so inline results include global foods
        const [localRes, { results: offResults }] = await Promise.all([
          fetch(`/api/foods/search?q=${encodeURIComponent(query)}`).then(r => r.json()).catch(() => []),
          searchOpenFoodFacts(query, 30, 1),
        ])
        const local: FoodResult[] = Array.isArray(localRes) ? localRes : []
        setResults(mergeResults(local, offResults, query))
        setOpen(true)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, selected])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleSelect(food: FoodResult) {
    // If this is an Open Food Facts result, save it to the shared DB first
    // so it gets a real UUID for food_logs.food_id
    let resolvedFood = food
    if (food.source === 'off') {
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
          resolvedFood = {
            ...saved,
            serving_quantity: food.serving_quantity ?? saved.serving_quantity,
            serving_size:     food.serving_size     ?? saved.serving_size,
            barcode:          food.barcode          ?? saved.barcode,
            image_url:        food.image_url        ?? saved.image_url ?? null,
          }
        }
      } catch {
        // save failed — use food as-is
      }
    }
    // If serving_quantity is still missing but we have a barcode, fetch from the product API
    if (!resolvedFood.serving_quantity && resolvedFood.barcode) {
      try {
        const r = await fetch(`/api/foods/barcode?code=${encodeURIComponent(resolvedFood.barcode)}`)
        if (r.ok) {
          const full = await r.json()
          if (full?.serving_quantity) {
            resolvedFood = { ...resolvedFood, serving_quantity: full.serving_quantity, serving_size: full.serving_size ?? resolvedFood.serving_size }
          }
        }
      } catch { /* non-critical */ }
    }

    const initUnit: ServingUnit = resolvedFood.unit === 'ml' ? 'ml' : 'g'
    const nameGrams = (() => {
      const m = resolvedFood.name.match(/\b(\d{2,4})\s*g\b/i) ?? resolvedFood.name.match(/\s(\d{3,4})$/)
      return m ? parseFloat(m[1]) : null
    })()
    const initGrams = resolvedFood.serving_quantity ?? nameGrams ?? 100
    setSelected(resolvedFood)
    setHighlightedId(resolvedFood.id)
    setQuery(resolvedFood.name)
    setOpen(false)
    setBarcode({ status: 'idle' })
    setUnit(resolvedFood.unit === 'ml' ? 'ml' : 'g')
    setServingUnit(initUnit)
    setServingQty(initGrams)
    setGramsPerUnit('')
    setGrams(initGrams)
    onSelect(resolvedFood, initGrams, buildServingDescription(initGrams, initUnit))
  }

  function handleGramsChange(val: number) {
    setGrams(val)
    setServingQty(val)
    if (selected) onSelect(selected, val, buildServingDescription(val, servingUnit))
  }

  function handleServingUnitChange(newUnit: ServingUnit) {
    setServingUnit(newUnit)
    const isVolume = newUnit === 'cup' || newUnit === 'tbsp' || newUnit === 'tsp'
    const newQty = newUnit === 'g' || newUnit === 'ml' ? 100 : 1
    let newGPU = ''
    let effG: number

    if (newUnit === 'g' || newUnit === 'ml') {
      effG = newQty
    } else if (newUnit === 'oz') {
      effG = Math.round(newQty * 28.35)
    } else if (newUnit === 'piece') {
      if (selected) {
        const pw = getPieceWeight(selected.name)
        if (pw) newGPU = String(pw)
      }
      effG = newGPU ? Math.round(newQty * Number(newGPU)) : 0
    } else {
      if (selected) {
        const staticG = getStaticGramsPerUnit(selected.name, newUnit as VolumeUnit)
        if (staticG) newGPU = String(staticG)
      }
      effG = newGPU ? Math.round(newQty * Number(newGPU)) : 0
    }

    setServingQty(newQty)
    setGramsPerUnit(newGPU)
    setGrams(effG)
    if (selected) onSelect(selected, effG, buildServingDescription(newQty, newUnit))
    // Keep unit badge in sync for g/ml
    if (!isVolume && newUnit !== 'oz' && newUnit !== 'piece') setUnit(newUnit as 'g' | 'ml')
  }

  function handleServingQtyChange(newQty: number) {
    setServingQty(newQty)
    let effG: number
    if (servingUnit === 'g' || servingUnit === 'ml') {
      effG = newQty
    } else if (servingUnit === 'oz') {
      effG = Math.round(newQty * 28.35)
    } else {
      const gpUnit = Number(gramsPerUnit)
      effG = gpUnit > 0 ? Math.round(newQty * gpUnit) : 0
    }
    setGrams(effG)
    if (selected) onSelect(selected, effG, buildServingDescription(newQty, servingUnit))
  }

  function handleGramsPerUnitChange(val: string) {
    setGramsPerUnit(val)
    const gpUnit = Number(val)
    const effG = gpUnit > 0 ? Math.round(servingQty * gpUnit) : 0
    setGrams(effG)
    if (selected) onSelect(selected, effG, buildServingDescription(servingQty, servingUnit))
  }

  function handleClear() {
    setSelected(null)
    setHighlightedId(null)
    setQuery('')
    setResults([])
    setGrams(100)
    setUnit('g')
    setServingUnit('g')
    setServingQty(100)
    setGramsPerUnit('')
    setBarcode({ status: 'idle' })
    setAddingNew(false)
    inputRef.current?.focus()
  }

  async function handleSaveCustomFood() {
    if (!customFood.name.trim()) return
    setSavingCustom(true)
    const endpoint = foodScope === 'global' ? '/api/foods/save' : '/api/foods/custom'
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: customFood.name,
        calories_per_100g: Number(customFood.calories) || 0,
        protein_per_100g: Number(customFood.protein) || 0,
        carbs_per_100g: Number(customFood.carbs) || 0,
        fat_per_100g: Number(customFood.fat) || 0,
      }),
    })
    const food: FoodResult = await res.json()
    setSavingCustom(false)
    setAddingNew(false)
    setCustomFood({ name: '', calories: '', protein: '', carbs: '', fat: '' })
    handleSelect({ ...food, custom: foodScope === 'personal' })
  }

  async function handleScan(code: string) {
    setScannerOpen(false)
    setBarcode({ status: 'looking', code })

    const res = await fetch(`/api/foods/barcode?code=${encodeURIComponent(code)}`)
    const food: FoodResult | null = await res.json()

    if (food) {
      handleSelect(food)
      setBarcode({ status: 'idle' })
    } else {
      setBarcode({ status: 'not_found', code })
      setNewFood({ name: '', calories: '', protein: '', carbs: '', fat: '' })
    }
  }

  async function handleSaveNewFood() {
    if (barcode.status !== 'not_found') return
    setBarcode({ status: 'saving' })

    const endpoint = foodScope === 'global' ? '/api/foods/save' : '/api/foods/custom'
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newFood.name,
        calories_per_100g: Number(newFood.calories),
        protein_per_100g: Number(newFood.protein),
        carbs_per_100g: Number(newFood.carbs),
        fat_per_100g: Number(newFood.fat),
        ...(foodScope === 'global' ? { barcode: barcode.code } : {}),
      }),
    })

    const food: FoodResult = await res.json()
    handleSelect({ ...food, custom: foodScope === 'personal' })
    setBarcode({ status: 'idle' })
  }

  const factor = grams / 100

  return (
    <>
      {scannerOpen && (
        <BarcodeScanner onScan={handleScan} onClose={() => setScannerOpen(false)} />
      )}

      {expandedSearch && (
        <ExpandedSearchModal
          initialQuery={query}
          onSelect={(food) => { handleSelect(food); setExpandedSearch(false) }}
          onClose={() => setExpandedSearch(false)}
        />
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Search Food Database
          </label>

          {/* Input row */}
          <div ref={containerRef} className="relative w-full">
              <div className="relative flex items-center">
                <svg className="absolute left-3 h-4 w-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); if (selected) setSelected(null) }}
                  onFocus={() => { if (results.length > 0 || recentFoods.length > 0) setOpen(true) }}
                  placeholder="Search by food name..."
                  className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-400"
                />
                <div className="absolute right-3 flex items-center">
                  {(loading || barcode.status === 'looking') && <Spinner />}
                  {!loading && barcode.status !== 'looking' && selected && (
                    <button type="button" onClick={handleClear} className="text-gray-400 hover:text-gray-600 transition-colors p-0.5 rounded-full hover:bg-gray-100" aria-label="Clear">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Dropdown */}
              {open && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden">
                  {query.length < 2 && recentFoods.length > 0 ? (
                    <>
                      <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Recent Foods</p>
                      <ul className="max-h-72 overflow-y-auto divide-y divide-gray-50 pb-1">
                        {recentFoods.map((food) => (
                          <li key={food.id || food.name}>
                            <button
                              type="button"
                              onClick={() => handleSelect(food)}
                              className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 truncate">{food.name}</p>
                                  {food.unit === 'ml' && <span className="flex-shrink-0 text-xs font-medium px-1 py-0.5 rounded bg-cyan-50 text-cyan-600">liquid</span>}
                                </div>
                                <span className="text-sm font-bold text-gray-700 whitespace-nowrap">{food.calories_per_100g} kcal</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                <MacroPill label="P" value={food.protein_per_100g} color="bg-macro-p text-macro-p" />
                                <MacroPill label="C" value={food.carbs_per_100g} color="bg-macro-c text-macro-c" />
                                <MacroPill label="F" value={food.fat_per_100g} color="bg-macro-f text-macro-f" />
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : results.length > 0 ? (
                    <ul className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                      {results.map((food) => (
                        <li key={food.id}>
                          <FoodResultRow food={food} onSelect={handleSelect} highlighted={food.id === highlightedId} />
                        </li>
                      ))}
                      {/* Footer actions */}
                      <li className="divide-y divide-gray-50">
                        <button
                          type="button"
                          onClick={() => { setOpen(false); setExpandedSearch(true) }}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center gap-2 text-blue-600"
                        >
                          <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                          </svg>
                          <span className="text-sm font-medium">Search all results for &ldquo;{query}&rdquo;</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setOpen(false); setAddingNew(true); setCustomFood((f) => ({ ...f, name: query })) }}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center gap-2 text-gray-500"
                        >
                          <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          <span className="text-sm font-medium">Create &ldquo;{query}&rdquo; manually</span>
                        </button>
                      </li>
                    </ul>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      <button
                        type="button"
                        onClick={() => { setOpen(false); setExpandedSearch(true) }}
                        className="w-full text-left px-4 py-3.5 hover:bg-gray-50 transition-colors flex items-center gap-2 text-blue-600"
                      >
                        <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                        </svg>
                        <span className="text-sm font-medium">Search all results for &ldquo;{query}&rdquo;</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setOpen(false); setAddingNew(true); setCustomFood((f) => ({ ...f, name: query })) }}
                        className="w-full text-left px-4 py-3.5 hover:bg-gray-50 transition-colors flex items-center gap-2 text-gray-500"
                      >
                        <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="text-sm font-medium">Create &ldquo;{query}&rdquo; manually</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

          {/* Scan button — full width below search */}
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-xl transition-colors"
            title="Scan barcode"
          >
            <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8H3a2 2 0 00-2 2v8a2 2 0 002 2h3m0-12V4a2 2 0 012-2h8a2 2 0 012 2v4m0 0h2" />
            </svg>
            <span>Scan Barcode</span>
          </button>
        </div>

        {/* Barcode not found — add food form */}
        {barcode.status === 'not_found' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="h-4 w-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800">Barcode not in database</p>
                <p className="text-xs text-amber-600 mt-0.5 font-mono">{barcode.code}</p>
                <p className="text-xs text-amber-700 mt-1">Add this food and it&apos;ll be saved for next time.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <input
                  type="text"
                  placeholder="Food name (required)"
                  value={newFood.name}
                  onChange={(e) => setNewFood((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              {[
                { key: 'calories', placeholder: 'Calories / 100g' },
                { key: 'protein', placeholder: 'Protein (g)' },
                { key: 'carbs', placeholder: 'Carbs (g)' },
                { key: 'fat', placeholder: 'Fat (g)' },
              ].map(({ key, placeholder }) => (
                <input
                  key={key}
                  type="number"
                  min={0}
                  placeholder={placeholder}
                  value={newFood[key as keyof typeof newFood]}
                  onChange={(e) => setNewFood((f) => ({ ...f, [key]: e.target.value }))}
                  className="border border-amber-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              ))}
            </div>

            {/* Scope toggle */}
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-1.5">Save to:</p>
              <div className="flex rounded-lg overflow-hidden border border-amber-200 text-xs font-semibold w-fit">
                <button
                  type="button"
                  onClick={() => setFoodScope('personal')}
                  className={`px-3 py-1.5 transition-colors ${foodScope === 'personal' ? 'bg-amber-600 text-white' : 'bg-white text-amber-700 hover:bg-amber-50'}`}
                >
                  My Foods Only
                </button>
                <button
                  type="button"
                  onClick={() => setFoodScope('global')}
                  className={`px-3 py-1.5 transition-colors border-l border-amber-200 ${foodScope === 'global' ? 'bg-amber-600 text-white' : 'bg-white text-amber-700 hover:bg-amber-50'}`}
                >
                  Shared Database
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveNewFood}
                disabled={!newFood.name.trim()}
                className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Save &amp; Select Food
              </button>
              <button
                type="button"
                onClick={() => setBarcode({ status: 'idle' })}
                className="px-3 py-2 text-amber-700 hover:bg-amber-100 text-sm rounded-lg transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {barcode.status === 'saving' && (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-1">
            <Spinner />
            Saving food to database...
          </div>
        )}

        {/* Add New Food form */}
        {addingNew && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-blue-800">Add New Food</p>
              <button type="button" onClick={() => setAddingNew(false)} className="text-blue-400 hover:text-blue-600 transition-colors">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <input
                  type="text"
                  placeholder="Food name (required)"
                  value={customFood.name}
                  onChange={(e) => setCustomFood((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              {([
                { key: 'calories', placeholder: 'Calories / 100g' },
                { key: 'protein', placeholder: 'Protein (g)' },
                { key: 'carbs', placeholder: 'Carbs (g)' },
                { key: 'fat', placeholder: 'Fat (g)' },
              ] as const).map(({ key, placeholder }) => (
                <input
                  key={key}
                  type="number"
                  min={0}
                  step="any"
                  placeholder={placeholder}
                  value={customFood[key]}
                  onChange={(e) => setCustomFood((f) => ({ ...f, [key]: e.target.value }))}
                  className="border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              ))}
            </div>
            {/* Scope toggle */}
            <div>
              <p className="text-xs font-semibold text-blue-700 mb-1.5">Save to:</p>
              <div className="flex rounded-lg overflow-hidden border border-blue-200 text-xs font-semibold w-fit">
                <button
                  type="button"
                  onClick={() => setFoodScope('personal')}
                  className={`px-3 py-1.5 transition-colors ${foodScope === 'personal' ? 'bg-blue-600 text-white' : 'bg-white text-blue-700 hover:bg-blue-50'}`}
                >
                  My Foods Only
                </button>
                <button
                  type="button"
                  onClick={() => setFoodScope('global')}
                  className={`px-3 py-1.5 transition-colors border-l border-blue-200 ${foodScope === 'global' ? 'bg-blue-600 text-white' : 'bg-white text-blue-700 hover:bg-blue-50'}`}
                >
                  Shared Database
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveCustomFood}
              disabled={!customFood.name.trim() || savingCustom}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {savingCustom ? 'Saving...' : 'Save & Select Food'}
            </button>
          </div>
        )}

        {/* Selected food card */}
        {selected && (
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Selected</p>
              <button type="button" onClick={handleClear} className="text-xs text-blue-400 hover:text-blue-600 transition-colors">
                Change
              </button>
            </div>
            <p className="text-sm font-semibold text-gray-900 leading-tight">{selected.name}</p>

            {/* Quick serving buttons */}
            {(() => {
              const nameG = (() => { const m = selected.name.match(/\b(\d{2,4})\s*g\b/i) ?? selected.name.match(/\s(\d{3,4})$/); return m ? parseFloat(m[1]) : null })()
              const servingG = selected.serving_quantity ?? nameG
              if (!servingG || servingG === 100) return null
              return (
                <div className="flex gap-1.5 flex-wrap">
                  <button type="button" onClick={() => handleGramsChange(100)}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${grams === 100 ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                    100g
                  </button>
                  <button type="button" onClick={() => handleGramsChange(servingG)}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${grams === servingG ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                    {selected.serving_size ? `1 serving (${selected.serving_size})` : `1 serving (${servingG}g)`}
                  </button>
                </div>
              )
            })()}

            {/* Serving size */}
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs text-gray-600 whitespace-nowrap">Serving size:</label>
              <input
                type="number"
                min={0.1}
                step={servingUnit === 'g' || servingUnit === 'ml' ? 1 : 0.25}
                value={servingQty}
                onChange={(e) => handleServingQtyChange(Number(e.target.value))}
                className="w-16 border border-blue-200 rounded-lg px-2 py-1 text-sm text-center font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <select
                value={servingUnit}
                onChange={(e) => handleServingUnitChange(e.target.value as ServingUnit)}
                className="border border-blue-200 rounded-lg px-2 py-1 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-blue-700"
              >
                <option value="g">g</option>
                <option value="ml">ml</option>
                <option value="oz">oz</option>
                <option value="cup">cup</option>
                <option value="tbsp">tbsp</option>
                <option value="tsp">tsp</option>
                <option value="piece">piece</option>
              </select>
            </div>

            {/* Volume / piece unit gram-equivalent: auto-populated from lookup, editable */}
            {(servingUnit === 'cup' || servingUnit === 'tbsp' || servingUnit === 'tsp' || servingUnit === 'piece') && grams === 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500">1 {servingUnit} =</span>
                <input
                  type="number"
                  min={1}
                  value={gramsPerUnit}
                  onChange={(e) => handleGramsPerUnitChange(e.target.value)}
                  placeholder="grams"
                  className="w-16 border border-blue-200 rounded-lg px-2 py-1 text-sm text-center bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <span className="text-xs text-gray-500">g</span>
                <span className="text-xs text-amber-600">Enter to calculate macros</span>
              </div>
            )}
            {grams > 0 && (
              <>
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {[
                    { label: 'Calories', value: Math.round((selected.calories_per_100g ?? 0) * factor), unit: 'kcal', color: 'text-gray-900' },
                    { label: 'Protein', value: Math.round((selected.protein_per_100g ?? 0) * factor * 10) / 10, unit: 'g', color: 'text-macro-p' },
                    { label: 'Carbs', value: Math.round((selected.carbs_per_100g ?? 0) * factor * 10) / 10, unit: 'g', color: 'text-macro-c' },
                    { label: 'Fat', value: Math.round((selected.fat_per_100g ?? 0) * factor * 10) / 10, unit: 'g', color: 'text-macro-f' },
                  ].map(({ label, value, unit, color }) => (
                    <div key={label} className="bg-white rounded-lg p-2 text-center">
                      <p className={`text-sm font-bold ${color}`}>{value}</p>
                      <p className="text-xs text-gray-400">{unit}</p>
                      <p className="text-xs text-gray-400 hidden sm:block">{label}</p>
                    </div>
                  ))}
                </div>
                {(servingUnit === 'cup' || servingUnit === 'tbsp' || servingUnit === 'tsp' || servingUnit === 'piece') && gramsPerUnit && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-gray-400">1 {servingUnit} ≈ {gramsPerUnit}g</span>
                    <button
                      type="button"
                      onClick={() => { setGramsPerUnit(''); setGrams(0) }}
                      className="text-xs text-gray-400 hover:text-blue-600 underline"
                    >
                      change
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}
