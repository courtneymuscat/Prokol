'use client'

import { useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

type MealFood = {
  food_id?: string
  food_name: string
  grams: number
  calories: number
  protein: number
  carbs: number
  fat: number
  swapped_from?: string
}

type MealSlot = {
  id: string
  label: string
  foods: MealFood[]
}

type MealPlan = {
  id: string
  name: string
  goal: 'cut' | 'build' | 'maintain'
  total_calories: number
  content: MealSlot[]
  created_at: string
  updated_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const GOAL_BADGE: Record<string, { label: string; className: string }> = {
  cut: { label: 'Cut', className: 'bg-red-50 text-red-600' },
  build: { label: 'Build', className: 'bg-green-50 text-green-600' },
  maintain: { label: 'Maintain', className: 'bg-blue-50 text-blue-600' },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AssignMealPlan({
  clientId,
  coachMealPlans,
  onAssigned,
}: {
  clientId: string
  coachMealPlans: MealPlan[]
  onAssigned?: () => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [assigning, setAssigning] = useState(false)
  const [assigningBlank, setAssigningBlank] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // New blank plan fields
  const [showBlankForm, setShowBlankForm] = useState(false)
  const [blankName, setBlankName] = useState('')
  const [blankGoal, setBlankGoal] = useState<'cut' | 'build' | 'maintain'>('maintain')
  const [blankCalories, setBlankCalories] = useState('')
  const [blankStartDate, setBlankStartDate] = useState(new Date().toISOString().slice(0, 10))

  async function handleAssign() {
    if (!selectedId) return
    const template = coachMealPlans.find((p) => p.id === selectedId)
    if (!template) return

    setAssigning(true)
    setError(null)
    setSuccess(null)

    const res = await fetch(`/api/coach/clients/${clientId}/meal-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meal_plan_id: template.id,
        name: template.name,
        content: template.content,
        start_date: startDate,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to assign meal plan')
      setAssigning(false)
      return
    }
    setSuccess(`"${template.name}" assigned successfully.`)
    setSelectedId(null)
    setAssigning(false)
    onAssigned?.()
  }

  async function handleAssignBlank(e: React.FormEvent) {
    e.preventDefault()
    if (!blankName.trim()) return
    setAssigningBlank(true)
    setError(null)
    setSuccess(null)

    const res = await fetch(`/api/coach/clients/${clientId}/meal-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meal_plan_id: null,
        name: blankName.trim(),
        content: [],
        start_date: blankStartDate,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to create meal plan')
      setAssigningBlank(false)
      return
    }
    setSuccess(`"${blankName.trim()}" created and assigned.`)
    setShowBlankForm(false)
    setBlankName('')
    setBlankGoal('maintain')
    setBlankCalories('')
    setAssigningBlank(false)
    onAssigned?.()
  }

  return (
    <div className="space-y-5">
      {/* Success / error banner */}
      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Template list */}
      <div className="bg-white rounded-2xl border p-5">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Assign from templates
        </h3>

        {coachMealPlans.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-500 mb-2">No meal plan templates yet.</p>
            <a
              href="/coach/meal-plans"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-blue-600 hover:underline"
            >
              Create meal plans →
            </a>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {coachMealPlans.map((plan) => {
              const badge = GOAL_BADGE[plan.goal] ?? GOAL_BADGE.maintain
              const mealCount = Array.isArray(plan.content) ? plan.content.length : 0
              return (
                <button
                  key={plan.id}
                  onClick={() => setSelectedId(plan.id === selectedId ? null : plan.id)}
                  className={`w-full text-left rounded-xl border p-3.5 transition-colors ${
                    selectedId === plan.id
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900 flex-1 min-w-0 truncate">{plan.name}</p>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {plan.total_calories.toLocaleString()} kcal · {mealCount} {mealCount === 1 ? 'meal' : 'meals'}
                  </p>
                </button>
              )
            })}
          </div>
        )}

        {/* Start date + assign button */}
        {selectedId && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Start date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleAssign}
              disabled={assigning}
              className="w-full bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {assigning ? 'Assigning…' : 'Assign Plan'}
            </button>
          </div>
        )}
      </div>

      {/* Create blank plan */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <button
          onClick={() => setShowBlankForm((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span>Create new plan for this client</span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${showBlankForm ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showBlankForm && (
          <form onSubmit={handleAssignBlank} className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Plan name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={blankName}
                onChange={(e) => setBlankName(e.target.value)}
                placeholder="e.g. Custom Cut Plan"
                autoFocus
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Goal
                </label>
                <select
                  value={blankGoal}
                  onChange={(e) => setBlankGoal(e.target.value as typeof blankGoal)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="cut">Cut</option>
                  <option value="build">Build</option>
                  <option value="maintain">Maintain</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Calorie target
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={blankCalories}
                    onChange={(e) => setBlankCalories(e.target.value)}
                    placeholder="2000"
                    min={0}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">kcal</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Start date
              </label>
              <input
                type="date"
                value={blankStartDate}
                onChange={(e) => setBlankStartDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowBlankForm(false)}
                className="flex-1 border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={assigningBlank || !blankName.trim()}
                className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {assigningBlank ? 'Creating…' : 'Create & Assign'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
