'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import FoodSearch, { type FoodResult } from './FoodSearch'
import EditFoodLogForm from './EditFoodLogForm'
import MealScanModal from './MealScanModal'
import { calcServes, sumServes, isFruitByName, fmt as fmtServe, type ServeTargets } from '@/lib/serves'

const MEALS = [
  { key: 'breakfast' as const, label: 'Breakfast' },
  { key: 'lunch' as const, label: 'Lunch' },
  { key: 'dinner' as const, label: 'Dinner' },
  { key: 'snacks' as const, label: 'Snacks' },
]

type MealKey = 'breakfast' | 'lunch' | 'dinner' | 'snacks'

type FoodLog = {
  id: string
  food_name: string | null
  calories: number
  protein: number
  carbs: number
  fat: number
  notes: string | null        // AI scan ingredient JSON
  meal_notes: string | null   // user-entered notes
  meal_photo_url: string | null
  serving_description: string | null
}

function todayString() {
  const d = new Date()
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function sumMacros(logs: FoodLog[]) {
  return logs.reduce(
    (acc, l) => ({
      calories: acc.calories + (l.calories ?? 0),
      protein: acc.protein + (l.protein ?? 0),
      carbs: acc.carbs + (l.carbs ?? 0),
      fat: acc.fat + (l.fat ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )
}

function fmt1(n: number) { return Math.round(n * 10) / 10 }

type MealIngredient = { name: string; grams: number; calories: number; protein: number; carbs: number; fat: number }

function parseMealIngredients(notes: string | null): MealIngredient[] | null {
  if (!notes) return null
  try {
    const parsed = JSON.parse(notes)
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0].name === 'string') return parsed
  } catch { /* not JSON */ }
  return null
}

export default function DailyLog({
  canScanMeal = false,
  foodLogAccess = 'full',
  targetCalories = null,
  targetProtein = null,
  targetCarbs = null,
  targetFat = null,
}: {
  canScanMeal?: boolean
  foodLogAccess?: 'full' | 'no_scan' | 'note_only' | 'off'
  targetCalories?: number | null
  targetProtein?: number | null
  targetCarbs?: number | null
  targetFat?: number | null
}) {
  const [date, setDate] = useState(todayString)
  const [logsByMeal, setLogsByMeal] = useState<Record<MealKey, FoodLog[]>>({
    breakfast: [], lunch: [], dinner: [], snacks: [],
  })
  const [loading, setLoading] = useState(true)
  const [addingTo, setAddingTo] = useState<MealKey | null>(null)
  const [pendingEntry, setPendingEntry] = useState<{ food: FoodResult; grams: number; servingDescription?: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [logError, setLogError] = useState<string | null>(null)
  const [justAdded, setJustAdded] = useState(false)
  const [searchKey, setSearchKey] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)
  const [scanningMeal, setScanningMeal] = useState<MealKey | null>(null)
  const [noteOpenId, setNoteOpenId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [uploadingPhotoId, setUploadingPhotoId] = useState<string | null>(null)
  const [noteError, setNoteError] = useState<string | null>(null)
  // Meal-level notes (one per meal per day, stored in meal_notes table)
  const [mealNotes, setMealNotes] = useState<Record<string, { note: string | null; photo_url: string | null }>>({})
  const [mealNoteOpen, setMealNoteOpen] = useState<MealKey | null>(null)
  const [mealNoteDraft, setMealNoteDraft] = useState('')
  const [uploadingMealNote, setUploadingMealNote] = useState<MealKey | null>(null)
  // Serve tracking
  const [serveTargets, setServeTargets] = useState<ServeTargets | null>(null)
  const [foodServeMap, setFoodServeMap] = useState<Record<string, {
    category: string; secondary: string[]
    protein_per_serve: number | null; carbs_per_serve: number | null; fat_per_serve: number | null
  }>>({})

  // Copy meal (copy current day/meal TO another date)
  const [copyingMeal, setCopyingMeal] = useState<MealKey | 'all' | null>(null)
  const [copyTargetDate, setCopyTargetDate] = useState('')
  const [isCopying, setIsCopying] = useState(false)
  const [copiedMsg, setCopiedMsg] = useState<string | null>(null)
  // Copy from (copy FROM another date INTO current date)
  const [copyFromOpen, setCopyFromOpen] = useState(false)
  const [copyFromDate, setCopyFromDate] = useState('')
  const [copyFromMeal, setCopyFromMeal] = useState<MealKey | 'all'>('all')
  const [isCopyingFrom, setIsCopyingFrom] = useState(false)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }

    const [{ data }, { data: mealNoteData }] = await Promise.all([
      supabase
        .from('food_logs')
        .select('id, food_name, calories, protein, carbs, fat, notes, meal_notes, meal_photo_url, meal_type, serving_description')
        .eq('user_id', session.user.id)
        .eq('log_date', date)
        .order('created_at', { ascending: true }),
      supabase
        .from('meal_notes')
        .select('meal_type, note, photo_url')
        .eq('user_id', session.user.id)
        .eq('log_date', date),
    ])

    const grouped: Record<MealKey, FoodLog[]> = { breakfast: [], lunch: [], dinner: [], snacks: [] }
    for (const log of data ?? []) {
      const meal = (log.meal_type ?? 'breakfast') as MealKey
      if (meal in grouped) grouped[meal].push(log as FoodLog)
    }
    setLogsByMeal(grouped)

    const notesMap: Record<string, { note: string | null; photo_url: string | null }> = {}
    for (const n of mealNoteData ?? []) notesMap[n.meal_type] = { note: n.note, photo_url: n.photo_url }
    setMealNotes(notesMap)

    setLoading(false)
  }, [date])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  useEffect(() => {
    Promise.all([
      fetch('/api/client/serve-targets').then(r => r.json()),
      fetch('/api/client/food-serves').then(r => r.json()),
    ]).then(([st, fs]) => {
      if (st.targets) setServeTargets(st.targets)
      if (fs.map) setFoodServeMap(fs.map)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    function onMealLogged() { fetchLogs() }
    window.addEventListener('meal-logged', onMealLogged)
    return () => window.removeEventListener('meal-logged', onMealLogged)
  }, [fetchLogs])

  async function handleLog() {
    if (!pendingEntry || !addingTo) return
    setSaving(true)
    setLogError(null)

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLogError('Not authenticated'); setSaving(false); return }

    const { food, grams } = pendingEntry
    const factor = grams / 100

    const { error } = await supabase.from('food_logs').insert({
      user_id: session.user.id,
      food_name: food.name,
      calories: Math.round(food.calories_per_100g * factor),
      protein: fmt1(food.protein_per_100g * factor),
      carbs: fmt1(food.carbs_per_100g * factor),
      fat: fmt1(food.fat_per_100g * factor),
      meal_type: addingTo,
      log_date: date,
      serving_description: pendingEntry.servingDescription ?? null,
    })

    if (error) {
      setLogError(error.message)
      setSaving(false)
      return
    }

    // Save to history (non-blocking)
    supabase.from('user_food_history').insert({
      user_id: session.user.id,
      food_id: food.id,
      name: food.name,
      calories_per_100g: food.calories_per_100g,
      protein_per_100g: food.protein_per_100g,
      carbs_per_100g: food.carbs_per_100g,
      fat_per_100g: food.fat_per_100g,
    })

    setSaving(false)
    setPendingEntry(null)
    setSearchKey((k) => k + 1) // reset FoodSearch
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 2000)
    fetchLogs()
  }

  function startEdit(log: FoodLog) {
    setEditingId(log.id)
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    await supabase.from('food_logs').delete().eq('id', id)
    fetchLogs()
  }

  async function handleCopyMeal(mealKey: MealKey | 'all') {
    if (!copyTargetDate) return
    setIsCopying(true)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setIsCopying(false); return }

    const logsToInsert = mealKey === 'all'
      ? Object.entries(logsByMeal).flatMap(([mk, logs]) =>
          logs.map((log) => ({
            user_id: session.user.id,
            food_name: log.food_name,
            calories: log.calories,
            protein: log.protein,
            carbs: log.carbs,
            fat: log.fat,
            meal_type: mk,
            log_date: copyTargetDate,
            notes: log.notes,
          }))
        )
      : logsByMeal[mealKey].map((log) => ({
          user_id: session.user.id,
          food_name: log.food_name,
          calories: log.calories,
          protein: log.protein,
          carbs: log.carbs,
          fat: log.fat,
          meal_type: mealKey,
          log_date: copyTargetDate,
          notes: log.notes,
        }))

    if (logsToInsert.length) await supabase.from('food_logs').insert(logsToInsert)
    setIsCopying(false)
    setCopyingMeal(null)
    setCopyTargetDate('')
    const label = mealKey === 'all' ? 'Day' : MEALS.find((m) => m.key === mealKey)?.label ?? mealKey
    setCopiedMsg(`${label} copied to ${copyTargetDate}`)
    setTimeout(() => setCopiedMsg(null), 3000)
    if (copyTargetDate === date) fetchLogs()
  }

  async function handleCopyFrom() {
    if (!copyFromDate) return
    setIsCopyingFrom(true)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setIsCopyingFrom(false); return }

    let query = supabase
      .from('food_logs')
      .select('food_name, calories, protein, carbs, fat, meal_type, notes')
      .eq('user_id', session.user.id)
      .eq('log_date', copyFromDate)

    if (copyFromMeal !== 'all') query = query.eq('meal_type', copyFromMeal)

    const { data: sourceLogs } = await query

    if (sourceLogs?.length) {
      const rows = sourceLogs.map((log) => ({
        user_id: session.user.id,
        food_name: log.food_name,
        calories: log.calories,
        protein: log.protein,
        carbs: log.carbs,
        fat: log.fat,
        meal_type: log.meal_type,
        log_date: date,
        notes: log.notes,
      }))
      await supabase.from('food_logs').insert(rows)
    }

    setIsCopyingFrom(false)
    setCopyFromOpen(false)
    setCopyFromDate('')
    setCopyFromMeal('all')
    const count = sourceLogs?.length ?? 0
    const mealLabel = copyFromMeal === 'all' ? 'all meals' : MEALS.find((m) => m.key === copyFromMeal)?.label ?? copyFromMeal
    setCopiedMsg(count > 0 ? `Copied ${count} item${count !== 1 ? 's' : ''} (${mealLabel}) from ${copyFromDate}` : `No food logged for ${mealLabel} on ${copyFromDate}`)
    setTimeout(() => setCopiedMsg(null), 3000)
    if (sourceLogs?.length) fetchLogs()
  }

  async function handleUpdate(update: {
    food_name: string | null
    serving_description: string | null
    calories: number
    protein: number
    carbs: number
    fat: number
  }) {
    if (!editingId) return
    const supabase = createClient()
    await supabase.from('food_logs').update(update).eq('id', editingId)
    setEditingId(null)
    fetchLogs()
  }

  // Returns true on success so callers can close the panel reliably
  async function saveNote(id: string, text: string): Promise<boolean> {
    setNoteError(null)
    const res = await fetch('/api/food-logs/note', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ food_log_id: id, meal_notes: text }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setNoteError(body?.error ?? `Save failed (${res.status})`)
      return false
    }
    fetchLogs()
    return true
  }

  async function uploadMealPhoto(id: string, file: File) {
    setNoteError(null)
    setUploadingPhotoId(id)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setUploadingPhotoId(null); return }

    const ext = file.name.split('.').pop() ?? 'jpg'
    const storagePath = `${session.user.id}/${id}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('meal-photos')
      .upload(storagePath, file, { upsert: true })

    if (uploadError) {
      setNoteError(`Photo upload failed: ${uploadError.message}`)
      setUploadingPhotoId(null)
      return
    }

    // Save the URL via API (admin client handles signed URL creation + DB write)
    const res = await fetch('/api/food-logs/photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ food_log_id: id, photo_path: storagePath }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setNoteError(body?.error ?? 'Failed to save photo')
      setUploadingPhotoId(null)
      return
    }

    setUploadingPhotoId(null)
    fetchLogs()
  }

  const [mealNoteError, setMealNoteError] = useState<string | null>(null)

  // Returns true on success
  async function saveMealNote(mealKey: MealKey, text: string): Promise<boolean> {
    setMealNoteError(null)
    const res = await fetch('/api/food-logs/meal-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ log_date: date, meal_type: mealKey, note: text }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setMealNoteError(body?.error ?? `Save failed (${res.status})`)
      return false
    }
    fetchLogs()
    return true
  }

  async function uploadMealNotePhoto(mealKey: MealKey, file: File) {
    setMealNoteError(null)
    setUploadingMealNote(mealKey)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setUploadingMealNote(null); return }

    const ext = file.name.split('.').pop() ?? 'jpg'
    const storagePath = `${session.user.id}/meal-${date}-${mealKey}.${ext}`

    const { error: uploadError } = await supabase.storage.from('meal-photos').upload(storagePath, file, { upsert: true })
    if (uploadError) {
      setMealNoteError(`Photo upload failed: ${uploadError.message}`)
      setUploadingMealNote(null)
      return
    }

    // Save signed URL via API
    const res = await fetch('/api/food-logs/meal-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ log_date: date, meal_type: mealKey, photo_path: storagePath }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setMealNoteError(body?.error ?? 'Failed to save photo')
    } else {
      fetchLogs()
    }
    setUploadingMealNote(null)
  }

  function getFoodCategory(foodName: string | null): string | null {
    if (!foodName) return null
    const tag = foodServeMap[foodName.toLowerCase()]
    if (tag) return tag.category
    if (isFruitByName(foodName)) return 'fruit'
    return null
  }

  const allLogs = Object.values(logsByMeal).flat()
  const totals = sumMacros(allLogs)
  const isToday = date === todayString()

  // Only count serves for cheat-sheet tagged foods — never fall back to keyword guessing
  const allLogsWithCategory = allLogs.map(l => {
    const tag = foodServeMap[l.food_name?.toLowerCase() ?? '']
    if (!tag) return { protein: l.protein, carbs: l.carbs, fat: l.fat, serve_category: null, secondary_categories: null, protein_per_serve: null, carbs_per_serve: null, fat_per_serve: null }
    return {
      protein: l.protein, carbs: l.carbs, fat: l.fat,
      serve_category: tag.category,
      secondary_categories: tag.secondary,
      protein_per_serve: tag.protein_per_serve,
      carbs_per_serve:   tag.carbs_per_serve,
      fat_per_serve:     tag.fat_per_serve,
    }
  })
  const serveUsed = sumServes(allLogsWithCategory)

  if (foodLogAccess === 'off') {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 px-5 py-6 text-center">
        <p className="text-sm font-medium text-gray-500">Food logging is not enabled for your plan.</p>
        <p className="text-xs text-gray-400 mt-1">Reach out to your coach if you have questions.</p>
      </div>
    )
  }

  const noteOnly = foodLogAccess === 'note_only'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-gray-900">Food Log</h3>
        <div className="flex items-center gap-2">
          {!isToday && (
            <button
              type="button"
              onClick={() => setDate(todayString())}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Today
            </button>
          )}
          {!noteOnly && (
            <button
              type="button"
              onClick={() => { setCopyFromOpen((o) => !o); setCopyFromDate(''); setCopyingMeal(null) }}
              title="Copy from another day into this day"
              className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${copyFromOpen ? 'bg-green-100 border-green-300 text-green-700' : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Copy from
            </button>
          )}
          {!noteOnly && allLogs.length > 0 && (
            <button
              type="button"
              onClick={() => { setCopyingMeal(copyingMeal === 'all' ? null : 'all'); setCopyTargetDate(''); setCopyFromOpen(false) }}
              title="Copy entire day to another date"
              className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${copyingMeal === 'all' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 002 2v8a2 2 0 002 2z" />
              </svg>
              Copy day
            </button>
          )}
          <input
            type="date"
            value={date}
            onChange={(e) => { setDate(e.target.value); setAddingTo(null); setPendingEntry(null); setCopyingMeal(null); setCopyFromOpen(false) }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Hint note — shown for all coached clients (any restricted access) */}
      {foodLogAccess !== 'full' && (
        <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5">
          💡 You can log photos of your meals for your coach — tap the <span className="font-semibold">📝 note icon</span> next to any meal name.
        </p>
      )}

      {/* Copy from panel */}
      {copyFromOpen && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-green-800">Copy from:</span>
            <input
              type="date"
              value={copyFromDate}
              onChange={(e) => setCopyFromDate(e.target.value)}
              className="border border-green-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-green-700">Meal:</span>
            {([{ key: 'all', label: 'All meals' }, ...MEALS] as { key: MealKey | 'all'; label: string }[]).map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setCopyFromMeal(m.key)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${copyFromMeal === m.key ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-green-200 text-green-700 hover:bg-green-100'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCopyFrom}
              disabled={!copyFromDate || isCopyingFrom}
              className="text-xs font-semibold px-4 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white rounded-lg transition-colors"
            >
              {isCopyingFrom ? 'Copying…' : `Copy into ${date}`}
            </button>
            <button type="button" onClick={() => setCopyFromOpen(false)} className="text-xs text-green-600 hover:text-green-800">Cancel</button>
          </div>
        </div>
      )}

      {/* Copy day panel */}
      {copyingMeal === 'all' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-blue-800">Copy all meals to:</span>
          <input
            type="date"
            value={copyTargetDate}
            min={undefined}
            onChange={(e) => setCopyTargetDate(e.target.value)}
            className="border border-blue-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            type="button"
            onClick={() => handleCopyMeal('all')}
            disabled={!copyTargetDate || isCopying}
            className="text-xs font-semibold px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition-colors"
          >
            {isCopying ? 'Copying…' : 'Copy'}
          </button>
          <button type="button" onClick={() => setCopyingMeal(null)} className="text-xs text-blue-500 hover:text-blue-700">Cancel</button>
        </div>
      )}

      {copiedMsg && (
        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2 font-medium">{copiedMsg}</p>
      )}

      {/* Daily totals */}
      {!noteOnly && allLogs.length > 0 && (
        <div className="bg-gray-900 text-white rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            {isToday ? "Today's Total" : 'Daily Total'}
          </p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: 'Calories', value: Math.round(totals.calories), unit: 'kcal', color: 'text-white' },
              { label: 'Protein', value: fmt1(totals.protein), unit: 'g', color: 'text-macro-p' },
              { label: 'Carbs', value: fmt1(totals.carbs), unit: 'g', color: 'text-macro-c' },
              { label: 'Fat', value: fmt1(totals.fat), unit: 'g', color: 'text-macro-f' },
            ].map(({ label, value, unit, color }) => (
              <div key={label}>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-gray-400">{unit}</p>
                <p className="text-xs text-gray-500 hidden sm:block">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Remaining targets */}
      {!noteOnly && allLogs.length > 0 && targetCalories && (
        <div className="bg-white border border-gray-100 rounded-xl px-4 py-3">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Remaining</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              {
                label: 'Calories', unit: 'kcal',
                remaining: targetCalories - Math.round(totals.calories),
                color: 'text-gray-900',
              },
              {
                label: 'Protein', unit: 'g',
                remaining: fmt1((targetProtein ?? 0) - totals.protein),
                color: 'text-macro-p',
              },
              {
                label: 'Carbs', unit: 'g',
                remaining: fmt1((targetCarbs ?? 0) - totals.carbs),
                color: 'text-macro-c',
              },
              {
                label: 'Fat', unit: 'g',
                remaining: fmt1((targetFat ?? 0) - totals.fat),
                color: 'text-macro-f',
              },
            ].map(({ label, unit, remaining, color }) => {
              const over = remaining < 0
              return (
                <div key={label}>
                  <p className={`text-base font-bold ${over ? 'text-red-400' : color}`}>
                    {over ? `+${Math.abs(Number(remaining))}` : remaining}
                  </p>
                  <p className="text-[10px] text-gray-400">{over ? `${unit} over` : unit}</p>
                  <p className="text-[10px] text-gray-400 hidden sm:block">{label}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Serve targets progress */}
      {!noteOnly && serveTargets && (() => {
        const rows = [
          { label: 'Protein', used: serveUsed.protein, target: serveTargets.protein_serves, bar: 'bg-rose-400',  text: 'text-rose-500'  },
          { label: 'Carbs',   used: serveUsed.carb,    target: serveTargets.carb_serves,    bar: 'bg-teal-400',  text: 'text-teal-600'  },
          { label: 'Fruit',   used: serveUsed.fruit,   target: serveTargets.fruit_serves,   bar: 'bg-orange-400', text: 'text-orange-500' },
          { label: 'Fat',     used: serveUsed.fat,     target: serveTargets.fat_serves,     bar: 'bg-green-400', text: 'text-green-600' },
        ].filter(r => r.target > 0)
        if (rows.length === 0) return null
        return (
          <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 space-y-2.5">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Serve Targets</p>
            {rows.map(r => {
              const pct = Math.min((r.used / r.target) * 100, 100)
              const over = r.used > r.target
              return (
                <div key={r.label} className="flex items-center gap-3">
                  <p className={`text-xs font-semibold w-14 flex-shrink-0 ${r.text}`}>{r.label}</p>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${over ? 'bg-red-400' : r.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className={`text-xs font-semibold flex-shrink-0 w-16 text-right tabular-nums ${over ? 'text-red-500' : 'text-gray-600'}`}>
                    {fmtServe(r.used)} / {fmtServe(r.target)}
                  </p>
                </div>
              )
            })}
            <p className="text-xs text-emerald-600 font-medium pt-0.5">
              🥦 Aim for at least 5 fistfuls of vegetables today (unlimited)
            </p>
            {serveTargets.notes && (
              <p className="text-xs text-gray-400 italic whitespace-pre-wrap">{serveTargets.notes}</p>
            )}
            <p className="text-[11px] text-gray-400 leading-relaxed border-t border-gray-50 pt-2">
              💡 Serve counts only track foods from your coach&apos;s <a href="/cheat-sheet" className="underline hover:text-gray-600">Food Cheat Sheet</a>. Foods logged from general search don&apos;t count towards these targets.
            </p>
            <a
              href="/cheat-sheet"
              className="flex items-center justify-between gap-2 mt-1 px-3 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">📋</span>
                <div>
                  <p className="text-xs font-semibold text-emerald-800">Food Cheat Sheet</p>
                  <p className="text-[11px] text-emerald-600">See what counts as 1 serve of each food</p>
                </div>
              </div>
              <svg className="w-4 h-4 text-emerald-500 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        )
      })()}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
        </div>
      ) : (
        <div className="space-y-3">
          {MEALS.map((meal) => {
            const logs = logsByMeal[meal.key]
            const mt = sumMacros(logs)
            const isAdding = addingTo === meal.key

            const mealNote = mealNotes[meal.key]
            const mealNoteIsOpen = mealNoteOpen === meal.key

            return (
              <div key={meal.key} className="bg-white rounded-xl border border-gray-100">
                {/* Meal header */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-gray-900 text-sm">{meal.label}</p>
                      {/* Meal-level note / photo button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (mealNoteIsOpen) { setMealNoteOpen(null) }
                          else { setMealNoteOpen(meal.key); setMealNoteDraft(mealNote?.note ?? '') }
                        }}
                        className={`p-1 rounded transition-colors ${mealNote?.note || mealNote?.photo_url ? 'text-blue-400 hover:text-blue-600 hover:bg-blue-50' : 'text-gray-300 hover:text-gray-400 hover:bg-gray-100'}`}
                        title="Add note / photo to this meal"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                        </svg>
                      </button>
                    </div>
                    {!noteOnly && logs.length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {Math.round(mt.calories)} kcal
                        <span className="text-macro-p ml-2">P {fmt1(mt.protein)}g</span>
                        <span className="text-macro-c ml-1">C {fmt1(mt.carbs)}g</span>
                        <span className="text-macro-f ml-1">F {fmt1(mt.fat)}g</span>
                      </p>
                    )}
                    {/* Meal note preview */}
                    {mealNote?.note && (
                      <p className="text-xs text-blue-500 italic mt-0.5 truncate">{mealNote.note}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    {/* Meal photo thumbnail */}
                    {mealNote?.photo_url && (
                      <a href={mealNote.photo_url} target="_blank" rel="noopener noreferrer">
                        <img src={mealNote.photo_url} alt="Meal" className="h-9 w-12 object-cover rounded-lg border border-gray-100 hover:opacity-80 transition-opacity" />
                      </a>
                    )}
                    {!noteOnly && (!isAdding ? (
                      <>
                        {canScanMeal && (
                          <button
                            type="button"
                            onClick={() => setScanningMeal(meal.key)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                            title="Scan meal with camera"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </button>
                        )}
                        {logs.length > 0 && (
                          <button
                            type="button"
                            onClick={() => { setCopyingMeal(copyingMeal === meal.key ? null : meal.key); setCopyTargetDate('') }}
                            title={`Copy ${meal.label} to another day`}
                            className={`p-1.5 rounded-lg transition-colors ${copyingMeal === meal.key ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100'}`}
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => { setAddingTo(meal.key); setPendingEntry(null) }}
                          className="flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-gray-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Add Food
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setAddingTo(null); setPendingEntry(null) }}
                        className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded transition-colors"
                      >
                        Cancel
                      </button>
                    ))}
                  </div>
                </div>

                {/* Meal-level note / photo panel */}
                {mealNoteIsOpen && (
                  <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-3 space-y-2.5">
                    <textarea
                      value={mealNoteDraft}
                      onChange={(e) => setMealNoteDraft(e.target.value)}
                      rows={2}
                      placeholder={`Add a note about ${meal.label.toLowerCase()}…`}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none bg-white"
                    />
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 cursor-pointer bg-white border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors flex-shrink-0">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {uploadingMealNote === meal.key ? 'Uploading…' : mealNote?.photo_url ? 'Change photo' : 'Add photo'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingMealNote === meal.key}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMealNotePhoto(meal.key, f) }}
                        />
                      </label>
                      {mealNote?.photo_url && (
                        <a href={mealNote.photo_url} target="_blank" rel="noopener noreferrer">
                          <img src={mealNote.photo_url} alt="Meal photo" className="h-10 w-14 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity" />
                        </a>
                      )}
                    </div>
                    {mealNoteError && (
                      <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{mealNoteError}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={async () => { const ok = await saveMealNote(meal.key, mealNoteDraft); if (ok) { setMealNoteOpen(null); setMealNoteError(null) } }}
                        className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
                      >
                        Save note
                      </button>
                      <button
                        type="button"
                        onClick={() => { setMealNoteOpen(null); setMealNoteError(null) }}
                        className="px-3 py-1.5 text-gray-500 hover:text-gray-700 text-xs rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Copy meal panel */}
                {copyingMeal === meal.key && (
                  <div className="border-t border-gray-100 bg-blue-50/60 px-4 py-3 flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-medium text-blue-800">Copy {meal.label} to:</span>
                    <input
                      type="date"
                      value={copyTargetDate}
                      onChange={(e) => setCopyTargetDate(e.target.value)}
                      className="border border-blue-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyMeal(meal.key)}
                      disabled={!copyTargetDate || isCopying}
                      className="text-xs font-semibold px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition-colors"
                    >
                      {isCopying ? 'Copying…' : 'Copy'}
                    </button>
                    <button type="button" onClick={() => setCopyingMeal(null)} className="text-xs text-blue-500 hover:text-blue-700">Cancel</button>
                  </div>
                )}

                {/* Food items */}
                {!noteOnly && logs.length > 0 && (
                  <div className="border-t border-gray-50 divide-y divide-gray-50">
                    {logs.map((log) => (
                      <div key={log.id}>
                        {editingId === log.id ? (
                          foodServeMap[log.food_name?.toLowerCase() ?? ''] ? (
                            /* Cheat sheet food — locked, no editing */
                            <div className="px-4 py-3 bg-amber-50/60 border-t border-amber-100 space-y-2.5">
                              <div className="flex items-start gap-2">
                                <span className="text-base flex-shrink-0">📋</span>
                                <div>
                                  <p className="text-sm font-semibold text-amber-800">Added from the Food Cheat Sheet</p>
                                  <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                                    To change the serving size or food, delete this entry and re-add it from your{' '}
                                    <a href="/cheat-sheet" className="underline font-medium hover:text-amber-900">Food Cheat Sheet</a>.
                                    This keeps your serve counts accurate.
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => { handleDelete(log.id); setEditingId(null) }}
                                  className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-semibold rounded-lg border border-red-100 transition-colors"
                                >
                                  Delete entry
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="px-3 py-1.5 text-gray-500 hover:text-gray-700 text-xs rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                          <EditFoodLogForm
                            log={log}
                            onSave={(update) => handleUpdate(update)}
                            onCancel={() => setEditingId(null)}
                          />
                          )
                        ) : (() => {
                          const ingredients = parseMealIngredients(log.notes)
                          const isExpanded = expandedLogId === log.id
                          const tag = foodServeMap[log.food_name?.toLowerCase() ?? '']
                          // Exact hex colours matching serve badge text colours
                          const CAT_HEX: Record<string, string> = {
                            protein: '#f43f5e', // rose-500  — matches text-rose-500 badge
                            carb:    '#0d9488', // teal-600  — matches text-teal-600 badge
                            fruit:   '#f97316', // orange-500 — matches text-orange-500 badge
                            fat:     '#16a34a', // green-600 — matches text-green-600 badge
                          }
                          const SEC_HEX: Record<string, string> = {
                            protein: '#f43f5e', protein_half: '#f43f5e',
                            carb:    '#0d9488', carb_half:    '#0d9488',
                            fat:     '#16a34a', fat_half:     '#16a34a',
                          }
                          const primHex = tag ? (CAT_HEX[tag.category] ?? null) : null
                          const secHexes = tag ? (tag.secondary ?? []).map(s => SEC_HEX[s]).filter(Boolean) : []
                          return (
                            <div>
                              <div className="flex items-center gap-2 px-4 py-2.5 group">
                                {/* Cheat-sheet category dots — primary (larger) + secondary (smaller, same colour) */}
                                {tag && primHex && (
                                  <div className="flex flex-col gap-1 flex-shrink-0 items-center">
                                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: primHex }} />
                                    {secHexes.map((hex, i) => (
                                      <span key={i} className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: hex }} />
                                    ))}
                                  </div>
                                )}
                                {/* Expand toggle if this is a saved meal */}
                                {ingredients && (
                                  <button
                                    type="button"
                                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                    className="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors"
                                  >
                                    <svg className={`h-3.5 w-3.5 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </button>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-gray-800 font-medium truncate">
                                    {log.food_name ?? 'Food entry'}
                                  </p>
                                  {log.serving_description && (
                                    <p className="text-xs text-gray-400 truncate">{log.serving_description}</p>
                                  )}
                                  {ingredients && (
                                    <p className="text-xs text-gray-400 truncate">
                                      {ingredients.map((i) => i.name).join(', ')}
                                    </p>
                                  )}
                                  {log.meal_notes && (
                                    <p className="text-xs text-blue-500 italic truncate mt-0.5">{log.meal_notes}</p>
                                  )}
                                </div>
                                {/* Meal photo thumbnail */}
                                {log.meal_photo_url && (
                                  <a href={log.meal_photo_url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                                    <img src={log.meal_photo_url} alt="Meal" className="h-9 w-12 object-cover rounded-lg border border-gray-100 hover:opacity-80 transition-opacity" />
                                  </a>
                                )}
                                <div className="flex items-center gap-2 text-xs flex-shrink-0">
                                  <span className="font-semibold text-gray-700">{log.calories} kcal</span>
                                  <span className="text-macro-p hidden sm:inline">P {log.protein}g</span>
                                  <span className="text-macro-c hidden sm:inline">C {log.carbs}g</span>
                                  <span className="text-macro-f hidden sm:inline">F {log.fat}g</span>
                                </div>
                                {/* Serve badges — only for cheat-sheet tagged foods */}
                                {(() => {
                                  const tag = foodServeMap[log.food_name?.toLowerCase() ?? '']
                                  if (!tag) return null
                                  const ps = { protein: tag.protein_per_serve, carbs: tag.carbs_per_serve, fat: tag.fat_per_serve }
                                  const s = calcServes(log.protein, log.carbs, log.fat, tag.category, tag.secondary, ps)
                                  const badges: { label: string; color: string }[] = []
                                  if (s.protein > 0) badges.push({ label: `${fmtServe(s.protein)}P`, color: 'bg-rose-50 text-rose-500 border-rose-100' })
                                  if (s.carb > 0)    badges.push({ label: `${fmtServe(s.carb)}C`,    color: 'bg-teal-50 text-teal-600 border-teal-100' })
                                  if (s.fruit > 0)   badges.push({ label: `${fmtServe(s.fruit)} fruit`, color: 'bg-orange-50 text-orange-500 border-orange-100' })
                                  if (s.fat > 0)     badges.push({ label: `${fmtServe(s.fat)}F`,    color: 'bg-green-50 text-green-600 border-green-100' })
                                  if (badges.length === 0) return null
                                  return (
                                    <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
                                      {badges.map(b => (
                                        <span key={b.label} className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${b.color}`}>
                                          {b.label}
                                        </span>
                                      ))}
                                    </div>
                                  )
                                })()}
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {/* Note icon — always visible when note/photo exists */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (noteOpenId === log.id) { setNoteOpenId(null); setNoteError(null) }
                                      else { setNoteOpenId(log.id); setNoteDraft(log.meal_notes ?? ''); setNoteError(null) }
                                    }}
                                    className={`p-1 rounded transition-colors ${log.meal_notes || log.meal_photo_url ? 'text-blue-400 hover:text-blue-600 hover:bg-blue-50' : 'text-gray-300 opacity-0 group-hover:opacity-100 hover:text-gray-500 hover:bg-gray-100'}`}
                                    title="Note / photo"
                                  >
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                    </svg>
                                  </button>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => startEdit(log)}
                                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                      aria-label="Edit"
                                    >
                                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 11l6.536-6.536a2 2 0 012.828 2.828L11.828 13.828A2 2 0 0110 14H8v-2a2 2 0 01.586-1.414z" />
                                      </svg>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDelete(log.id)}
                                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      aria-label="Delete"
                                    >
                                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0a1 1 0 00-1-1h-4a1 1 0 00-1 1m-4 0h10" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Note / photo panel */}
                              {noteOpenId === log.id && (
                                <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-3 space-y-2.5">
                                  <textarea
                                    value={noteDraft}
                                    onChange={(e) => setNoteDraft(e.target.value)}
                                    rows={2}
                                    placeholder="Add a note about this meal…"
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none bg-white"
                                  />
                                  <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 cursor-pointer bg-white border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors flex-shrink-0">
                                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                      </svg>
                                      {uploadingPhotoId === log.id ? 'Uploading…' : log.meal_photo_url ? 'Change photo' : 'Add photo'}
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        disabled={uploadingPhotoId === log.id}
                                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMealPhoto(log.id, f) }}
                                      />
                                    </label>
                                    {log.meal_photo_url && (
                                      <a href={log.meal_photo_url} target="_blank" rel="noopener noreferrer">
                                        <img src={log.meal_photo_url} alt="Meal photo" className="h-10 w-14 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity" />
                                      </a>
                                    )}
                                  </div>
                                  {noteError && (
                                    <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{noteError}</p>
                                  )}
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={async () => { const ok = await saveNote(log.id, noteDraft); if (ok) setNoteOpenId(null) }}
                                      className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
                                    >
                                      Save note
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setNoteOpenId(null); setNoteError(null) }}
                                      className="px-3 py-1.5 text-gray-500 hover:text-gray-700 text-xs rounded-lg hover:bg-gray-100 transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Expanded ingredient list */}
                              {ingredients && isExpanded && (
                                <div className="border-t border-gray-50 bg-gray-50/60 divide-y divide-gray-100">
                                  {ingredients.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between px-6 py-1.5 text-xs">
                                      <span className="text-gray-600">{item.name} <span className="text-gray-400">· {item.grams}g</span></span>
                                      <div className="flex items-center gap-2 text-gray-500">
                                        <span>{item.calories} kcal</span>
                                        <span className="text-macro-p">P {item.protein}g</span>
                                        <span className="text-macro-c">C {item.carbs}g</span>
                                        <span className="text-macro-f">F {item.fat}g</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty state */}
                {!noteOnly && logs.length === 0 && !isAdding && (
                  <p className="px-4 pb-3 text-xs text-gray-400">Nothing logged yet</p>
                )}

                {/* Add food panel */}
                {!noteOnly && isAdding && (
                  <div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50/40">
                    <FoodSearch key={searchKey} onSelect={(food, grams, servingDescription) => setPendingEntry({ food, grams, servingDescription })} />
                    {logError && (
                      <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{logError}</p>
                    )}
                    {justAdded && (
                      <p className="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2 font-medium">Added! Search for another food or cancel.</p>
                    )}
                    <button
                      type="button"
                      onClick={handleLog}
                      disabled={!pendingEntry || saving}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                      {saving ? 'Adding...' : `Add to ${meal.label}`}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {scanningMeal && (
        <MealScanModal
          mealKey={scanningMeal}
          date={date}
          onLogged={fetchLogs}
          onClose={() => setScanningMeal(null)}
        />
      )}
    </div>
  )
}
