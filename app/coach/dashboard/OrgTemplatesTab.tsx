'use client'

import { useState, useEffect, useRef } from 'react'

type Template = {
  id: string
  name: string
  created_at: string
  created_by: string | null
}

type AccessSummary = {
  id: string
  name: string | null
  email: string | null
  role: string
  initial: string
}

type OrgTemplatesData = {
  autoflows: Template[]
  programs: Template[]
  meal_plans: Template[]
  forms: Template[]
  note_templates: Template[]
  services: Template[]
  resources: Template[]
  saved_workouts: Template[]
}

type OrgTemplates = OrgTemplatesData & {
  access?: Record<string, AccessSummary[]>
}

// Stable color cycle so the same coach always gets the same bubble colour
const AVATAR_COLORS = [
  'bg-purple-100 text-purple-700',
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700',
  'bg-indigo-100 text-indigo-700',
  'bg-rose-100 text-rose-700',
  'bg-teal-100 text-teal-700',
]
function colorFor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function AccessAvatars({ access }: { access: AccessSummary[] | undefined }) {
  if (!access || access.length === 0) return null
  const visible = access.slice(0, 3)
  const overflow = access.length - visible.length
  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((a) => (
        <div
          key={a.id}
          title={a.name ?? a.email ?? 'Coach'}
          className={`w-6 h-6 rounded-full ${colorFor(a.id)} text-[10px] font-semibold flex items-center justify-center ring-2 ring-white`}
        >
          {a.initial}
        </div>
      ))}
      {overflow > 0 && (
        <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-[10px] font-semibold flex items-center justify-center ring-2 ring-white">
          +{overflow}
        </div>
      )}
    </div>
  )
}

