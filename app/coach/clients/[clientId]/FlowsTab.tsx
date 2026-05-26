'use client'

import { useState, useEffect } from 'react'

type AutoflowTemplate = {
  id: string
  name: string
  type: string
  total_steps: number
}

type ClientFlow = {
  id: string
  name: string
  start_date: string
  status: string
  autoflow_templates: { type: string; total_steps: number } | null
  autoflow_responses: { step_number: number }[]
}

type Question = {
  id: string
  type: 'text' | 'textarea' | 'scale' | 'yesno' | 'choice' | 'note' | 'section'
  label: string
  required: boolean
  description?: string
  options?: string[]
}

type StepTask = {
  id: string
  label: string
  link_type?: string | null
  link_url?: string | null
  link_label?: string | null
}

type StepResource = {
  id: string
  name: string
  type: string
  url: string | null
}

type FlowStep = {
  step_number: number
  title: string
  description: string | null
  questions: Question[]
  day_offset: number
  trigger_type?: string
  trigger_step_number?: number | null
  has_override: boolean
  due_date_override: string | null
  response: { submitted_at: string; answers: Record<string, string> } | null
  tasks: StepTask[]
  resources: StepResource[]
  linked_form: { id: string; title: string } | null
}

type FlowDetail = {
  id: string
  name: string
  start_date: string
  status: string
  template_id: string
  autoflow_templates: { type: string; total_steps: number; core_questions: unknown[] } | null
  // Flow-level core question override: when the coach has customised the
  // template's core questions for this specific client, the server
  // returns them here. effective_core_questions is the resolved list
  // (override if present, otherwise template default).
  core_questions: Question[] | null
  effective_core_questions: Question[]
  core_questions_overridden: boolean
  steps: FlowStep[]
}

type StepEditor = {
  stepNumber: number
  title: string
  description: string
  questions: Question[]
  // Editable copy of the flow-level core questions. Saved via the same
  // PUT endpoint but separately keyed in the upsert so a change here
  // doesn't trample per-step state.
  coreQuestions: Question[]
  coreQuestionsDirty: boolean
}

const Q_TYPES: { value: Question['type']; label: string }[] = [
  { value: 'text', label: 'Short answer' },
  { value: 'textarea', label: 'Long answer' },
  { value: 'scale', label: 'Scale 1–10' },
  { value: 'yesno', label: 'Yes / No' },
  { value: 'choice', label: 'Multiple choice' },
  { value: 'note', label: 'Note (no response)' },
  { value: 'section', label: 'Section heading' },
]

