'use client'

import { useState, useEffect } from 'react'

type Goals = {
  main_goal: string | null
  mini_goals: string[]
}

export default function GoalsPanel() {
  const [goals, setGoals] = useState<Goals | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/client/goals')
      .then((r) => r.json())
      .then((d) => setGoals(d))
  }, [])

  function startEdit() {
    setDraft(goals?.main_goal ?? '')
    setEditing(true)
  }

  async function save() {
    setSaving(true)
    const next = draft.trim() || null
    try {
      const res = await fetch('/api/client/goals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ main_goal: next }),
      })
      if (res.ok) {
        setGoals((g) => (g ? { ...g, main_goal: next } : g))
        setEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  if (!goals) return null

  return (
    <div className="bg-white rounded-2xl border px-5 py-4 space-y-3">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">My Goals</p>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-0.5">Main goal</p>
        {editing ? (
          <div className="space-y-2">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. Build strength and feel confident in my training"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <div className="flex gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--nc-primary)' }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setEditing(false)}
                disabled={saving}
                className="text-xs font-medium text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : goals.main_goal ? (
          <button onClick={startEdit} className="group flex items-start gap-1.5 text-left">
            <span className="text-sm font-semibold text-gray-900">{goals.main_goal}</span>
            <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 mt-0.5 flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        ) : (
          <button onClick={startEdit} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            + Add your main goal
          </button>
        )}
      </div>

      {goals.mini_goals.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">This week</p>
          <ul className="space-y-1.5">
            {goals.mini_goals.map((g, i) => (
              <li key={i} className="flex items-start gap-2 overflow-hidden">
                <span className="mt-0.5 w-4 h-4 rounded-full border-2 border-blue-300 flex-shrink-0" />
                <span className="text-sm text-gray-800 break-words overflow-hidden">{g}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
