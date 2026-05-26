'use client'

import { useState, useEffect } from 'react'

// Render a food's serving label as the coach intended it — keeping unit-based
// servings (piece, cup, tbsp, etc.) visible alongside the gram total so the
// coach sees the same thing the client sees.
function formatServingLabel(food: { grams: number; serving_qty?: number; unit?: string }): string {
  const u = food.unit
  const g = food.grams
  if (!u || u === 'g') return `${g}g`
  if (u === 'ml') return `${g}ml`
  const q = food.serving_qty
  if (q == null) return `${g}g`
  const unitLabel = u === 'piece' ? (q === 1 ? 'piece' : 'pieces') : u
  return `${q} ${unitLabel} (${g}g)`
}

type ClientMealPlan = {
  id: string
  meal_plan_id: string | null
  name: string
  content: { id: string; label: string; foods: { food_name: string; grams: number; calories: number; protein: number; carbs: number; fat: number; serving_qty?: number; unit?: string }[]; target_calories?: number | null; target_protein?: number | null; target_carbs?: number | null; target_fat?: number | null }[]
  start_date: string
  end_date: string | null
  status: string
  show_macros?: boolean
}

type MealPlanTemplate = {
  id: string
  name: string
  goal: string
  total_calories: number
  content: unknown[]
}