export default function FlowsTab({ clientId }: { clientId: string }) {
  const [flows, setFlows] = useState<ClientFlow[]>([])
  const [templates, setTemplates] = useState<AutoflowTemplate[]>([])
  const [selectedFlow, setSelectedFlow] = useState<FlowDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAssign, setShowAssign] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [assignTemplateId, setAssignTemplateId] = useState('')
  const [assignStartDate, setAssignStartDate] = useState(new Date().toISOString().split('T')[0])
  const [assignCheckinPrompt, setAssignCheckinPrompt] = useState(false)
  const [viewingResponse, setViewingResponse] = useState<{ step: FlowStep; answers: Record<string, string> } | null>(null)
  const [editingStartDate, setEditingStartDate] = useState<string | null>(null)
  const [savingStartDate, setSavingStartDate] = useState(false)
  const [editingStepDate, setEditingStepDate] = useState<{ stepNumber: number; date: string } | null>(null)
  const [savingStepDate, setSavingStepDate] = useState(false)

  // Step content editor
  const [editingStep, setEditingStep] = useState<StepEditor | null>(null)
  const [stepIsDirty, setStepIsDirty] = useState(false)
  const [savingStep, setSavingStep] = useState(false)
  const [stepSaved, setStepSaved] = useState(false)
  const [stepSaveError, setStepSaveError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/coach/clients/${clientId}/autoflows`).then(r => r.json()),
      fetch('/api/coach/autoflows').then(r => r.json()),
    ]).then(([f, t]) => {
      setFlows(Array.isArray(f) ? f : [])
      setTemplates(Array.isArray(t) ? t : [])
    }).finally(() => setLoading(false))
  }, [clientId])

  async function loadFlowDetail(flowId: string) {
    const d = await fetch(`/api/coach/clients/${clientId}/autoflows/${flowId}`).then(r => r.json())
    if (!d.error) setSelectedFlow(d)
  }

  async function assignFlow() {
    if (!assignTemplateId || !assignStartDate) return
    setAssigning(true)
    const res = await fetch(`/api/coach/clients/${clientId}/autoflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: assignTemplateId, start_date: assignStartDate, show_as_checkin_prompt: assignCheckinPrompt }),
    })
    const d = await res.json()
    setAssigning(false)
    if (d.id) {
      setShowAssign(false)
      const updated = await fetch(`/api/coach/clients/${clientId}/autoflows`).then(r => r.json())
      setFlows(Array.isArray(updated) ? updated : [])
    }
  }

  async function saveStartDate(flowId: string, newDate: string) {
    setSavingStartDate(true)
    await fetch(`/api/coach/clients/${clientId}/autoflows/${flowId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_date: newDate }),
    })
    setSavingStartDate(false)
    setEditingStartDate(null)
    const d = await fetch(`/api/coach/clients/${clientId}/autoflows/${flowId}`).then(r => r.json())
    if (!d.error) setSelectedFlow(d)
  }

  async function saveStepDate(flowId: string, stepNumber: number, dueDate: string) {
    setSavingStepDate(true)
    await fetch(`/api/coach/clients/${clientId}/autoflows/${flowId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step_number: stepNumber, due_date: dueDate }),
    })
    setSavingStepDate(false)
    setEditingStepDate(null)
    const d = await fetch(`/api/coach/clients/${clientId}/autoflows/${flowId}`).then(r => r.json())
    if (!d.error) setSelectedFlow(d)
  }

  async function saveStepContent() {
    if (!editingStep || !selectedFlow) return
    setSavingStep(true)
    setStepSaveError(null)
    const res = await fetch(`/api/coach/clients/${clientId}/autoflows/${selectedFlow.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step_number: editingStep.stepNumber,
        title: editingStep.title,
        description: editingStep.description,
        questions: editingStep.questions,
        // Only push core_questions when the coach has actually touched
        // them — otherwise we'd inadvertently lock in the template's
        // defaults as a client-specific override.
        ...(editingStep.coreQuestionsDirty ? { core_questions: editingStep.coreQuestions } : {}),
      }),
    })
    const d = await res.json()
    setSavingStep(false)
    if (!res.ok) { setStepSaveError(d.error ?? 'Save failed'); return }
    setStepIsDirty(false)
    setStepSaved(true)
    // Auto-clear the "Saved" indicator after a couple of seconds so it
    // doesn't sit there forever after the next edit starts.
    setTimeout(() => setStepSaved(false), 2500)
    // Also flip the dirty flag back off for core questions specifically,
    // so subsequent saves don't keep pushing the same override.
    if (editingStep.coreQuestionsDirty) {
      setEditingStep((prev) => prev ? { ...prev, coreQuestionsDirty: false } : null)
    }
    // Refresh flow detail
    const updated = await fetch(`/api/coach/clients/${clientId}/autoflows/${selectedFlow.id}`).then(r => r.json())
    if (!updated.error) setSelectedFlow(updated)
  }

  function openStepEditor(step: FlowStep) {
    setEditingStep({
      stepNumber: step.step_number,
      title: step.title,
      description: step.description ?? '',
      questions: JSON.parse(JSON.stringify(step.questions ?? [])),
      coreQuestions: JSON.parse(JSON.stringify(selectedFlow?.effective_core_questions ?? [])),
      coreQuestionsDirty: false,
    })
    setStepIsDirty(false)
    setStepSaveError(null)
  }

  function tryExitStepEditor() {
    if (stepIsDirty) {
      if (!confirm('You have unsaved changes. Discard and go back?')) return
    }
    setEditingStep(null)
    setStepIsDirty(false)
  }

  function updateStepEditor(patch: Partial<StepEditor>) {
    setEditingStep(prev => prev ? { ...prev, ...patch } : null)
    setStepIsDirty(true)
  }

  function updateQuestion(idx: number, patch: Partial<Question>) {
    if (!editingStep) return
    const qs = [...editingStep.questions]
    qs[idx] = { ...qs[idx], ...patch }
    updateStepEditor({ questions: qs })
  }

  function addQuestion() {
    if (!editingStep) return
    const q: Question = { id: crypto.randomUUID(), type: 'text', label: '', required: false }
    updateStepEditor({ questions: [...editingStep.questions, q] })
  }

  function removeQuestion(idx: number) {
    if (!editingStep) return
    updateStepEditor({ questions: editingStep.questions.filter((_, i) => i !== idx) })
  }

  // Move a step-specific question up/down within the list. Bounds-checked
  // so the swap is a no-op at the ends.
  function moveQuestion(idx: number, dir: 'up' | 'down') {
    if (!editingStep) return
    const target = dir === 'up' ? idx - 1 : idx + 1
    if (target < 0 || target >= editingStep.questions.length) return
    const qs = [...editingStep.questions]
    ;[qs[idx], qs[target]] = [qs[target], qs[idx]]
    updateStepEditor({ questions: qs })
  }

  // Core question editors — mirror per-step but mutate coreQuestions and
  // flip coreQuestionsDirty so saveStep knows to push the override.
  function updateCoreQuestion(idx: number, patch: Partial<Question>) {
    if (!editingStep) return
    const qs = [...editingStep.coreQuestions]
    qs[idx] = { ...qs[idx], ...patch }
    setEditingStep({ ...editingStep, coreQuestions: qs, coreQuestionsDirty: true })
    setStepIsDirty(true)
  }

  function addCoreQuestion() {
    if (!editingStep) return
    const q: Question = { id: crypto.randomUUID(), type: 'text', label: '', required: false }
    setEditingStep({
      ...editingStep,
      coreQuestions: [...editingStep.coreQuestions, q],
      coreQuestionsDirty: true,
    })
    setStepIsDirty(true)
  }

  function removeCoreQuestion(idx: number) {
    if (!editingStep) return
    setEditingStep({
      ...editingStep,
      coreQuestions: editingStep.coreQuestions.filter((_, i) => i !== idx),
      coreQuestionsDirty: true,
    })
    setStepIsDirty(true)
  }

  function resetCoreToTemplate() {
    if (!editingStep) return
    const tplCore = (selectedFlow?.autoflow_templates?.core_questions as Question[] | undefined) ?? []
    setEditingStep({
      ...editingStep,
      coreQuestions: JSON.parse(JSON.stringify(tplCore)),
      // Push `core_questions: null` on save to wipe the override and fall
      // back to the template — handled in saveStep via the dirty flag.
      coreQuestionsDirty: true,
    })
    setStepIsDirty(true)
  }

  // Reorder core questions — swap with the neighbour above/below. Bounds-
  // checked so the move is a no-op at the ends. coreQuestionsDirty is set
  // so the override actually persists on save.
  function moveCoreQuestion(idx: number, dir: 'up' | 'down') {
    if (!editingStep) return
    const target = dir === 'up' ? idx - 1 : idx + 1
    if (target < 0 || target >= editingStep.coreQuestions.length) return
    const qs = [...editingStep.coreQuestions]
    ;[qs[idx], qs[target]] = [qs[target], qs[idx]]
    setEditingStep({ ...editingStep, coreQuestions: qs, coreQuestionsDirty: true })
    setStepIsDirty(true)
  }

  async function removeFlow(flowId: string) {
    if (!confirm('Remove this autoflow from the client? Their responses will be deleted.')) return
    await fetch(`/api/coach/clients/${clientId}/autoflows/${flowId}`, { method: 'DELETE' })
    setFlows(flows.filter(f => f.id !== flowId))
    if (selectedFlow?.id === flowId) setSelectedFlow(null)
  }

  // Snapshot this client's flow (template overlaid with their per-step +
  // core overrides) into a brand new autoflow template owned by the
  // coach. Useful after fine-tuning a flow for one client and wanting to
  // reuse it elsewhere.
  const [savingAsTemplate, setSavingAsTemplate] = useState(false)
  const [saveAsTemplateError, setSaveAsTemplateError] = useState<string | null>(null)
  async function saveFlowAsTemplate(flowId: string) {
    if (savingAsTemplate) return
    setSavingAsTemplate(true)
    setSaveAsTemplateError(null)
    try {
      const res = await fetch(`/api/coach/clients/${clientId}/autoflows/${flowId}/save-as-template`, { method: 'POST' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.id) {
        setSaveAsTemplateError(d.error ?? 'Failed to save as template')
        return
      }
      // Take the coach straight to the new template editor so they can
      // rename / publish to org / further edit.
      window.location.href = `/coach/autoflows/${d.id}`
    } finally {
      setSavingAsTemplate(false)
    }
  }

  // Structural step edits from inside the client file. The server forks
  // the template into a private clone on first use so the original
  // template (and other clients on it) stays untouched.
  const [busyStep, setBusyStep] = useState<{ action: 'dup' | 'del'; step: number } | null>(null)
  async function duplicateStep(flowId: string, stepNumber: number) {
    setBusyStep({ action: 'dup', step: stepNumber })
    try {
      const res = await fetch(`/api/coach/clients/${clientId}/autoflows/${flowId}/duplicate-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_number: stepNumber }),
      })
      if (res.ok) {
        const updated = await fetch(`/api/coach/clients/${clientId}/autoflows/${flowId}`).then(r => r.json())
        if (!updated.error) setSelectedFlow(updated)
      }
    } finally {
      setBusyStep(null)
    }
  }
  async function deleteStep(flowId: string, stepNumber: number) {
    if (!confirm(`Remove this step from the client's autoflow? Their responses for this step will be deleted. The original template and other clients on it are unaffected.`)) return
    setBusyStep({ action: 'del', step: stepNumber })
    try {
      const res = await fetch(`/api/coach/clients/${clientId}/autoflows/${flowId}/delete-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_number: stepNumber }),
      })
      if (res.ok) {
        const updated = await fetch(`/api/coach/clients/${clientId}/autoflows/${flowId}`).then(r => r.json())
        if (!updated.error) setSelectedFlow(updated)
      }
    } finally {
      setBusyStep(null)
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-gray-400">Loading…</div>
  }

  // ── Step content editor ───────────────────────────────────────────────────────
  if (editingStep && selectedFlow) {
    return (
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={tryExitStepEditor}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back to flow
          </button>
          <button
            onClick={saveStepContent}
            disabled={savingStep || !stepIsDirty}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-40 transition-colors ${stepSaved && !stepIsDirty ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-900 hover:bg-gray-700'}`}
          >
            {savingStep ? 'Saving…' : stepSaved && !stepIsDirty ? '✓ Saved' : 'Save changes'}
          </button>
        </div>

        {/* Client-specific note */}
        <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-blue-700">
            <span className="font-semibold">Client-specific edits.</span> Changes here apply only to this client and will not affect the main autoflow template.
          </p>
        </div>

        {stepSaveError && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2">{stepSaveError}</p>
        )}

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
            Step {editingStep.stepNumber}
            {stepIsDirty && <span className="ml-2 text-amber-500 normal-case font-normal">· Unsaved changes</span>}
            {stepSaved && !stepIsDirty && (
              <span className="ml-2 inline-flex items-center gap-1 text-emerald-600 normal-case font-medium">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Saved
              </span>
            )}
          </p>
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Step title</label>
          <input
            value={editingStep.title}
            onChange={e => updateStepEditor({ title: e.target.value })}
            placeholder={`Step ${editingStep.stepNumber}`}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Description (optional)</label>
          <textarea
            value={editingStep.description}
            onChange={e => updateStepEditor({ description: e.target.value })}
            placeholder="Intro text shown to the client…"
            rows={2}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          />
        </div>

        {/* Core questions — flow-level, apply to every step. Edits here
            propagate to the parent client_autoflows row instead of the
            per-step override. */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium text-gray-700">
              Core questions <span className="text-gray-400 font-normal">— apply to every step</span>
            </label>
            {selectedFlow?.core_questions_overridden && !editingStep.coreQuestionsDirty && (
              <button
                onClick={resetCoreToTemplate}
                className="text-[11px] text-gray-400 hover:text-blue-600 underline"
                title="Discard the client-specific override and use the template's core questions"
              >
                Reset to template
              </button>
            )}
          </div>
          <div className="space-y-2">
            {editingStep.coreQuestions.map((q, i) => (
              <div key={q.id} className="border border-blue-100 rounded-xl p-3 space-y-2 bg-blue-50/40">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-1.5">
                    <input
                      value={q.label}
                      onChange={e => updateCoreQuestion(i, { label: e.target.value })}
                      placeholder={q.type === 'note' ? 'Note text…' : q.type === 'section' ? 'Section heading…' : 'Question…'}
                      className="w-full border border-blue-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                    />
                    {q.type !== 'note' && q.type !== 'section' && (
                      <textarea
                        value={q.description ?? ''}
                        onChange={e => updateCoreQuestion(i, { description: e.target.value })}
                        placeholder="Description (optional — shown under the question to give the client context)"
                        rows={2}
                        className="w-full border border-blue-100 rounded-lg px-3 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white resize-y placeholder:text-gray-400"
                      />
                    )}
                    <div className="flex items-center gap-3">
                      <select
                        value={q.type}
                        onChange={e => updateCoreQuestion(i, { type: e.target.value as Question['type'] })}
                        className="text-xs border border-blue-200 rounded-lg px-2 py-1 focus:outline-none bg-white"
                      >
                        {Q_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      {q.type !== 'note' && q.type !== 'section' && (
                        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={q.required}
                            onChange={e => updateCoreQuestion(i, { required: e.target.checked })}
                            className="rounded"
                          />
                          Required
                        </label>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 flex-shrink-0 mt-1">
                    <button
                      onClick={() => moveCoreQuestion(i, 'up')}
                      disabled={i === 0}
                      className="text-gray-300 hover:text-blue-500 transition-colors disabled:opacity-30 disabled:cursor-default"
                      title="Move up"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button
                      onClick={() => moveCoreQuestion(i, 'down')}
                      disabled={i === editingStep.coreQuestions.length - 1}
                      className="text-gray-300 hover:text-blue-500 transition-colors disabled:opacity-30 disabled:cursor-default"
                      title="Move down"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    <button
                      onClick={() => removeCoreQuestion(i)}
                      className="text-gray-300 hover:text-red-500 transition-colors mt-0.5"
                      title="Remove core question"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <button
              onClick={addCoreQuestion}
              className="w-full text-xs text-blue-600 hover:text-blue-800 border border-dashed border-blue-200 rounded-xl py-2 px-3 transition-colors"
            >
              + Add core question
            </button>
          </div>
        </div>

        {/* Questions */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">Step-specific questions</label>
          <div className="space-y-2">
            {editingStep.questions.map((q, i) => (
              <div key={q.id} className="border border-gray-200 rounded-xl p-3 space-y-2 bg-white">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-1.5">
                    <input
                      value={q.label}
                      onChange={e => updateQuestion(i, { label: e.target.value })}
                      placeholder={q.type === 'note' ? 'Note text…' : q.type === 'section' ? 'Section heading…' : 'Question…'}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    {q.type !== 'note' && q.type !== 'section' && (
                      <textarea
                        value={q.description ?? ''}
                        onChange={e => updateQuestion(i, { description: e.target.value })}
                        placeholder="Description (optional — shown under the question to give the client context)"
                        rows={2}
                        className="w-full border border-gray-100 rounded-lg px-3 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y placeholder:text-gray-400"
                      />
                    )}
                    <div className="flex items-center gap-3">
                      <select
                        value={q.type}
                        onChange={e => updateQuestion(i, { type: e.target.value as Question['type'] })}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none bg-white"
                      >
                        {Q_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      {q.type !== 'note' && q.type !== 'section' && (
                        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={q.required}
                            onChange={e => updateQuestion(i, { required: e.target.checked })}
                            className="rounded"
                          />
                          Required
                        </label>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 flex-shrink-0 mt-1">
                    <button
                      onClick={() => moveQuestion(i, 'up')}
                      disabled={i === 0}
                      className="text-gray-300 hover:text-blue-500 transition-colors disabled:opacity-30 disabled:cursor-default"
                      title="Move up"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button
                      onClick={() => moveQuestion(i, 'down')}
                      disabled={i === editingStep.questions.length - 1}
                      className="text-gray-300 hover:text-blue-500 transition-colors disabled:opacity-30 disabled:cursor-default"
                      title="Move down"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    <button
                      onClick={() => removeQuestion(i)}
                      className="text-gray-300 hover:text-red-500 transition-colors mt-0.5"
                      title="Remove question"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <button
              onClick={addQuestion}
              className="w-full text-xs text-gray-500 hover:text-gray-800 border border-dashed border-gray-200 rounded-xl py-2 px-3 transition-colors"
            >
              + Add question
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Response viewer ───────────────────────────────────────────────────────────
  if (viewingResponse) {
    const { step, answers } = viewingResponse
    const allQuestions = [...(selectedFlow?.autoflow_templates?.core_questions as Question[] ?? []), ...step.questions]
    const questionMap: Record<string, Question> = Object.fromEntries(allQuestions.map(q => [q.id, q]))

    // Separate question answers from task answers
    const questionAnswers = Object.entries(answers).filter(([k]) => !k.startsWith('task_'))

    return (
      <div className="p-5 space-y-4">
        <button
          onClick={() => setViewingResponse(null)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to flow
        </button>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{step.title || `Step ${step.step_number}`}</h3>
          {step.response
            ? <p className="text-xs text-gray-400">Submitted {new Date(step.response.submitted_at).toLocaleDateString()}</p>
            : <p className="text-xs text-amber-600">Not yet submitted</p>
          }
        </div>

        {/* Tasks */}
        {step.tasks && step.tasks.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tasks</p>
            {step.tasks.map(task => {
              const taskAnswer = answers[`task_${task.id}`]
              const done = taskAnswer === 'done'
              const skipped = taskAnswer === 'skipped'
              return (
                <div key={task.id} className="flex items-center gap-2.5 py-1">
                  <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${done ? 'bg-green-600' : skipped ? 'bg-gray-300' : 'border-2 border-gray-200'}`}>
                    {done && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <p className={`text-sm flex-1 ${done ? 'line-through text-gray-400' : skipped ? 'text-gray-400' : 'text-gray-700'}`}>
                    {task.label}
                  </p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${done ? 'bg-green-100 text-green-700' : skipped ? 'bg-gray-100 text-gray-500' : 'bg-orange-100 text-orange-600'}`}>
                    {done ? 'Done' : skipped ? 'Skipped' : 'Pending'}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Resources */}
        {step.resources && step.resources.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Resources</p>
            {step.resources.map(r => (
              <div key={r.id} className="flex items-center gap-2 text-sm">
                <span>{r.type === 'video' ? '🎬' : r.type === 'pdf' ? '📄' : r.type === 'link' ? '🔗' : '📝'}</span>
                <span className="flex-1 text-gray-700 truncate">{r.name}</span>
                {r.url && (
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline flex-shrink-0">Open</a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Linked form */}
        {step.linked_form && (
          <div className="flex items-center gap-2">
            <span>📋</span>
            <span className="flex-1 text-sm text-gray-700 truncate">{step.linked_form.title}</span>
            <span className="text-xs text-gray-400">Linked form</span>
          </div>
        )}

        {/* Question answers (if submitted) */}
        {step.response && questionAnswers.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Answers</p>
            {questionAnswers.map(([qId, answer]) => {
              const q = questionMap[qId]
              return (
                <div key={qId} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">{q?.label || qId}</p>
                  <p className="text-sm text-gray-900">{String(answer)}</p>
                </div>
              )
            })}
          </div>
        )}

        {/* If not submitted, show question list (preview) */}
        {!step.response && allQuestions.filter(q => q.type !== 'note' && q.type !== 'section').length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Questions</p>
            {allQuestions.filter(q => q.type !== 'note' && q.type !== 'section').map((q, i) => (
              <div key={q.id} className="bg-gray-50 rounded-xl px-3 py-2">
                <p className="text-xs text-gray-600">{i + 1}. {q.label}</p>
                {q.required && <span className="text-[10px] text-red-400">Required</span>}
              </div>
            ))}
          </div>
        )}

        {!step.response && !step.tasks?.length && !step.resources?.length && !step.linked_form && allQuestions.length === 0 && (
          <p className="text-xs text-gray-400">No content assigned to this step yet.</p>
        )}
      </div>
    )
  }

  // ── Flow detail view ──────────────────────────────────────────────────────────
  if (selectedFlow) {
    const completedCount = selectedFlow.steps.filter(s => s.response).length
    const total = selectedFlow.steps.length
    return (
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setSelectedFlow(null)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            All flows
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => saveFlowAsTemplate(selectedFlow.id)}
              disabled={savingAsTemplate}
              className="text-xs font-semibold text-blue-600 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
              title="Create a new autoflow template from this client's flow (template + their overrides)"
            >
              {savingAsTemplate ? 'Saving…' : 'Save as template'}
            </button>
            <button
              onClick={() => removeFlow(selectedFlow.id)}
              className="text-xs text-red-400 hover:text-red-600 transition-colors"
            >
              Remove flow
            </button>
          </div>
        </div>
        {saveAsTemplateError && (
          <p className="text-xs text-red-500">{saveAsTemplateError}</p>
        )}

        <div>
          <h3 className="text-sm font-semibold text-gray-900">{selectedFlow.name}</h3>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">Start date:</span>
              {editingStartDate !== null ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={editingStartDate}
                    onChange={e => setEditingStartDate(e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
                  />
                  <button
                    onClick={() => saveStartDate(selectedFlow.id, editingStartDate)}
                    disabled={savingStartDate}
                    className="text-xs font-semibold text-gray-700 hover:text-gray-900 disabled:opacity-40"
                  >
                    {savingStartDate ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setEditingStartDate(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingStartDate(selectedFlow.start_date)}
                  className="text-xs text-gray-700 underline underline-offset-2 hover:text-gray-900 transition-colors"
                >
                  {new Date(selectedFlow.start_date + 'T00:00:00').toLocaleDateString()}
                </button>
              )}
            </div>
            <span className="text-xs text-gray-400">{completedCount}/{total} completed</span>
          </div>
          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gray-900 rounded-full transition-all" style={{ width: `${total > 0 ? (completedCount / total) * 100 : 0}%` }} />
          </div>
        </div>

        <div className="space-y-1.5">
          {selectedFlow.steps.map(s => {
            const effectiveDate = s.due_date_override
              ? new Date(s.due_date_override + 'T00:00:00')
              : new Date(new Date(selectedFlow.start_date + 'T00:00:00').getTime() + s.day_offset * 86400000)
            const isPast = effectiveDate <= new Date()
            const isEditingThisStep = editingStepDate?.stepNumber === s.step_number

            return (
              <div
                key={s.step_number}
                className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2.5"
              >
                {/* Status dot */}
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${s.response ? 'bg-gray-900' : isPast ? 'bg-orange-100' : 'bg-gray-100'}`}>
                  {s.response ? (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  ) : isPast ? (
                    <svg className="w-3 h-3 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" /></svg>
                  ) : (
                    <span className="text-[9px] font-bold text-gray-400">{s.step_number}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate">{s.title || `Step ${s.step_number}`}</p>
                  {/* Content summary badges */}
                  {(s.tasks?.length > 0 || s.resources?.length > 0 || s.linked_form || s.questions?.length > 0) && (
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {s.questions?.length > 0 && (
                        <span className="text-[10px] text-gray-400">{s.questions.length} Q</span>
                      )}
                      {s.tasks?.length > 0 && (
                        <span className="text-[10px] text-blue-500">
                          {s.response
                            ? (() => {
                                const done = s.tasks.filter(t => s.response!.answers[`task_${t.id}`] === 'done').length
                                return `${done}/${s.tasks.length} tasks done`
                              })()
                            : `${s.tasks.length} task${s.tasks.length !== 1 ? 's' : ''}`
                          }
                        </span>
                      )}
                      {s.resources?.length > 0 && (
                        <span className="text-[10px] text-teal-500">{s.resources.length} resource{s.resources.length !== 1 ? 's' : ''}</span>
                      )}
                      {s.linked_form && (
                        <span className="text-[10px] text-amber-500">form</span>
                      )}
                    </div>
                  )}

                  {s.response ? (
                    <p className="text-xs text-gray-400">
                      Submitted {new Date(s.response.submitted_at).toLocaleDateString()}
                    </p>
                  ) : isEditingThisStep ? (
                    <div className="flex items-center gap-1.5 mt-1">
                      <input
                        type="date"
                        value={editingStepDate.date}
                        onChange={e => setEditingStepDate({ stepNumber: s.step_number, date: e.target.value })}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-400"
                      />
                      <button
                        onClick={() => saveStepDate(selectedFlow.id, s.step_number, editingStepDate.date)}
                        disabled={savingStepDate}
                        className="text-xs font-semibold text-gray-700 hover:text-gray-900 disabled:opacity-40"
                      >
                        {savingStepDate ? 'Saving…' : 'Save'}
                      </button>
                      <button onClick={() => setEditingStepDate(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">
                      {s.trigger_type === 'on_step_complete'
                        ? `Unlocks after step ${s.trigger_step_number ?? '?'} completed`
                        : `Due ${effectiveDate.toLocaleDateString()}`}
                      {s.due_date_override && <span className="ml-1 text-blue-500">· custom date</span>}
                      {s.has_override && <span className="ml-1 text-blue-500">· customised</span>}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Edit step content */}
                  {!s.response && (
                    <button
                      onClick={() => openStepEditor(s)}
                      className="text-gray-300 hover:text-blue-500 transition-colors"
                      title="Edit step content for this client"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 11l6.536-6.536a2 2 0 012.828 2.828L11.828 13.828A2 2 0 0110 14H8v-2a2 2 0 01.586-1.414z" />
                      </svg>
                    </button>
                  )}
                  {/* Duplicate this step — forks the template into a
                      private clone on first use so other clients aren't
                      affected. */}
                  <button
                    onClick={() => duplicateStep(selectedFlow.id, s.step_number)}
                    disabled={busyStep?.action === 'dup' && busyStep.step === s.step_number}
                    className="text-gray-300 hover:text-blue-500 transition-colors disabled:opacity-40"
                    title="Duplicate this step (just for this client)"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  {/* Delete this step — also forks first, so only this
                      client loses the step. */}
                  {!s.response && (
                    <button
                      onClick={() => deleteStep(selectedFlow.id, s.step_number)}
                      disabled={busyStep?.action === 'del' && busyStep.step === s.step_number}
                      className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40"
                      title="Remove this step (just for this client)"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                  {/* Edit step date */}
                  {!s.response && !isEditingThisStep && s.trigger_type !== 'on_step_complete' && (
                    <button
                      onClick={() => setEditingStepDate({
                        stepNumber: s.step_number,
                        date: s.due_date_override ?? effectiveDate.toISOString().split('T')[0],
                      })}
                      className="text-gray-300 hover:text-gray-600 transition-colors"
                      title="Edit step date"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </button>
                  )}
                  {/* View step content — always available */}
                  <button
                    onClick={() => setViewingResponse({ step: s, answers: s.response?.answers ?? {} })}
                    className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    {s.response ? 'View' : 'Preview'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Assign flow modal ─────────────────────────────────────────────────────────
  if (showAssign) {
    return (
      <div className="p-5 space-y-4">
        <button
          onClick={() => setShowAssign(false)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Cancel
        </button>
        <h3 className="text-sm font-semibold text-gray-900">Assign autoflow</h3>

        {templates.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <p className="text-sm text-gray-500">No autoflow templates yet.</p>
            <a href="/coach/autoflows/new" className="text-sm font-semibold text-gray-700 underline underline-offset-2 mt-1 inline-block">
              Create one →
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Select template</label>
              <div className="space-y-1.5">
                {templates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setAssignTemplateId(t.id)}
                    className={`w-full text-left rounded-xl border p-3 transition-colors ${assignTemplateId === t.id ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-400'}`}
                  >
                    <p className="text-sm font-medium text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {t.type === 'weekly_checkin' ? 'Weekly check-in' : 'Onboarding'} · {t.total_steps} steps
                    </p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Start date</label>
              <input
                type="date"
                value={assignStartDate}
                onChange={e => setAssignStartDate(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Show as check-in due</p>
                <p className="text-xs text-gray-400 mt-0.5">Due steps appear as prompts on the client&apos;s home screen</p>
              </div>
              <button
                type="button"
                onClick={() => setAssignCheckinPrompt(v => !v)}
                role="switch"
                aria-checked={assignCheckinPrompt}
                className={[
                  'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none',
                  assignCheckinPrompt ? 'bg-blue-600' : 'bg-gray-200',
                ].join(' ')}
              >
                <span className={['inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200', assignCheckinPrompt ? 'translate-x-5' : 'translate-x-0'].join(' ')} />
              </button>
            </div>

            <button
              onClick={assignFlow}
              disabled={!assignTemplateId || !assignStartDate || assigning}
              className="w-full bg-gray-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              {assigning ? 'Assigning…' : 'Assign flow'}
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Flow list ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Assigned flows</h3>
        <button
          onClick={() => setShowAssign(true)}
          className="text-xs font-semibold text-gray-700 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-400 transition-colors"
        >
          + Assign flow
        </button>
      </div>

      {flows.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-5 text-center space-y-2">
          <p className="text-sm text-gray-500">No autoflows assigned yet.</p>
          <p className="text-xs text-gray-400">Assign a check-in or onboarding sequence to automate this client&apos;s journey.</p>
          <button onClick={() => setShowAssign(true)} className="mt-1 text-sm font-semibold text-gray-700 underline underline-offset-2">
            Assign one →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {flows.map(f => {
            const total = f.autoflow_templates?.total_steps ?? 0
            const completed = f.autoflow_responses?.length ?? 0
            return (
              <button
                key={f.id}
                onClick={() => loadFlowDetail(f.id)}
                className="w-full text-left bg-white rounded-xl border border-gray-200 p-3.5 hover:border-gray-400 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{f.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Started {new Date(f.start_date).toLocaleDateString()} · {completed}/{total} completed
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <div className="mt-2.5 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gray-900 rounded-full" style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }} />
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