type GroupKey = keyof OrgTemplatesData
type TableName = 'autoflow_templates' | 'programs' | 'meal_plans' | 'forms' | 'note_templates' | 'coach_services' | 'coach_resources' | 'coach_saved_workouts'

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
  // Optional extractor for endpoints that don't return a bare array.
  extractList?: (raw: unknown) => Record<string, unknown>[]
}[] = [
  { key: 'autoflows',      label: 'Autoflows',      table: 'autoflow_templates', emptyLink: '/coach/autoflows',      emptyLinkLabel: 'Go to Autoflows',      fetchUrl: '/api/coach/autoflows',      nameField: 'name' },
  { key: 'programs',       label: 'Programs',       table: 'programs',           emptyLink: '/coach/programs',       emptyLinkLabel: 'Go to Programs',       fetchUrl: '/api/coach/programs',       nameField: 'name' },
  { key: 'meal_plans',     label: 'Meal Plans',     table: 'meal_plans',         emptyLink: '/coach/meal-plans',     emptyLinkLabel: 'Go to Meal Plans',     fetchUrl: '/api/coach/meal-plans',     nameField: 'name' },
  { key: 'forms',          label: 'Forms',          table: 'forms',              emptyLink: '/coach/forms',          emptyLinkLabel: 'Go to Forms',          fetchUrl: '/api/forms',                nameField: 'title' },
  { key: 'note_templates', label: 'Note Templates', table: 'note_templates',     emptyLink: '/coach/note-templates', emptyLinkLabel: 'Go to Note Templates', fetchUrl: '/api/coach/note-templates', nameField: 'name' },
  { key: 'services',       label: 'Services',       table: 'coach_services',     emptyLink: '/coach/settings',       emptyLinkLabel: 'Go to Services',       fetchUrl: '/api/coach/services',       nameField: 'name' },
  { key: 'resources',      label: 'Resources',      table: 'coach_resources',    emptyLink: '/coach/resources',      emptyLinkLabel: 'Go to Resources',      fetchUrl: '/api/coach/resources',      nameField: 'name' },
  { key: 'saved_workouts', label: 'Saved Workouts', table: 'coach_saved_workouts', emptyLink: '/coach/programs?tab=saved', emptyLinkLabel: 'Go to Saved Workouts', fetchUrl: '/api/coach/saved-workouts', nameField: 'name',
    extractList: (raw) => {
      const own = (raw as { own?: unknown[] })?.own
      return Array.isArray(own) ? (own as Record<string, unknown>[]) : []
    } },
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

  type Coach = { id: string; full_name: string | null; email: string | null; role: string }
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [includedCoachIds, setIncludedCoachIds] = useState<Set<string>>(new Set())
  type Dep = { id: string; name: string; already_shared: boolean }
  const [deps, setDeps] = useState<{ forms: Dep[]; resources: Dep[] }>({ forms: [], resources: [] })
  const [loadingPreview, setLoadingPreview] = useState(false)

  const activeGroup = GROUPS.find((g) => g.table === table)!

  // Load list of coaches in the org once
  useEffect(() => {
    fetch('/api/org/coaches')
      .then((r) => r.json())
      .then((data) => {
        const all = (data?.coaches ?? []) as Array<{ id: string; full_name: string | null; email: string | null; role: string }>
        setCoaches(all)
        // Default: every non-owner/admin coach selected. Admins/owners are
        // always included (they always have access regardless of exclusions).
        setIncludedCoachIds(new Set(all.filter((c) => c.role === 'coach').map((c) => c.id)))
      })
      .catch(() => {/* silent */})
  }, [])

  // Reload available templates when the table changes
  useEffect(() => {
    setSelectedId('')
    setError(null)
    setLoadingList(true)
    fetch(activeGroup.fetchUrl)
      .then((r) => r.json())
      .then((raw: unknown) => {
        const data = activeGroup.extractList
          ? activeGroup.extractList(raw)
          : (Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [])
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

  // Preview the cross-template dependencies for the selected template
  useEffect(() => {
    if (!selectedId) {
      setDeps({ forms: [], resources: [] })
      return
    }
    setLoadingPreview(true)
    fetch(`/api/org/templates/preview?template_id=${selectedId}&table=${table}`)
      .then((r) => r.json())
      .then((d) => setDeps(d.dependencies ?? { forms: [], resources: [] }))
      .catch(() => setDeps({ forms: [], resources: [] }))
      .finally(() => setLoadingPreview(false))
  }, [selectedId, table])

  function toggleCoach(id: string) {
    setIncludedCoachIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll(allOn: boolean) {
    const coachOnly = coaches.filter((c) => c.role === 'coach').map((c) => c.id)
    setIncludedCoachIds(allOn ? new Set(coachOnly) : new Set())
  }

  async function submit() {
    if (!selectedId) return
    setSaving(true)
    setError(null)
    // Convert "included coaches" into the exclusion list the API expects
    const memberCoachIds = coaches.filter((c) => c.role === 'coach').map((c) => c.id)
    const excludedCoachIds = memberCoachIds.filter((id) => !includedCoachIds.has(id))
    const res = await fetch('/api/org/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: selectedId, table, excluded_coach_ids: excludedCoachIds }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Something went wrong')
      setSaving(false)
      return
    }
    onDone()
  }

  const memberCoaches = coaches.filter((c) => c.role === 'coach')
  const allSelected = memberCoaches.length > 0 && memberCoaches.every((c) => includedCoachIds.has(c.id))
  const noneSelected = memberCoaches.every((c) => !includedCoachIds.has(c.id))

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

        {/* Dependency preview (autoflows only) */}
        {selectedId && table === 'autoflow_templates' && (
          <div className="border border-amber-100 bg-amber-50 rounded-xl px-4 py-3 space-y-2">
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Will also be shared</p>
            {loadingPreview ? (
              <p className="text-xs text-amber-700">Checking dependencies…</p>
            ) : (deps.forms.length === 0 && deps.resources.length === 0) ? (
              <p className="text-xs text-amber-700">No forms or resources are referenced by this autoflow.</p>
            ) : (
              <div className="space-y-1.5">
                {deps.forms.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 text-xs">
                    <span className="text-amber-600">📋</span>
                    <span className="text-amber-900">{f.name}</span>
                    {f.already_shared && <span className="text-[10px] text-amber-600 italic">already shared</span>}
                  </div>
                ))}
                {deps.resources.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-xs">
                    <span className="text-amber-600">📚</span>
                    <span className="text-amber-900">{r.name}</span>
                    {r.already_shared && <span className="text-[10px] text-amber-600 italic">already shared</span>}
                  </div>
                ))}
                <p className="text-[11px] text-amber-700 pt-1">
                  Forms and resources used inside this autoflow will be shared too so it works end-to-end for the chosen coaches.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Coach selection */}
        {memberCoaches.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">Visible to</label>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => toggleAll(true)}
                  disabled={allSelected}
                  className="text-blue-600 hover:underline disabled:opacity-40 disabled:no-underline"
                >
                  Select all
                </button>
                <span className="text-gray-300">·</span>
                <button
                  type="button"
                  onClick={() => toggleAll(false)}
                  disabled={noneSelected}
                  className="text-gray-500 hover:underline disabled:opacity-40 disabled:no-underline"
                >
                  None
                </button>
              </div>
            </div>
            <div className="border border-gray-100 rounded-xl divide-y divide-gray-50 max-h-44 overflow-y-auto">
              {memberCoaches.map((c) => {
                const checked = includedCoachIds.has(c.id)
                return (
                  <label
                    key={c.id}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCoach(c.id)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 truncate flex-1">
                      {c.full_name ?? c.email ?? 'Coach'}
                    </span>
                  </label>
                )
              })}
            </div>
            <p className="text-[11px] text-gray-400">
              Admins and owners always see published templates regardless of this list.
            </p>
          </div>
        )}

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
  onChanged,
}: {
  template: Template
  table: TableName
  onClose: () => void
  onChanged: () => void
}) {
  const [coaches, setCoaches] = useState<CoachAccess[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  type Dep = { id: string; name: string; already_shared: boolean }
  const [deps, setDeps] = useState<{ forms: Dep[]; resources: Dep[] }>({ forms: [], resources: [] })
  const dirty = useRef(false)

  useEffect(() => {
    fetch(`/api/org/templates/${template.id}/coaches?table=${table}`)
      .then((r) => r.json())
      .then(setCoaches)
      .catch(() => setCoaches([]))
      .finally(() => setLoading(false))

    if (table === 'autoflow_templates') {
      fetch(`/api/org/templates/preview?template_id=${template.id}&table=${table}`)
        .then((r) => r.json())
        .then((d) => setDeps(d.dependencies ?? { forms: [], resources: [] }))
        .catch(() => {/* silent */})
    }
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
    dirty.current = true
    setSaving(null)
  }

  function close() {
    if (dirty.current) onChanged()
    onClose()
  }

  function initials(name: string | null, email: string | null) {
    if (name) return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    return (email ?? '?')[0].toUpperCase()
  }

  const hasDeps = deps.forms.length > 0 || deps.resources.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={close} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div>
          <h3 className="font-semibold text-gray-900">Manage access</h3>
          <p className="text-sm text-gray-500 mt-0.5 truncate">{template.name}</p>
        </div>
        <p className="text-xs text-gray-400">
          Toggle which coaches can see this template. Admins always have access.
        </p>

        {table === 'autoflow_templates' && hasDeps && (
          <div className="border border-amber-100 bg-amber-50 rounded-xl px-4 py-3 space-y-2">
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Access mirrors these</p>
            <div className="space-y-1">
              {deps.forms.map((f) => (
                <div key={f.id} className="flex items-center gap-2 text-xs">
                  <span className="text-amber-600">📋</span>
                  <span className="text-amber-900">{f.name}</span>
                </div>
              ))}
              {deps.resources.map((r) => (
                <div key={r.id} className="flex items-center gap-2 text-xs">
                  <span className="text-amber-600">📚</span>
                  <span className="text-amber-900">{r.name}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-amber-700 pt-1">
              Toggling a coach here also toggles their access to these forms and resources, so the autoflow keeps working end-to-end.
            </p>
          </div>
        )}

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
          onClick={close}
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

  async function fetchTemplates(silent = false) {
    if (!silent) setLoading(true)
    const res = await fetch('/api/org/templates')
    if (res.ok) setTemplates(await res.json())
    if (!silent) setLoading(false)
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
    ? GROUPS.reduce((sum, g) => sum + (templates[g.key]?.length ?? 0), 0)
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
                    <div className="flex items-center gap-3 shrink-0">
                      <AccessAvatars access={templates?.access?.[t.id]} />
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
          onChanged={() => fetchTemplates(true)}
        />
      )}
    </div>
  )
}
