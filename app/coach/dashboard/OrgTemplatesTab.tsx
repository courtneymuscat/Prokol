'use client'

import { useState, useEffect } from 'react'

type Template = {
  id: string
  name: string
  created_at: string
  created_by: string | null
}

type OrgTemplates = {
  autoflows: Template[]
  programs: Template[]
  meal_plans: Template[]
  forms: Template[]
  note_templates: Template[]
}

type GroupKey = keyof OrgTemplates
type TableName = 'autoflow_templates' | 'programs' | 'meal_plans' | 'forms' | 'note_templates'

type CoachAccess = {
  id: string
  role: string
  full_name: string | null
  email: string | null
  excluded: boolean
}

const GROUPS: {
  key: GroupKey
  label: string
  table: TableName
  emptyLink: string
  emptyLinkLabel: string
  fetchUrl: string
  nameField: string
}[] = [
  { key: 'autoflows',      label: 'Autoflows',      table: 'autoflow_templates', emptyLink: '/coach/autoflows',      emptyLinkLabel: 'Go to Autoflows',      fetchUrl: '/api/coach/autoflows',      nameField: 'name' },
  { key: 'programs',       label: 'Programs',       table: 'programs',           emptyLink: '/coach/programs',       emptyLinkLabel: 'Go to Programs',       fetchUrl: '/api/coach/programs',       nameField: 'name' },
  { key: 'meal_plans',     label: 'Meal Plans',     table: 'meal_plans',         emptyLink: '/coach/meal-plans',     emptyLinkLabel: 'Go to Meal Plans',     fetchUrl: '/api/coach/meal-plans',     nameField: 'name' },
  { key: 'forms',          label: 'Forms',          table: 'forms',              emptyLink: '/coach/forms',          emptyLinkLabel: 'Go to Forms',          fetchUrl: '/api/forms',                nameField: 'title' },
  { key: 'note_templates', label: 'Note Templates', table: 'note_templates',     emptyLink: '/coach/note-templates', emptyLinkLabel: 'Go to Note Templates', fetchUrl: '/api/coach/note-templates', nameField: 'name' },
]

// ─── Publish modal ────────────────────────────────────────────────────────────

type CoachTemplate = { id: string; name: string }

