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

type FlowDetail = {
  id: string
  name: string
  start_date: string
  status: string
  template_id: string
  autoflow_templates: { type: string; total_steps: number; core_questions: unknown[] } | null
  steps: {
    step_number: number
    title: string
    day_offset: number
    has_override: boolean
    response: { submitted_at: string; answers: Record<string, string> } | null
  }[]
}

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
  const [viewingResponse, setViewingResponse] = useState<{ step: FlowDetail['steps'][0]; answers: Record<string, string> } | null>(null)
  const [editingStartDate, setEditingStartDate] = useState<string | null>(null)
  const [savingStartDate, setSavingStartDate] = useState(false)

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
      // Refresh list
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
    // Refresh flow detail
    const d = await fetch(`/api/coach/clients/${clientId}/autoflows/${flowId}`).then(r => r.json())
    if (!d.error) setSelectedFlow(d)
  }

  async function removeFlow(flowId: string) {
    if (!confirm('Remove this autoflow from the client? Their responses will be deleted.')) return
    await fetch(`/api/coach/clients/${clientId}/autoflows/${flowId}`, { method: 'DELETE' })
    setFlows(flows.filter(f => f.id !== flowId))
    if (selectedFlow?.id === flowId) setSelectedFlow(null)
  }

  if (loading) {
    return <div className="p-6 text-sm text-gray-400">Loading…</div>
  }

  // Response viewer
  if (viewingResponse) {
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
          <h3 className="text-sm font-semibold text-gray-900">{viewingResponse.step.title || `Step ${viewingResponse.step.step_number}`}</h3>
          <p className="text-xs text-gray-400">Submitted {new Date(viewingResponse.step.response!.submitted_at).toLocaleDateString()}</p>
        </div>
        <div className="space-y-3">
          {Object.entries(viewingResponse.answers).map(([qId, answer]) => (
            <div key={qId} className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1 font-mono">{qId}</p>
              <p className="text-sm text-gray-900">{String(answer)}</p>
            </div>
          ))}
          {Object.keys(viewingResponse.answers).length === 0 && (
            <p className="text-xs text-gray-400">No answers recorded.</p>
          )}
        </div>
      </div>
    )
  }

  // Flow detail view
  if (selectedFlow) {
    const completedCount = selectedFlow.steps.filter(s => s.response).length
    const total = selectedFlow.steps.length
    return (
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedFlow(null)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            All flows
          </button>
          <button
            onClick={() => removeFlow(selectedFlow.id)}
            className="text-xs text-red-400 hover:text-red-600 transition-colors"
          >
            Remove flow
          </button>
        </div>

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
          {/* Progress bar */}
          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gray-900 rounded-full transition-all" style={{ width: `${total > 0 ? (completedCount / total) * 100 : 0}%` }} />
          </div>
        </div>

        <div className="space-y-1.5">
          {selectedFlow.steps.map(s => {
            const dueDate = new Date(new Date(selectedFlow.start_date).getTime() + s.day_offset * 86400000)
            const isPast = dueDate <= new Date()
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
                  <p className="text-xs text-gray-400">
                    {s.response
                      ? `Submitted ${new Date(s.response.submitted_at).toLocaleDateString()}`
                      : `Due ${dueDate.toLocaleDateString()}`}
                    {s.has_override && <span className="ml-2 text-blue-500">custom questions</span>}
                  </p>
                </div>
                {s.response && (
                  <button
                    onClick={() => setViewingResponse({ step: s, answers: s.response!.answers })}
                    className="text-xs text-gray-500 hover:text-gray-900 transition-colors flex-shrink-0"
                  >
                    View
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Assign flow modal
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
                <span
                  className={[
                    'inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200',
                    assignCheckinPrompt ? 'translate-x-5' : 'translate-x-0',
                  ].join(' ')}
                />
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

  // Flow list
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
          <button
            onClick={() => setShowAssign(true)}
            className="mt-1 text-sm font-semibold text-gray-700 underline underline-offset-2"
          >
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
                {/* Progress bar */}
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
