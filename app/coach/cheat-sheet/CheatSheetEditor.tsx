'use client'

import { useEffect, useState, useRef } from 'react'

type TaggedFood = {
  id: string
  food_name: string
  serve_category: string
  secondary_categories: string[]
  serving_desc: string | null
  calories_per_serve: number | null
  protein_per_serve: number | null
  carbs_per_serve: number | null
  fat_per_serve: number | null
}

type SearchResult = {
  id: string
  name: string
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  unit?: string
}

const CATEGORIES = [
  { id: 'protein',   label: 'Protein',     serve: '1 serve = ~30g protein',  color: 'bg-pink-50 border-pink-200',     badge: 'bg-pink-100 text-pink-700',     dot: 'bg-pink-400' },
  { id: 'carb',      label: 'Carbs',       serve: '1 serve = ~20g carbs',    color: 'bg-purple-50 border-purple-200', badge: 'bg-purple-100 text-purple-700', dot: 'bg-purple-400' },
  { id: 'fruit',     label: 'Fruit',       serve: '1 serve = ~20g carbs',    color: 'bg-orange-50 border-orange-200', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-400' },
  { id: 'fat',       label: 'Fats',        serve: '1 serve = ~10g fat',      color: 'bg-green-50 border-green-200',   badge: 'bg-green-100 text-green-700',   dot: 'bg-green-400' },
  { id: 'condiment', label: 'Condiments',  serve: '~1 fat or carb serve',    color: 'bg-blue-50 border-blue-200',     badge: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-400' },
  { id: 'veg',       label: 'Vegetables',  serve: 'Unlimited / free',        color: 'bg-emerald-50 border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-400' },
  { id: 'free',      label: 'Free Foods',  serve: 'Unlimited / ~0 cal',      color: 'bg-gray-50 border-gray-200',     badge: 'bg-gray-100 text-gray-600',     dot: 'bg-gray-400' },
]

const SEC_LABELS: Record<string, string> = { fat: '+ fat serve', carb: '+ carb serve' }
const SEC_COLORS: Record<string, string> = { fat: 'bg-green-100 text-green-700', carb: 'bg-purple-100 text-purple-700' }

// Calculate per-serve macros given serving_g and per-100g macros
function perServe(per100: number, servingG: number) {
  return Math.round((per100 * servingG) / 100 * 10) / 10
}

export default function CheatSheetEditor() {
  const [tagged, setTagged] = useState<TaggedFood[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'simple' | 'detailed'>('simple')

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedFood, setSelectedFood] = useState<SearchResult | null>(null)
  const [servingG, setServingG] = useState('100')
  const [servingDesc, setServingDesc] = useState('')
  const [category, setCategory] = useState('protein')
  const [secondary, setSecondary] = useState<string[]>([])
  const [adding, setAdding] = useState(false)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/coach/food-serves')
      .then(r => r.json())
      .then(d => setTagged(d.foods ?? []))
      .finally(() => setLoading(false))
  }, [])

  // Debounced food search
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return }
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(async () => {
      setSearching(true)
      const r = await fetch(`/api/foods/search?q=${encodeURIComponent(searchQuery)}`)
      const data = await r.json()
      setSearchResults(data ?? [])
      setSearching(false)
    }, 300)
    return () => { if (searchRef.current) clearTimeout(searchRef.current) }
  }, [searchQuery])

  function selectFood(food: SearchResult) {
    setSelectedFood(food)
    setSearchResults([])
    setSearchQuery(food.name)
    // Auto-guess serving size based on category
    setServingG('100')
    setServingDesc('')
  }

  async function addTag() {
    if (!selectedFood) return
    setAdding(true)
    const g = parseFloat(servingG) || 100
    const body = {
      food_name: selectedFood.name,
      food_db_id: selectedFood.id,
      serve_category: category,
      secondary_categories: secondary,
      serving_desc: servingDesc || `${g}g`,
      calories_per_serve: perServe(selectedFood.calories_per_100g, g),
      protein_per_serve: perServe(selectedFood.protein_per_100g, g),
      carbs_per_serve: perServe(selectedFood.carbs_per_100g, g),
      fat_per_serve: perServe(selectedFood.fat_per_100g, g),
    }
    const r = await fetch('/api/coach/food-serves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const d = await r.json()
    setTagged(p => {
      const existing = p.findIndex(f => f.food_name === selectedFood.name)
      return existing >= 0
        ? p.map((f, i) => i === existing ? d.food : f)
        : [d.food, ...p]
    })
    setSelectedFood(null)
    setSearchQuery('')
    setServingG('100')
    setServingDesc('')
    setSecondary([])
    setAdding(false)
  }

  async function removeTag(id: string) {
    setTagged(p => p.filter(f => f.id !== id))
    await fetch(`/api/coach/food-serves/${id}`, { method: 'DELETE' })
  }

  if (loading) return <div className="py-20 text-center text-gray-400 text-sm animate-pulse">Loading…</div>

  const selectedCat = CATEGORIES.find(c => c.id === category)

  return (
    <div className="space-y-6">

      {/* How it works */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 space-y-1.5">
        <p className="text-sm font-semibold text-blue-900">How it works</p>
        <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
          <li>Search any food and tag it with a serve category — this builds your cheat sheet</li>
          <li>When clients log that food, the system automatically shows their serve count</li>
          <li>Tag foods as <strong>Fruit</strong> so fruit carbs count separately from starchy carbs</li>
          <li>Add "also uses" for dual-serve foods (e.g. salmon = protein + fat)</li>
        </ul>
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="text-[11px] font-semibold bg-white border border-blue-100 rounded px-2 py-0.5 text-blue-700">1 Protein serve = 30g protein</span>
          <span className="text-[11px] font-semibold bg-white border border-blue-100 rounded px-2 py-0.5 text-blue-700">1 Carb serve = 20g carbs</span>
          <span className="text-[11px] font-semibold bg-white border border-blue-100 rounded px-2 py-0.5 text-blue-700">1 Fat serve = 10g fat</span>
        </div>
        <p className="text-[11px] text-blue-600 pt-0.5">
          Clients see a &quot;Food Cheat Sheet&quot; link in their food log only after you set their daily serve targets in the client&apos;s Serve Guide tab.
        </p>
      </div>

      {/* Add food panel */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Tag a Food</h3>

        {/* Food search */}
        <div className="relative">
          <input
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setSelectedFood(null) }}
            placeholder="Search food database…"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-20 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-56 overflow-y-auto">
              {searchResults.map(f => (
                <button
                  key={f.id}
                  onClick={() => selectFood(f)}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                >
                  <p className="text-sm font-medium text-gray-900">{f.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    per 100g: {Math.round(f.calories_per_100g)} kcal · P {f.protein_per_100g}g · C {f.carbs_per_100g}g · F {f.fat_per_100g}g
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedFood && (
          <div className="space-y-3 pt-1">
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-sm font-semibold text-gray-900">{selectedFood.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                per 100g: {Math.round(selectedFood.calories_per_100g)} kcal · P {selectedFood.protein_per_100g}g · C {selectedFood.carbs_per_100g}g · F {selectedFood.fat_per_100g}g
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">1 serve = how many grams?</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={servingG}
                    onChange={e => setServingG(e.target.value)}
                    className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="100"
                  />
                  <span className="text-sm text-gray-400 self-center">g</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Serving label (optional)</label>
                <input
                  value={servingDesc}
                  onChange={e => setServingDesc(e.target.value)}
                  placeholder={`e.g. ${servingG || 100}g raw`}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Show calculated macros for this serving */}
            {servingG && parseFloat(servingG) > 0 && (
              <div className="flex gap-3 text-xs">
                {[
                  { label: 'Cal', val: Math.round(selectedFood.calories_per_100g * parseFloat(servingG) / 100), color: 'text-gray-600' },
                  { label: 'Protein', val: perServe(selectedFood.protein_per_100g, parseFloat(servingG)), color: 'text-pink-600' },
                  { label: 'Carbs', val: perServe(selectedFood.carbs_per_100g, parseFloat(servingG)), color: 'text-purple-600' },
                  { label: 'Fat', val: perServe(selectedFood.fat_per_100g, parseFloat(servingG)), color: 'text-green-600' },
                ].map(m => (
                  <span key={m.label} className={`font-semibold ${m.color}`}>{m.label}: {m.val}</span>
                ))}
              </div>
            )}

            <div>
              <label className="text-xs text-gray-500 block mb-2">Primary serve category</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setCategory(c.id)}
                    className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${category === c.id ? `${c.badge} border-current` : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-2">Also uses (optional — for dual-serve foods like salmon, eggs)</label>
              <div className="flex gap-3">
                {(['fat', 'carb'] as const).map(s => (
                  <label key={s} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={secondary.includes(s)}
                      onChange={e => setSecondary(p => e.target.checked ? [...p, s] : p.filter(x => x !== s))}
                      className="rounded border-gray-300"
                    />
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${SEC_COLORS[s]}`}>+ 1 {s} serve</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={addTag}
              disabled={adding}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {adding ? 'Saving…' : `Add "${selectedFood.name}" to ${selectedCat?.label ?? category} list`}
            </button>
          </div>
        )}
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-3">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          <button onClick={() => setView('simple')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === 'simple' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Simple</button>
          <button onClick={() => setView('detailed')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === 'detailed' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Detailed</button>
        </div>
        <p className="text-xs text-gray-400">{tagged.length} foods tagged</p>
      </div>

      {tagged.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-12 text-center">
          <p className="text-gray-500 text-sm font-medium">No foods tagged yet</p>
          <p className="text-gray-400 text-xs mt-1">Search for a food above to get started</p>
        </div>
      )}

      {/* Category groups */}
      {CATEGORIES.map(cat => {
        const catFoods = tagged.filter(f => f.serve_category === cat.id)
        if (catFoods.length === 0) return null
        return (
          <div key={cat.id} className={`rounded-2xl border ${cat.color} overflow-hidden`}>
            <div className="px-5 py-3.5 flex items-center gap-3">
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cat.dot}`} />
              <div className="flex-1">
                <h2 className="text-sm font-bold text-gray-900">{cat.label}</h2>
                <p className="text-xs text-gray-500">{cat.serve}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cat.badge}`}>{catFoods.length}</span>
            </div>

            {view === 'detailed' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-t border-white/60">
                      <th className="text-left px-5 py-2 text-xs font-semibold text-gray-400">Food / Serving</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-400 text-right whitespace-nowrap">Cal</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-400 text-right whitespace-nowrap">Carbs g</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-400 text-right whitespace-nowrap">Fat g</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-400 text-right whitespace-nowrap">Protein g</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-400 text-right">Also uses</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/60 bg-white/50">
                    {catFoods.map(f => (
                      <tr key={f.id} className="hover:bg-white/80 transition-colors">
                        <td className="px-5 py-2.5">
                          <span className="font-medium text-gray-900">{f.food_name}</span>
                          {f.serving_desc && <span className="text-gray-400 text-xs ml-2">{f.serving_desc}</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums text-xs">{f.calories_per_serve ?? '—'}</td>
                        <td className="px-3 py-2.5 text-right text-purple-700 font-medium tabular-nums text-xs">{f.carbs_per_serve ?? '—'}</td>
                        <td className="px-3 py-2.5 text-right text-green-700 font-medium tabular-nums text-xs">{f.fat_per_serve ?? '—'}</td>
                        <td className="px-3 py-2.5 text-right text-pink-700 font-medium tabular-nums text-xs">{f.protein_per_serve ?? '—'}</td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex gap-1 justify-end flex-wrap">
                            {(f.secondary_categories ?? []).map(s => (
                              <span key={s} className={`text-[10px] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap ${SEC_COLORS[s] ?? 'bg-gray-100 text-gray-500'}`}>
                                {SEC_LABELS[s] ?? s}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-2 py-2.5">
                          <button onClick={() => removeTag(f.id)} className="text-gray-300 hover:text-red-400 transition-colors text-xs">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                {catFoods.map(f => (
                  <div key={f.id} className="bg-white rounded-xl px-3.5 py-2.5 flex items-start gap-2 group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{f.food_name}</p>
                      {f.serving_desc && <p className="text-xs text-gray-400">{f.serving_desc}</p>}
                      {(f.secondary_categories ?? []).length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {f.secondary_categories.map(s => (
                            <span key={s} className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${SEC_COLORS[s] ?? 'bg-gray-100 text-gray-500'}`}>
                              {SEC_LABELS[s] ?? s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removeTag(f.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all flex-shrink-0 text-xs mt-0.5"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