function PublishModal({
  onClose,
  onDone,
  orgTemplates,
}: {
  onClose: () => void
  onDone: () => void
  orgTemplates: OrgTemplates
}) {
  const [table, setTable] = useState<TableName>('autoflow_templates')
  const [available, setAvailable] = useState<CoachTemplate[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeGroup = GROUPS.find((g) => g.table === table)!

  useEffect(() => {
    setSelectedId('')
    setError(null)
    setLoadingList(true)
    fetch(activeGroup.fetchUrl)
      .then((r) => r.json())
      .then((data: Record<string, unknown>[]) => {
        const orgKey = activeGroup.key
        const publishedIds = new Set(orgTemplates[orgKey].map((t) => t.id))
        const list = data
          .filter((t) => !publishedIds.has(t.id as string))
          .map((t) => ({
            id: t.id as string,
            name: (t[activeGroup.nameField] as string) ?? 'Untitled',
          }))
        setAvailable(list)
      })
      .catch(() => setAvailable([]))
      .finally(() => setLoadingList(false))
  }, [table]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    if (!selectedId) return
    setSaving(true)
    setError(null)
    const res = await fetch('/api/org/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: selectedId, table }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Something went wrong')
      setSaving(false)
      return
    }
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Publish template to organisation</h3>
        <p className="text-sm text-gray-500">
          Select one of your templates to share with all coaches in your org.
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Template type</label>
          <select
            value={table}
            onChange={(e) => setTable(e.target.value as TableName)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
          >
            {GROUPS.map(({ table: t, label }) => (
              <option key={t} value={t}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
          {loadingList ? (
            <div className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-400 bg-gray-50 animate-pulse">
              Loading templates…
            </div>
          ) : available.length === 0 ? (
            <div className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-400 bg-gray-50">
              No unpublished {activeGroup.label.toLowerCase()} found.{' '}
              <a href={activeGroup.emptyLink} className="text-blue-500 hover:underline">
                Create one →
              </a>
            </div>
          ) : (
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a template…</option>
              {available.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!selectedId || saving}
            className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Publishing…' : 'Publish to org'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Access modal ─────────────────────────────────────────────────────────────

function AccessModal({
  template,
  table,
  onClose,
}: {
  template: Template
  table: TableName
  onClose: () => void
}) {
  const [coaches, setCoaches] = useState<CoachAccess[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/org/templates/${template.id}/coaches?table=${table}`)
      .then((r) => r.json())
      .then(setCoaches)
      .catch(() => setCoaches([]))
      .finally(() => setLoading(false))
  }, [template.id, table])

  async function toggle(coach: CoachAccess) {
    setSaving(coach.id)
    const newExcluded = !coach.excluded
    await fetch(`/api/org/templates/${template.id}/coaches`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coach_id: coach.id, table, excluded: newExcluded }),
    })
    setCoaches((prev) =>
      prev.map((c) => (c.id === coach.id ? { ...c, excluded: newExcluded } : c))
    )
    setSaving(null)
  }

  function initials(name: string | null, email: string | null) {
    if (name) return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    return (email ?? '?')[0].toUpperCase()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div>
          <h3 className="font-semibold text-gray-900">Manage access</h3>
          <p className="text-sm text-gray-500 mt-0.5 truncate">{template.name}</p>
        </div>
        <p className="text-xs text-gray-400">
          Toggle which coaches can see this template. Admins always have access.
        </p>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : coaches.length === 0 ? (
          <p className="text-sm text-gray-400">No coaches found.</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto -mx-1 px-1">
            {coaches.map((coach) => {
              const isAdmin = coach.role === 'admin' || coach.role === 'owner'
              const hasAccess = isAdmin || !coach.excluded
              return (
                <div
                  key={coach.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50"
                >
                  <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold flex items-center justify-center shrink-0">
                    {initials(coach.full_name, coach.email)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {coach.full_name ?? coach.email}
                    </p>
                    <p className="text-xs text-gray-400 capitalize">{coach.role}</p>
                  </div>
                  {isAdmin ? (
                    <span className="text-xs text-gray-400 shrink-0">Always on</span>
                  ) : (
                    <button
                      onClick={() => toggle(coach)}
                      disabled={saving === coach.id}
                      aria-label={hasAccess ? 'Revoke access' : 'Grant access'}
                      className={`relative w-10 h-6 rounded-full transition-colors shrink-0 disabled:opacity-50 ${
                        hasAccess ? 'bg-green-500' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          hasAccess ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm"
        >
          Done
        </button>
      </div>
    </div>
  )
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export default function OrgTemplatesTab() {
  const [templates, setTemplates] = useState<OrgTemplates | null>(null)
  const [loading, setLoading] = useState(true)
  const [publishOpen, setPublishOpen] = useState(false)
  const [unpublishing, setUnpublishing] = useState<string | null>(null)
  const [accessTarget, setAccessTarget] = useState<{ template: Template; table: TableName } | null>(null)

  async function fetchTemplates() {
    setLoading(true)
    const res = await fetch('/api/org/templates')
    if (res.ok) setTemplates(await res.json())
    setLoading(false)
  }

  async function unpublish(templateId: string, table: TableName) {
    setUnpublishing(templateId)
    await fetch('/api/org/templates', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: templateId, table }),
    })
    await fetchTemplates()
    setUnpublishing(null)
  }

  useEffect(() => { fetchTemplates() }, [])

  const totalCount = templates
    ? Object.values(templates).reduce((sum, arr) => sum + arr.length, 0)
    : 0

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 h-24" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Organisation Templates</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Shared templates visible to coaches in your org ·{' '}
            <span className="font-medium text-gray-700">{totalCount} total</span>
          </p>
        </div>
        <button
          onClick={() => setPublishOpen(true)}
          className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700 transition-colors shrink-0"
        >
          + Publish template
        </button>
      </div>

      {GROUPS.map(({ key, label, table, emptyLink, emptyLinkLabel }) => {
        const items = templates?.[key] ?? []
        return (
          <div key={key} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <h3 className="font-medium text-gray-900 text-sm">{label}</h3>
              <span className="text-xs text-gray-400">
                {items.length} template{items.length !== 1 ? 's' : ''}
              </span>
            </div>

            {items.length === 0 ? (
              <div className="px-5 py-4 flex items-center justify-between">
                <p className="text-sm text-gray-400">No shared {label.toLowerCase()} yet.</p>
                <a href={emptyLink} className="text-xs text-blue-600 hover:underline">
                  {emptyLinkLabel} →
                </a>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {items.map((t) => (
                  <div key={t.id} className="px-5 py-3.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{t.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Published {new Date(t.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setAccessTarget({ template: t, table })}
                        className="text-xs border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-200 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Manage access
                      </button>
                      <button
                        onClick={() => unpublish(t.id, table)}
                        disabled={unpublishing === t.id}
                        className="text-xs border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                      >
                        {unpublishing === t.id ? 'Removing…' : 'Unpublish'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {publishOpen && templates && (
        <PublishModal
          onClose={() => setPublishOpen(false)}
          onDone={() => { setPublishOpen(false); fetchTemplates() }}
          orgTemplates={templates}
        />
      )}

      {accessTarget && (
        <AccessModal
          template={accessTarget.template}
          table={accessTarget.table}
          onClose={() => setAccessTarget(null)}
        />
      )}
    </div>
  )
}