export default function MealPlanTab({ clientId }: { clientId: string }) {
  const [assignments, setAssignments] = useState<ClientMealPlan[]>([])
  const [templates, setTemplates] = useState<MealPlanTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showAssign, setShowAssign] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createCalories, setCreateCalories] = useState('')
  const [createStartDate, setCreateStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [createEndDate, setCreateEndDate] = useState('')
  const [assignError, setAssignError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [savingTemplateId, setSavingTemplateId] = useState<string | null>(null)
  const [savedTemplateId, setSavedTemplateId] = useState<string | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const [editingDatesId, setEditingDatesId] = useState<string | null>(null)
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [savingDatesId, setSavingDatesId] = useState<string | null>(null)

  async function loadPlans() {
    const [plans, tmpl] = await Promise.all([
      fetch(`/api/coach/clients/${clientId}/meal-plans`).then((r) => r.json()),
      fetch('/api/coach/meal-plans').then((r) => r.json()),
    ])
    const list: ClientMealPlan[] = Array.isArray(plans) ? plans : []
    list.sort((a, b) => b.start_date.localeCompare(a.start_date))
    setAssignments(list)
    setTemplates(Array.isArray(tmpl) ? tmpl : [])
  }

  useEffect(() => {
    loadPlans().finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  async function handleCreateNew(e: React.FormEvent) {
    e.preventDefault()
    if (!createName.trim()) return
    setCreating(true)
    setCreateError(null)
    const res = await fetch(`/api/coach/clients/${clientId}/meal-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: createName.trim(),
        content: [],
        total_calories: parseInt(createCalories) || 0,
        start_date: createStartDate,
        end_date: createEndDate || null,
      }),
    })
    if (res.ok) {
      setShowCreateModal(false)
      setCreateName('')
      setCreateCalories('')
      setCreateStartDate(new Date().toISOString().slice(0, 10))
      setCreateEndDate('')
      await loadPlans()
    } else {
      const body = await res.json().catch(() => ({}))
      setCreateError(body.error ?? 'Failed to create meal plan')
    }
    setCreating(false)
  }

  async function handleSaveAsTemplate(planId: string) {
    setSavingTemplateId(planId)
    await fetch(`/api/coach/clients/${clientId}/meal-plans/${planId}/save-as-template`, { method: 'POST' })
    setSavingTemplateId(null)
    setSavedTemplateId(planId)
    setTimeout(() => setSavedTemplateId(null), 3000)
  }

  async function handleAssign() {
    if (!selectedTemplateId) return
    setAssigning(true)
    setAssignError(null)
    const template = templates.find((t) => t.id === selectedTemplateId)
    const res = await fetch(`/api/coach/clients/${clientId}/meal-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meal_plan_id: selectedTemplateId,
        name: template?.name ?? 'Meal Plan',
        content: template?.content ?? [],
        start_date: startDate,
        end_date: endDate || null,
      }),
    })
    if (res.ok) {
      const created = await res.json()
      setAssignments((prev) => [...prev, created].sort((a, b) => b.start_date.localeCompare(a.start_date)))
      setShowAssign(false)
      setEndDate('')
    } else {
      const body = await res.json().catch(() => ({}))
      setAssignError(body.error ?? 'Failed to assign meal plan')
    }
    setAssigning(false)
  }

  async function handleDuplicate(plan: ClientMealPlan) {
    setDuplicatingId(plan.id)
    const res = await fetch(`/api/coach/clients/${clientId}/meal-plans/${plan.id}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `Copy of ${plan.name}` }),
    })
    if (res.ok) {
      const created = await res.json()
      setAssignments((prev) => [...prev, created].sort((a, b) => b.start_date.localeCompare(a.start_date)))
    }
    setDuplicatingId(null)
  }

  async function handleRemove(id: string) {
    if (!confirm('Remove this meal plan from client?')) return
    await fetch(`/api/coach/clients/${clientId}/meal-plans/${id}`, { method: 'DELETE' })
    setAssignments((prev) => prev.filter((a) => a.id !== id))
  }

  function openDateEditor(plan: ClientMealPlan) {
    setEditingDatesId(plan.id)
    setEditStartDate(plan.start_date)
    setEditEndDate(plan.end_date ?? '')
  }

  async function handleSaveDates(planId: string) {
    setSavingDatesId(planId)
    const today = new Date().toISOString().split('T')[0]
    const newEndDate = editEndDate || null
    // Auto-expire if end date is in the past
    const autoStatus = newEndDate && newEndDate < today ? 'inactive' : undefined
    const res = await fetch(`/api/coach/clients/${clientId}/meal-plans/${planId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start_date: editStartDate,
        end_date: newEndDate,
        ...(autoStatus ? { status: autoStatus } : {}),
      }),
    })
    if (res.ok) {
      setAssignments((prev) =>
        prev.map((a) => a.id === planId
          ? { ...a, start_date: editStartDate, end_date: newEndDate, ...(autoStatus ? { status: autoStatus } : {}) }
          : a
        ).sort((a, b) => b.start_date.localeCompare(a.start_date))
      )
      setEditingDatesId(null)
    }
    setSavingDatesId(null)
  }

  async function handleToggleStatus(plan: ClientMealPlan) {
    const newStatus = plan.status === 'active' ? 'inactive' : 'active'
    const res = await fetch(`/api/coach/clients/${clientId}/meal-plans/${plan.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      setAssignments((prev) => prev.map((a) => a.id === plan.id ? { ...a, status: newStatus } : a))
    }
  }

  if (loading) return <p className="text-sm text-gray-400 text-center py-10">Loading meal plans…</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          {assignments.length === 0 ? 'No meal plans assigned' : `${assignments.length} plan${assignments.length !== 1 ? 's' : ''}`}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-xs font-semibold text-white bg-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Create New
          </button>
          <button
            onClick={() => setShowAssign(true)}
            className="text-xs font-semibold text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Assign Template
          </button>
        </div>
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
        <svg className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <p className="text-xs text-blue-700">Clients can see <strong>all active meal plans</strong> and switch between them using tabs — useful for e.g. a training day and a rest day plan. Plans without an end date stay active indefinitely alongside any others.</p>
      </div>

      {assignments.length === 0 && (
        <div className="text-center py-14 bg-white rounded-2xl border">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 mb-1">No meal plan assigned</p>
          <p className="text-xs text-gray-400 mb-4">Assign a nutrition plan template to this client.</p>
          <button onClick={() => setShowAssign(true)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
            + Assign Plan
          </button>
        </div>
      )}

      {assignments.map((plan) => {
        const totalCals = plan.content.reduce((a, slot) => {
          if (slot.foods.length > 0) return a + slot.foods.reduce((b, f) => b + f.calories, 0)
          return a + (slot.target_calories ?? 0)
        }, 0)
        const isEditingDates = editingDatesId === plan.id
        return (
          <div key={plan.id} className={`bg-white rounded-2xl border overflow-hidden ${plan.status !== 'active' ? 'opacity-75' : ''}`}>
            <div className="flex items-center justify-between p-4">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-gray-900">{plan.name}</p>
                  <button
                    onClick={() => handleToggleStatus(plan)}
                    title={plan.status === 'active' ? 'Mark as inactive' : 'Mark as active'}
                    className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                      plan.status === 'active'
                        ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                        : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${plan.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                    {plan.status === 'active' ? 'Active' : 'Inactive'}
                  </button>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-xs text-gray-400">
                    {new Date(plan.start_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {plan.end_date ? ` – ${new Date(plan.end_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                    {' · '}{Math.round(totalCals)} kcal/day
                  </p>
                  {plan.show_macros === false && (
                    <span className="text-[10px] font-medium text-gray-400 bg-gray-100 border border-gray-200 rounded-full px-1.5 py-0.5 leading-none">macros hidden</span>
                  )}
                  <button
                    onClick={() => isEditingDates ? setEditingDatesId(null) : openDateEditor(plan)}
                    className="text-gray-300 hover:text-blue-500 transition-colors"
                    title="Edit dates"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setExpanded(expanded === plan.id ? null : plan.id)}
                  className="text-xs font-semibold text-blue-600 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
                >
                  {expanded === plan.id ? 'Hide' : 'View'}
                </button>
                <button onClick={() => handleRemove(plan.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Inline date editor */}
            {isEditingDates && (
              <div className="px-4 pb-4 pt-0 border-t border-gray-100">
                <div className="flex items-end gap-3 pt-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Start date</label>
                    <input
                      type="date"
                      value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)}
                      className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">End date <span className="font-normal">(optional)</span></label>
                    <input
                      type="date"
                      value={editEndDate}
                      onChange={(e) => setEditEndDate(e.target.value)}
                      className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {editEndDate && (
                    <button
                      onClick={() => setEditEndDate('')}
                      className="text-xs text-gray-400 hover:text-red-400 transition-colors pb-2"
                    >
                      Clear end
                    </button>
                  )}
                  <button
                    onClick={() => handleSaveDates(plan.id)}
                    disabled={savingDatesId === plan.id || !editStartDate}
                    className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {savingDatesId === plan.id ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditingDatesId(null)}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {expanded === plan.id && (
              <div className="border-t border-gray-100 divide-y divide-gray-50">
                {plan.content.map((slot) => (
                  <div key={slot.id} className="px-4 py-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{slot.label}</p>
                    <div className="space-y-1.5">
                      {slot.foods.map((f, fi) => (
                        <div key={fi} className="flex items-center justify-between text-sm">
                          <span className="text-gray-800">{f.food_name}</span>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span>{formatServingLabel(f)}</span>
                            <span className="font-medium text-gray-600">{f.calories} kcal</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* Action buttons */}
            <div className="flex items-center gap-2 px-4 pb-4 pt-2 border-t border-gray-50">
              <a
                href={`/coach/clients/${clientId}/meal-plans/${plan.id}`}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
              >
                Edit Plan →
              </a>
              <span className="text-gray-200">|</span>
              <button
                onClick={() => handleDuplicate(plan)}
                disabled={duplicatingId === plan.id}
                className="text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
              >
                {duplicatingId === plan.id ? 'Duplicating…' : 'Duplicate'}
              </button>
              <span className="text-gray-200">|</span>
              <button
                onClick={() => handleSaveAsTemplate(plan.id)}
                disabled={savingTemplateId === plan.id}
                className="text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
              >
                {savedTemplateId === plan.id ? 'Saved ✓' : savingTemplateId === plan.id ? 'Saving…' : 'Save as Template'}
              </button>
            </div>
          </div>
        )
      })}

      {/* Assign modal */}
      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">Assign Meal Plan</h2>
              <button onClick={() => { setShowAssign(false); setAssignError(null) }} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {assignError && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{assignError}</div>
            )}

            {templates.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 mb-3">No meal plan templates yet.</p>
                <a href="/coach/meal-plans" className="text-sm font-semibold text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                  Create a plan first →
                </a>
              </div>
            ) : (
              <>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplateId(t.id)}
                      className={`w-full text-left rounded-xl border p-3.5 transition-colors ${
                        selectedTemplateId === t.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5 capitalize">{t.goal} · {t.total_calories.toLocaleString()} kcal</p>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Start date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">End date <span className="font-normal text-gray-400">(optional)</span></label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setShowAssign(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">
                    Cancel
                  </button>
                  <button
                    onClick={handleAssign}
                    disabled={!selectedTemplateId || assigning}
                    className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                  >
                    {assigning ? 'Assigning…' : 'Assign'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Create New modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-gray-900">Create New Meal Plan</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateNew} className="space-y-4">
              {createError && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{createError}</div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Plan name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Cut Phase Week 1"
                  required
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Calorie target
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={createCalories}
                    onChange={(e) => setCreateCalories(e.target.value)}
                    placeholder="2000"
                    min={0}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">kcal</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Start date</label>
                  <input
                    type="date"
                    value={createStartDate}
                    onChange={(e) => setCreateStartDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">End date <span className="font-normal text-gray-400">(optional)</span></label>
                  <input
                    type="date"
                    value={createEndDate}
                    onChange={(e) => setCreateEndDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !createName.trim()}
                  className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
