'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

// ── Food Logs tab ─────────────────────────────────────────────────────────────

type FoodLogEntry = {
  id: string
  log_date: string
  meal_type: string
  food_name: string | null
  calories: number
  protein: number
  carbs: number
  fat: number
  scan_image_url: string | null
  meal_notes: string | null
  meal_photo_url: string | null
  created_at: string | null
}

type MealNoteEntry = {
  log_date: string
  meal_type: string
  note: string | null
  photo_url: string | null
}

function localDateStr(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function FoodLogsTab({ clientId }: { clientId: string }) {
  const today = localDateStr(new Date())
  const weekAgo = localDateStr(new Date(Date.now() - 6 * 86400000))

  const [startDate, setStartDate] = useState(weekAgo)
  const [endDate, setEndDate] = useState(today)
  const [foodLogs, setFoodLogs] = useState<FoodLogEntry[]>([])
  const [mealNotes, setMealNotes] = useState<MealNoteEntry[]>([])
  const [clientTimezone, setClientTimezone] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true); setError(null)
    fetch(`/api/coach/clients/${clientId}/food-logs?start_date=${startDate}&end_date=${endDate}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error)
        else {
          setFoodLogs(d.foodLogs ?? [])
          setMealNotes(d.mealNotes ?? [])
          setClientTimezone(d.clientTimezone ?? null)
        }
      })
      .catch(() => setError('Failed to load food logs'))
      .finally(() => setLoading(false))
  }, [clientId, startDate, endDate])

  // Group by date
  const byDate = foodLogs.reduce<Record<string, FoodLogEntry[]>>((acc, f) => {
    acc[f.log_date] = acc[f.log_date] ?? []; acc[f.log_date].push(f); return acc
  }, {})

  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))

  return (
    <div className="space-y-4">
      {/* Date range picker */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500">From</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500">To</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {/* Quick range buttons */}
        <div className="flex items-center gap-1.5 ml-auto">
          {([['7d', 7], ['14d', 14], ['30d', 30]] as [string, number][]).map(([label, days]) => (
            <button key={label} onClick={() => {
              setEndDate(today)
              setStartDate(localDateStr(new Date(Date.now() - (days - 1) * 86400000)))
            }} className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 font-medium">
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-10">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-500 text-center py-10">{error}</p>
      ) : dates.length === 0 ? (
        <div className="bg-white rounded-2xl border p-10 text-center">
          <p className="text-sm text-gray-400">No food logs in this date range.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dates.map((date) => {
            const logs = byDate[date]
            const totals = logs.reduce((a, l) => ({
              cal: a.cal + l.calories, p: a.p + l.protein, c: a.c + l.carbs, f: a.f + l.fat,
            }), { cal: 0, p: 0, c: 0, f: 0 })
            const byMeal = logs.reduce<Record<string, FoodLogEntry[]>>((acc, l) => {
              acc[l.meal_type] = acc[l.meal_type] ?? []; acc[l.meal_type].push(l); return acc
            }, {})
            const dayNotes = mealNotes.filter((n) => n.log_date === date)
            const allMealTypes = Array.from(new Set([...Object.keys(byMeal), ...dayNotes.map((n) => n.meal_type)]))

            return (
              <div key={date} className="bg-white rounded-2xl border overflow-hidden">
                {/* Day header */}
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-700">
                    {new Date(date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  <p className="text-xs text-gray-500">
                    {Math.round(totals.cal)} kcal · {Math.round(totals.p)}g P · {Math.round(totals.c)}g C · {Math.round(totals.f)}g F
                  </p>
                </div>

                {allMealTypes.map((mealType) => {
                  const mealLogs = byMeal[mealType] ?? []
                  const mealNote = dayNotes.find((n) => n.meal_type === mealType)
                  return (
                    <div key={mealType}>
                      {/* Meal label row */}
                      <div className="px-5 pt-3 pb-1">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide capitalize">{mealType}</p>
                      </div>

                      {/* Meal-level note / photo */}
                      {(mealNote?.note || mealNote?.photo_url) && (
                        <div className="px-5 py-2 mx-5 mb-1 rounded-xl bg-blue-50 flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            {mealNote.note && <p className="text-xs text-blue-700 italic">"{mealNote.note}"</p>}
                          </div>
                          {mealNote.photo_url && (
                            <a href={mealNote.photo_url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                              <Image src={mealNote.photo_url} alt="Meal photo" width={96} height={64} sizes="96px" className="h-16 w-24 object-cover rounded-lg border border-blue-100 hover:opacity-80 transition-opacity" />
                            </a>
                          )}
                        </div>
                      )}

                      {/* Food items */}
                      {mealLogs.map((l) => {
                        const loggedAt = l.created_at
                          ? new Intl.DateTimeFormat('en-AU', {
                              hour: 'numeric', minute: '2-digit', hour12: true,
                              timeZone: clientTimezone ?? undefined,
                            }).format(new Date(l.created_at))
                          : null
                        return (
                        <div key={l.id} className="px-5 py-2.5 border-t border-gray-50">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2">
                                <p className="text-sm text-gray-800">{l.food_name ?? 'Food entry'}</p>
                                {loggedAt && (
                                  <span className="text-[10px] text-gray-400">{loggedAt}{clientTimezone ? ` (${clientTimezone.split('/').pop()?.replace('_', ' ')})` : ''}</span>
                                )}
                              </div>
                              {l.meal_notes && (
                                <p className="text-xs text-blue-500 italic mt-0.5">"{l.meal_notes}"</p>
                              )}
                              {l.scan_image_url && (
                                <div className="mt-2">
                                  <a href={l.scan_image_url} target="_blank" rel="noopener noreferrer">
                                    <Image src={l.scan_image_url} alt="AI meal scan" width={112} height={80} sizes="112px" className="h-20 w-28 object-cover rounded-lg border border-gray-100 hover:opacity-80 transition-opacity" />
                                  </a>
                                  <p className="text-[10px] text-gray-400 mt-0.5">AI scanned</p>
                                </div>
                              )}
                            </div>
                            <div className="flex items-start gap-2 flex-shrink-0">
                              {l.meal_photo_url && (
                                <a href={l.meal_photo_url} target="_blank" rel="noopener noreferrer">
                                  <Image src={l.meal_photo_url} alt="Meal photo" width={64} height={48} sizes="64px" className="h-12 w-16 object-cover rounded-lg border border-gray-100 hover:opacity-80 transition-opacity" />
                                </a>
                              )}
                              <p className="text-xs text-gray-500 mt-0.5">{Math.round(l.calories)} kcal</p>
                            </div>
                          </div>
                        </div>
                      )})}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


// MealPlanTab extracted to ./MealPlanTab.tsx (lazy-loaded)
// HabitsTab extracted to ./HabitsTab.tsx (lazy-loaded)

