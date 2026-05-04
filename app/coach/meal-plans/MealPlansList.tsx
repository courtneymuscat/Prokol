'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

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
  goal: string
  total_calories: number
  content: MealSlot[]
  created_at: string
  updated_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function fmtCalories(n: number) {
  return n.toLocaleString('en-US')
}

const DIET_BADGE: Record<string, { label: string; className: string }> = {
  omnivore:    { label: 'Omnivore',    className: 'bg-orange-50 text-orange-600' },
  vegetarian:  { label: 'Vegetarian',  className: 'bg-green-50 text-green-600' },
  vegan:       { label: 'Vegan',       className: 'bg-emerald-50 text-emerald-700' },
  pescatarian: { label: 'Pescatarian', className: 'bg-cyan-50 text-cyan-600' },
  other:       { label: 'Other',       className: 'bg-gray-100 text-gray-500' },
}

// ── Assign modal ──────────────────────────────────────────────────────────────

type Client = { id: string; email: string; full_name: string | null }

function AssignMealPlanModal({
  plan,
  onClose,
}: {
  plan: MealPlan
  onClose: () => void
}) {
  const [clients, setClients] = useState<Client[]>([])
  const [loadingClients, setLoadingClients] = useState(true)
  const [clientId, setClientId] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [assigning, setAssigning] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/coach/clients')
      .then(r => r.json())
      .then(d => {
        setClients(Array.isArray(d) ? d : [])
        if (Array.isArray(d) && d.length > 0) setClientId(d[0].id)
      })
      .finally(() => setLoadingClients(false))
  }, [])

  async function assign() {
    if (!clientId) return
    setAssigning(true)
    setError(null)
    const res = await fetch(`/api/coach/clients/${clientId}/meal-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meal_plan_id: plan.id,
        name: plan.name,
        content: plan.content,
        total_calories: plan.total_calories,
        start_date: startDate,
      }),
    })
    if (res.ok) {
      setSuccess(true)
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Failed to assign')
    }
    setAssigning(false)
  }

  const clientLabel = (c: Client) => c.full_name ? `${c.full_name} (${c.email})` : c.email

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-gray-900">Assign to Client</h2>
            <p className="text-xs text-gray-400 mt-0.5">{plan.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {success ? (
          <div className="text-center py-4 space-y-3">
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <p className="text-sm font-semibold text-gray-900">Meal plan assigned!</p>
            <p className="text-xs text-gray-400">The client will see it in their app.</p>
            <button onClick={onClose} className="w-full bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">Done</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Client</label>
              {loadingClients ? (
                <p className="text-sm text-gray-400">Loading clients…</p>
              ) : clients.length === 0 ? (
                <p className="text-sm text-gray-400">No active clients found.</p>
              ) : (
                <select value={clientId} onChange={e => setClientId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  {clients.map(c => <option key={c.id} value={c.id}>{clientLabel(c)}</option>)}
                </select>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Start date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={assign} disabled={assigning || !clientId || loadingClients}
                className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {assigning ? 'Assigning…' : 'Assign'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MealPlansList({ plans: initialPlans }: { plans: MealPlan[] }) {
  const router = useRouter()
  const [plans, setPlans] = useState<MealPlan[]>(initialPlans)
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('omnivore')
  const [calories, setCalories] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const [assigningPlan, setAssigningPlan] = useState<MealPlan | null>(null)

  function openModal() {
    setName('')
    setGoal('omnivore')
    setCalories('')
    setCreateError(null)
    setShowModal(true)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    setCreateError(null)
    const res = await fetch('/api/coach/meal-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        goal,
        total_calories: parseInt(calories) || 0,
        content: [],
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setCreateError(data.error ?? 'Failed to create meal plan')
      setCreating(false)
      return
    }
    setShowModal(false)
    router.push(`/coach/meal-plans/${data.id}`)
  }

  async function handleDuplicate(id: string) {
    setDuplicatingId(id)
    const res = await fetch(`/api/coach/meal-plans/${id}/duplicate`, { method: 'POST' })
    if (res.ok) {
      router.refresh()
      const copy = await res.json()
      setPlans((prev) => [copy, ...prev])
    }
    setDuplicatingId(null)
  }

  async function handleDelete(id: string, planName: string) {
    if (!confirm(`Delete "${planName}"? This cannot be undone.`)) return
    setDeletingId(id)
    const res = await fetch(`/api/coach/meal-plans/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setPlans((prev) => prev.filter((p) => p.id !== id))
    }
    setDeletingId(null)
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Meal Plans</h1>
        <button
          onClick={openModal}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          + New Plan
        </button>
      </div>

      <main className="flex-1 p-6 w-full">
        {/* Empty state */}
        {plans.length === 0 && (
          <div className="text-center py-20">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-1">No meal plans yet</p>
            <p className="text-xs text-gray-400 mb-5">Create your first plan and assign it to clients.</p>
            <button
              onClick={openModal}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              + New Plan
            </button>
          </div>
        )}

        {/* Grid */}
        {plans.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {plans.map((plan) => {
              const badge = DIET_BADGE[plan.goal] ?? DIET_BADGE.other
              const mealCount = Array.isArray(plan.content) ? plan.content.length : 0
              return (
                <div
                  key={plan.id}
                  className="bg-white rounded-2xl border p-5 flex flex-col hover:shadow-sm transition-shadow"
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 leading-snug truncate">{plan.name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>
                          {badge.label}
                        </span>
                        <span className="text-xs text-gray-500">
                          {fmtCalories(plan.total_calories)} kcal
                        </span>
                        <span className="text-xs text-gray-400">
                          {mealCount} {mealCount === 1 ? 'meal' : 'meals'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-gray-400 mb-4">
                    Created {fmtDate(plan.created_at)}
                  </p>

                  {/* Actions */}
                  <div className="mt-auto flex flex-col gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => setAssigningPlan(plan)}
                      className="w-full text-center text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg py-1.5 transition-colors"
                    >
                      Assign to Client
                    </button>
                    <div className="flex items-center gap-2">
                      <a
                        href={`/coach/meal-plans/${plan.id}`}
                        className="flex-1 text-center text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg py-1.5 hover:bg-blue-50 transition-colors"
                      >
                        Edit
                      </a>
                      <button
                        onClick={() => handleDuplicate(plan.id)}
                        disabled={duplicatingId === plan.id}
                        className="flex-1 text-center text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        {duplicatingId === plan.id ? 'Copying…' : 'Duplicate'}
                      </button>
                      <button
                        onClick={() => handleDelete(plan.id, plan.name)}
                        disabled={deletingId === plan.id}
                        className="text-xs font-semibold text-red-400 border border-red-100 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        {deletingId === plan.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Create modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-gray-900">New Meal Plan</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Plan name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. 2,000 kcal Plan"
                  autoFocus
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Diet type
                </label>
                <select
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="omnivore">Omnivore</option>
                  <option value="vegetarian">Vegetarian</option>
                  <option value="vegan">Vegan</option>
                  <option value="pescatarian">Pescatarian</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Calorie target
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={calories}
                    onChange={(e) => setCalories(e.target.value)}
                    placeholder="2000"
                    min={0}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">kcal</span>
                </div>
              </div>

              {createError && (
                <p className="text-xs text-red-500">{createError}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !name.trim()}
                  className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {creating ? 'Creating…' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign modal */}
      {assigningPlan && (
        <AssignMealPlanModal plan={assigningPlan} onClose={() => setAssigningPlan(null)} />
      )}
    </div>
  )
}
