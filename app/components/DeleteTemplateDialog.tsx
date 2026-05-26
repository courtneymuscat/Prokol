'use client'

import { useEffect, useState } from 'react'

export type TemplateTable = 'programs' | 'meal_plans' | 'autoflow_templates' | 'forms'

type UsageClient = {
  id: string
  name: string | null
  email: string | null
  status: 'active' | 'completed' | 'paused' | 'inactive' | 'archived' | 'scheduled'
  started_at: string | null
}

type Usage = {
  active: number
  scheduled: number
  completed: number
  total: number
  clients: UsageClient[]
  is_org_template: boolean
}

const LABEL: Record<TemplateTable, { singular: string; cascade: string }> = {
  programs: {
    singular: 'program',
    cascade: 'every client_programs assignment, all their workout results, swap history and the day-level overrides — gone',
  },
  meal_plans: {
    singular: 'meal plan',
    cascade: 'every client_meal_plans assignment and any client swaps / per-client tweaks — gone',
  },
  autoflow_templates: {
    singular: 'autoflow',
    cascade: 'every client_autoflows instance, all their step responses, the client-specific overrides and the calendar events the flow scheduled — gone',
  },
  forms: {
    singular: 'form',
    cascade: 'every form submission, all answers, plus any check-in schedule pointing at this form goes blank',
  },
}

type Props = {
  table: TemplateTable
  templateId: string
  templateName: string
  onClose: () => void
  // Fires once the row has been archived or permanently deleted so the
  // caller can drop the row from local state.
  onRemoved: (mode: 'archive' | 'delete') => void
  // Optional override for the hard-delete endpoint. Each existing template
  // type already has its own DELETE route — we pass the path in rather
  // than duplicating that mapping here.
  hardDeleteUrl: string
}

export default function DeleteTemplateDialog({ table, templateId, templateName, onClose, onRemoved, hardDeleteUrl }: Props) {
  const [usage, setUsage] = useState<Usage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'archive' | 'delete' | null>(null)
  const [confirmingHard, setConfirmingHard] = useState(false)

  useEffect(() => {
    fetch(`/api/coach/templates/usage?table=${table}&id=${templateId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && !d.error) setUsage(d as Usage) })
      .catch(() => {/* tolerate — the dialog still works */})
  }, [table, templateId])

  async function archive() {
    setBusy('archive'); setError(null)
    try {
      const res = await fetch('/api/coach/templates/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, id: templateId }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? 'Failed to archive')
        return
      }
      onRemoved('archive')
    } finally {
      setBusy(null)
    }
  }

  async function hardDelete() {
    setBusy('delete'); setError(null)
    try {
      const res = await fetch(hardDeleteUrl, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? 'Failed to delete')
        return
      }
      onRemoved('delete')
    } finally {
      setBusy(null)
    }
  }

  const meta = LABEL[table]
  const totalInUse = usage ? usage.active + usage.scheduled + usage.completed : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4 max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-gray-900">Archive or delete {meta.singular}?</h3>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{templateName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0 text-sm">✕</button>
        </div>

        {/* Usage summary */}
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs space-y-2">
          {!usage ? (
            <p className="text-gray-400">Loading usage…</p>
          ) : usage.total === 0 ? (
            <p className="text-gray-500">No clients currently use this {meta.singular}.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-3 text-[11px]">
                {usage.active > 0 && (
                  <span className="font-semibold text-emerald-700">{usage.active} active</span>
                )}
                {usage.scheduled > 0 && (
                  <span className="font-semibold text-blue-700">{usage.scheduled} scheduled</span>
                )}
                {usage.completed > 0 && (
                  <span className="font-semibold text-gray-600">{usage.completed} completed</span>
                )}
              </div>
              {usage.clients.length > 0 && (
                <ul className="space-y-0.5 max-h-24 overflow-y-auto">
                  {usage.clients.slice(0, 8).map((c) => (
                    <li key={c.id} className="flex justify-between gap-2 text-[11px]">
                      <span className="text-gray-700 truncate">{c.name ?? c.email ?? 'Client'}</span>
                      <span className="text-gray-400 capitalize flex-shrink-0">{c.status}</span>
                    </li>
                  ))}
                  {usage.total > 8 && (
                    <li className="text-[10px] text-gray-400 pt-0.5">+ {usage.total - 8} more</li>
                  )}
                </ul>
              )}
              {usage.is_org_template && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5 leading-snug">
                  Heads up — this {meta.singular} is published to your organisation. Archiving or deleting affects every coach using it.
                </p>
              )}
            </>
          )}
        </div>

        {/* Archive option */}
        <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Recommended</span>
          </div>
          <p className="text-sm font-semibold text-gray-900">Archive</p>
          <p className="text-xs text-gray-600 leading-relaxed">
            Hides this {meta.singular} from your library. Clients already using it keep everything — their assignments, responses, history all stay exactly as they are. You can restore it any time.
          </p>
          <button
            onClick={archive}
            disabled={!!busy}
            className="w-full bg-emerald-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy === 'archive' ? 'Archiving…' : 'Archive'}
          </button>
        </div>

        {/* Hard delete option */}
        <div className="border border-red-200 bg-red-50/40 rounded-xl p-3 space-y-2">
          <p className="text-sm font-semibold text-red-700">Delete permanently</p>
          <p className="text-xs text-red-700/80 leading-relaxed">
            Removes the {meta.singular} and {meta.cascade}. This is irreversible.
          </p>
          {confirmingHard ? (
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmingHard(false)}
                disabled={!!busy}
                className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-xl text-xs font-semibold hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={hardDelete}
                disabled={!!busy}
                className="flex-1 bg-red-600 text-white py-2 rounded-xl text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {busy === 'delete' ? 'Deleting…' : `Yes, delete forever${totalInUse > 0 ? ` (${totalInUse} clients affected)` : ''}`}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingHard(true)}
              disabled={!!busy}
              className="w-full border border-red-200 text-red-600 py-2 rounded-xl text-xs font-semibold hover:bg-red-100 disabled:opacity-50"
            >
              Delete permanently…
            </button>
          )}
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          onClick={onClose}
          disabled={!!busy}
          className="w-full text-xs text-gray-500 hover:text-gray-800 py-1.5"
        >
          Keep it
        </button>
      </div>
    </div>
  )
}
