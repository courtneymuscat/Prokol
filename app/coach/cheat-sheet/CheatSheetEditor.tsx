'use client'

import React, { useEffect, useState, useRef } from 'react'

type TaggedFood = {
  id: string
  food_name: string
  serve_category: string
  subcategory: string | null
  secondary_categories: string[]
  serving_desc: string | null
  household_measure: string | null
  calories_per_serve: number | null
  protein_per_serve: number | null
  carbs_per_serve: number | null
  fat_per_serve: number | null
}

type EditDraft = {
  serve_category: string
  subcategory: string | null
  secondary_categories: string[]
  serving_desc: string
  household_measure: string
  calories_per_serve: string
  protein_per_serve: string
  carbs_per_serve: string
  fat_per_serve: string
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

const SEC_LABELS: Record<string, string> = { fat: '+ 1 fat serve', carb: '+ 1 carb serve', fat_half: '+ ½ fat serve', carb_half: '+ ½ carb serve', protein_half: '+ ½ protein serve', protein: '+ 1 protein serve' }
const SEC_COLORS: Record<string, string> = { fat: 'bg-green-100 text-green-700', carb: 'bg-purple-100 text-purple-700', fat_half: 'bg-green-50 text-green-600', carb_half: 'bg-purple-50 text-purple-600', protein_half: 'bg-pink-50 text-pink-600', protein: 'bg-pink-100 text-pink-700' }

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
  const [householdMeasure, setHouseholdMeasure] = useState('')
  const [category, setCategory] = useState('protein')
  const [subcategory, setSubcategory] = useState<string | null>(null)
  const [secondary, setSecondary] = useState<string[]>([])
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [saving, setSaving] = useState(false)
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
    setSearchQuery('')  // clear so debounce doesn't re-fire
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
      subcategory: subcategory ?? null,
      secondary_categories: secondary,
      serving_desc: servingDesc || `${g}g`,
      household_measure: householdMeasure.trim() || null,
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
    setHouseholdMeasure('')
    setSubcategory(null)
    setSecondary([])
    setAdding(false)
  }

  async function removeTag(id: string) {
    setTagged(p => p.filter(f => f.id !== id))
    await fetch(`/api/coach/food-serves/${id}`, { method: 'DELETE' })
  }

  function startEdit(f: TaggedFood) {
    setEditingId(f.id)
    setEditDraft({
      serve_category: f.serve_category,
      subcategory: f.subcategory ?? null,
      secondary_categories: f.secondary_categories ?? [],
      serving_desc: f.serving_desc ?? '',
      household_measure: f.household_measure ?? '',
      calories_per_serve: String(f.calories_per_serve ?? ''),
      protein_per_serve: String(f.protein_per_serve ?? ''),
      carbs_per_serve: String(f.carbs_per_serve ?? ''),
      fat_per_serve: String(f.fat_per_serve ?? ''),
    })
  }

  async function saveEdit() {
    if (!editingId || !editDraft) return
    setSaving(true)
    const body = {
      serve_category: editDraft.serve_category,
      subcategory: editDraft.subcategory ?? null,
      secondary_categories: editDraft.secondary_categories,
      serving_desc: editDraft.serving_desc || null,
      household_measure: editDraft.household_measure || null,
      calories_per_serve: parseFloat(editDraft.calories_per_serve) || null,
      protein_per_serve: parseFloat(editDraft.protein_per_serve) || null,
      carbs_per_serve: parseFloat(editDraft.carbs_per_serve) || null,
      fat_per_serve: parseFloat(editDraft.fat_per_serve) || null,
    }
    const r = await fetch(`/api/coach/food-serves/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const d = await r.json()
    if (d.food) setTagged(p => p.map(f => f.id === editingId ? d.food : f))
    setEditingId(null)
    setEditDraft(null)
    setSaving(false)
  }

  if (loading) return <div className="py-20 text-center text-gray-400 text-sm animate-pulse">Loading…</div>

  const selectedCat = CATEGORIES.find(c => c.id === category)

  const SUBGROUP_LABELS: Record<string, string> = {
    lean_protein: '🥩 Lean / Animal', plant_protein: '🌱 Plant-Based',
    grain: '🌾 Grains', bread: '🍞 Bread', starchy_veg: '🥔 Starchy Veg', cereal: '🥣 Cereal',
    seed: '🌻 Seeds', nut: '🥜 Nuts', nut_butter: '🥜 Nut Butter', oil: '🫒 Oils', cheese: '🧀 Cheese',
  }

  function groupBySubcategory(foods: TaggedFood[]): Array<{ label: string | null; items: TaggedFood[] }> {
    const map = new Map<string, TaggedFood[]>()
    for (const f of foods) {
      const key = f.subcategory ?? '_none'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(f)
    }
    const result: Array<{ label: string | null; items: TaggedFood[] }> = []
    const none = map.get('_none')
    if (none?.length) result.push({ label: null, items: none })
    for (const [key, items] of map) {
      if (key !== '_none') result.push({ label: SUBGROUP_LABELS[key] ?? key, items })
    }
    return result
  }

  // Inline edit panel rendered inside a food card
  const EditPanel = ({ f }: { f: TaggedFood }) => {
    if (editingId !== f.id || !editDraft) return null
    const d = editDraft
    const setD = (patch: Partial<EditDraft>) => setEditDraft(prev => prev ? { ...prev, ...patch } : prev)
    const editCat = CATEGORIES.find(c => c.id === d.serve_category)
    return (
      <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 space-y-3">
        <p className="text-xs font-semibold text-gray-700">Editing: {f.food_name}</p>

        {/* Category */}
        <div>
          <label className="text-xs text-gray-500 block mb-1.5">Category</label>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(c => (
              <button key={c.id} onClick={() => setD({ serve_category: c.id, subcategory: null })}
                className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${d.serve_category === c.id ? `${c.badge} border-current` : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Subcategory for protein */}
        {d.serve_category === 'protein' && (
          <div>
            <label className="text-xs text-gray-500 block mb-1.5">Protein type</label>
            <div className="flex gap-2">
              {[{ id: 'lean_protein', label: '🥩 Animal / Lean' }, { id: 'plant_protein', label: '🌱 Plant-Based' }].map(opt => (
                <button key={opt.id} onClick={() => setD({ subcategory: d.subcategory === opt.id ? null : opt.id })}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${d.subcategory === opt.id ? 'bg-pink-100 text-pink-700 border-pink-300' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Serving info */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Serving description</label>
            <input value={d.serving_desc} onChange={e => setD({ serving_desc: e.target.value })}
              placeholder="e.g. 120g raw" className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Household measure</label>
            <input value={d.household_measure} onChange={e => setD({ household_measure: e.target.value })}
              placeholder="e.g. 1 palm, ½ cup" className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
        </div>

        {/* Macros per serve */}
        <div>
          <label className="text-xs text-gray-500 block mb-1.5">Macros per serve</label>
          <div className="grid grid-cols-4 gap-2">
            {([['calories_per_serve','Cal','text-gray-600'],['protein_per_serve','Protein g','text-pink-600'],['carbs_per_serve','Carbs g','text-purple-600'],['fat_per_serve','Fat g','text-green-600']] as const).map(([key, label, color]) => (
              <div key={key}>
                <label className={`text-[10px] font-semibold block mb-0.5 ${color}`}>{label}</label>
                <input type="number" value={d[key]} onChange={e => setD({ [key]: e.target.value } as Partial<EditDraft>)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            ))}
          </div>
        </div>

        {/* Secondary categories */}
        <div>
          <label className="text-xs text-gray-500 block mb-1.5">Also uses</label>
          <div className="flex flex-wrap gap-2">
            {(['fat', 'carb', 'fat_half', 'carb_half', 'protein_half', 'protein'] as const).map(s => (
              <label key={s} className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={d.secondary_categories.includes(s)}
                  onChange={e => setD({ secondary_categories: e.target.checked ? [...d.secondary_categories, s] : d.secondary_categories.filter(x => x !== s) })}
                  className="rounded border-gray-300" />
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${SEC_COLORS[s]}`}>{SEC_LABELS[s]}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={saveEdit} disabled={saving}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button onClick={() => { setEditingId(null); setEditDraft(null) }}
            className="px-4 py-2 bg-white border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:border-gray-300 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    )
  }

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
                  onMouseDown={(e) => { e.preventDefault(); selectFood(f) }}
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
                <label className="text-xs text-gray-500 block mb-1">Gram label (optional)</label>
                <input
                  value={servingDesc}
                  onChange={e => setServingDesc(e.target.value)}
                  placeholder={`e.g. ${servingG || 100}g raw`}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Household measure <span className="text-gray-400">(shown big on client cheat sheet)</span></label>
              <input
                value={householdMeasure}
                onChange={e => setHouseholdMeasure(e.target.value)}
                placeholder="e.g. 1 palm, ⅓ cup, 2 tbsp, 1 medium"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-gray-400 mt-1">For clients who don&apos;t weigh — cups, tbsp, palms, pieces.</p>
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
                    onClick={() => { setCategory(c.id); setSubcategory(null) }}
                    className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${category === c.id ? `${c.badge} border-current` : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {category === 'protein' && (
              <div>
                <label className="text-xs text-gray-500 block mb-2">Protein type</label>
                <div className="flex gap-2">
                  {[
                    { id: 'lean_protein',  label: '🥩 Animal / Lean' },
                    { id: 'plant_protein', label: '🌱 Plant-Based' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setSubcategory(subcategory === opt.id ? null : opt.id)}
                      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                        subcategory === opt.id
                          ? 'bg-pink-100 text-pink-700 border-pink-300'
                          : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {category === 'carb' && (
              <div>
                <label className="text-xs text-gray-500 block mb-2">Carb type <span className="text-gray-400 font-normal">(optional — groups on client cheat sheet)</span></label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'grain',       label: '🌾 Grains' },
                    { id: 'bread',       label: '🍞 Bread' },
                    { id: 'starchy_veg', label: '🥔 Starchy Veg' },
                    { id: 'cereal',      label: '🥣 Cereal' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setSubcategory(subcategory === opt.id ? null : opt.id)}
                      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                        subcategory === opt.id
                          ? 'bg-purple-100 text-purple-700 border-purple-300'
                          : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {category === 'fat' && (
              <div>
                <label className="text-xs text-gray-500 block mb-2">Fat type <span className="text-gray-400 font-normal">(optional)</span></label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'nut',        label: '🥜 Nuts' },
                    { id: 'nut_butter', label: '🥜 Nut Butter' },
                    { id: 'seed',       label: '🌻 Seeds' },
                    { id: 'oil',        label: '🫒 Oils' },
                    { id: 'cheese',     label: '🧀 Cheese' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setSubcategory(subcategory === opt.id ? null : opt.id)}
                      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                        subcategory === opt.id
                          ? 'bg-green-100 text-green-700 border-green-300'
                          : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-gray-500 block mb-2">Also uses (optional — for dual-serve foods like salmon, eggs)</label>
              <div className="grid grid-cols-2 gap-2">
                {(['fat', 'carb', 'fat_half', 'carb_half', 'protein_half', 'protein'] as const).map(s => (
                  <label key={s} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={secondary.includes(s)}
                      onChange={e => setSecondary(p => e.target.checked ? [...p, s] : p.filter(x => x !== s))}
                      className="rounded border-gray-300"
                    />
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${SEC_COLORS[s]}`}>{SEC_LABELS[s]}</span>
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
                      <React.Fragment key={f.id}>
                      <tr className="hover:bg-white/80 transition-colors">
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
                          <div className="flex items-center gap-1">
                            <button onClick={() => startEdit(f)} className="text-gray-300 hover:text-blue-400 transition-colors" title="Edit">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button onClick={() => removeTag(f.id)} className="text-gray-300 hover:text-red-400 transition-colors text-xs">✕</button>
                          </div>
                        </td>
                      </tr>
                      {editingId === f.id && (
                        <tr>
                          <td colSpan={7} className="p-0"><EditPanel f={f} /></td>
                        </tr>
                      )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-5 pb-4 space-y-3">
                {groupBySubcategory(catFoods).map(({ label, items }) => (
                  <div key={label ?? '_none'}>
                    {label && (
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 mt-1">{label}</p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                      {items.map(f => (
                        <div key={f.id} className="bg-white rounded-xl overflow-hidden group">
                          <div className="px-3.5 py-2.5 flex items-start gap-2">
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
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 mt-0.5">
                              <button onClick={() => startEdit(f)} className="text-gray-300 hover:text-blue-400 transition-colors" title="Edit">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              </button>
                              <button onClick={() => removeTag(f.id)} className="text-gray-300 hover:text-red-400 transition-colors text-xs">✕</button>
                            </div>
                          </div>
                          <EditPanel f={f} />
                        </div>
                      ))}
                    </div>
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
