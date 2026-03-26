'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'

const SLEEP_QUALITY_OPTIONS = [
  { value: 'deep_restful', label: 'Deep & Restful' },
  { value: 'good', label: 'Good' },
  { value: 'okay', label: 'Okay / Some disruptions' },
  { value: 'restless', label: 'Restless / Light sleep' },
  { value: 'poor', label: 'Poor / Barely slept' },
]

const ENERGY_LEVEL_OPTIONS = [
  { value: 'peaked', label: 'Peaked – ready to PR' },
  { value: 'high', label: 'High – feeling strong' },
  { value: 'moderate', label: 'Moderate – normal day' },
  { value: 'low', label: 'Low – feeling fatigued' },
  { value: 'sore', label: 'Sore – DOMS from training' },
  { value: 'depleted', label: 'Depleted – rest day needed' },
]

type CheckIn = {
  id: string
  sleep_hours: number | null
  sleep_quality: string | null
  energy_level: string | null
  rhr: number | null
  hrv: number | null
  notes: string | null
  created_at: string
  coach_feedback: string | null
  reviewed_by_coach: boolean
}

type EditDraft = {
  sleep_hours: string
  sleep_quality: string
  energy_level: string
  rhr: string
  hrv: string
  notes: string
  date: string
}

function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isoToDateInput(iso: string) {
  return iso.slice(0, 10)
}

function labelFor(options: { value: string; label: string }[], value: string | null) {
  return options.find((o) => o.value === value)?.label ?? value ?? '—'
}

function CheckInReadView({ c }: { c: CheckIn }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <p className="text-gray-400 text-xs">Sleep</p>
          <p className="font-semibold text-gray-900 text-sm">{c.sleep_hours != null ? `${c.sleep_hours}h` : '—'}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">Quality</p>
          <p className="font-semibold text-gray-900 text-sm">{labelFor(SLEEP_QUALITY_OPTIONS, c.sleep_quality)}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">Energy</p>
          <p className="font-semibold text-gray-900 text-sm">{labelFor(ENERGY_LEVEL_OPTIONS, c.energy_level)}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">RHR</p>
          <p className="font-semibold text-gray-900 text-sm">{c.rhr != null ? `${c.rhr} bpm` : '—'}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">HRV</p>
          <p className="font-semibold text-gray-900 text-sm">{c.hrv != null ? `${c.hrv} ms` : '—'}</p>
        </div>
      </div>
      {c.notes && <p className="text-xs text-gray-500 italic">"{c.notes}"</p>}

      {/* Coach feedback */}
      <div className={`mt-2 pt-2 border-t border-gray-100 flex items-start gap-2 ${!c.coach_feedback && !c.reviewed_by_coach ? 'opacity-0 h-0 overflow-hidden pt-0 mt-0 border-0' : ''}`}>
        <div className="flex-shrink-0 mt-0.5">
          {c.reviewed_by_coach ? (
            <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-600 font-semibold px-2 py-0.5 rounded-full">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Reviewed
            </span>
          ) : (
            <span className="inline-flex text-xs bg-amber-50 text-amber-500 font-semibold px-2 py-0.5 rounded-full">
              Pending
            </span>
          )}
        </div>
        {c.coach_feedback && (
          <div className="flex-1 bg-blue-50 rounded-xl px-3 py-2">
            <p className="text-xs font-semibold text-blue-600 mb-0.5">Coach feedback</p>
            <p className="text-xs text-gray-700 whitespace-pre-wrap">{c.coach_feedback}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function CheckInCard({
  c,
  onUpdate,
  onDelete,
}: {
  c: CheckIn
  onUpdate: (updated: CheckIn) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [draft, setDraft] = useState<EditDraft>({
    sleep_hours: c.sleep_hours != null ? String(c.sleep_hours) : '',
    sleep_quality: c.sleep_quality ?? '',
    energy_level: c.energy_level ?? '',
    rhr: c.rhr != null ? String(c.rhr) : '',
    hrv: c.hrv != null ? String(c.hrv) : '',
    notes: c.notes ?? '',
    date: isoToDateInput(c.created_at),
  })

  function startEdit() {
    setDraft({
      sleep_hours: c.sleep_hours != null ? String(c.sleep_hours) : '',
      sleep_quality: c.sleep_quality ?? '',
      energy_level: c.energy_level ?? '',
      rhr: c.rhr != null ? String(c.rhr) : '',
      hrv: c.hrv != null ? String(c.hrv) : '',
      notes: c.notes ?? '',
      date: isoToDateInput(c.created_at),
    })
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const created_at = new Date(draft.date + 'T12:00:00').toISOString()
    const payload = {
      created_at,
      sleep_hours: draft.sleep_hours ? Number(draft.sleep_hours) : null,
      sleep_quality: draft.sleep_quality || null,
      energy_level: draft.energy_level || null,
      rhr: draft.rhr ? Number(draft.rhr) : null,
      hrv: draft.hrv ? Number(draft.hrv) : null,
      notes: draft.notes || null,
    }
    const { error } = await supabase.from('check_ins').update(payload).eq('id', c.id)
    if (!error) {
      onUpdate({ ...c, ...payload })
      setEditing(false)
    }
    setSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('check_ins').delete().eq('id', c.id)
    if (!error) onDelete(c.id)
    setDeleting(false)
  }

  const fieldClass = 'w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white'

  return (
    <div className="py-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-500">
          {new Date(c.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </p>
        {!editing && !confirmDelete && (
          <div className="flex gap-2">
            <button
              onClick={startEdit}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Edit
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-red-500 hover:text-red-700 font-medium"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {confirmDelete && (
        <div className="flex items-center gap-3 bg-red-50 rounded-lg px-3 py-2">
          <p className="text-xs text-red-700 flex-1">Delete this check-in?</p>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Yes, delete'}
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      )}

      {editing ? (
        <div className="space-y-2">
          <div>
            <label className="text-xs text-gray-500 mb-0.5 block">Date</label>
            <input type="date" value={draft.date} max={todayLocal()} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} className={fieldClass} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">Sleep (hrs)</label>
              <input type="number" min={0} max={24} step="0.5" value={draft.sleep_hours} onChange={(e) => setDraft((d) => ({ ...d, sleep_hours: e.target.value }))} placeholder="e.g. 7.5" className={fieldClass} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">Sleep quality</label>
              <select value={draft.sleep_quality} onChange={(e) => setDraft((d) => ({ ...d, sleep_quality: e.target.value }))} className={fieldClass}>
                <option value="">—</option>
                {SLEEP_QUALITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">Energy</label>
              <select value={draft.energy_level} onChange={(e) => setDraft((d) => ({ ...d, energy_level: e.target.value }))} className={fieldClass}>
                <option value="">—</option>
                {ENERGY_LEVEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">RHR (bpm)</label>
              <input type="number" min={30} max={220} value={draft.rhr} onChange={(e) => setDraft((d) => ({ ...d, rhr: e.target.value }))} placeholder="e.g. 58" className={fieldClass} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">HRV (ms)</label>
              <input type="number" min={0} value={draft.hrv} onChange={(e) => setDraft((d) => ({ ...d, hrv: e.target.value }))} placeholder="e.g. 65" className={fieldClass} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-0.5 block">Notes</label>
            <textarea rows={2} value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} className={`${fieldClass} resize-none`} />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 text-white rounded-lg py-1.5 text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-1.5 text-xs font-medium hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      ) : !confirmDelete && (
        <CheckInReadView c={c} />
      )}
    </div>
  )
}

export default function DailyCheckIn() {
  const [checkIns, setCheckIns] = useState<CheckIn[]>([])
  const [expanded, setExpanded] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [date, setDate] = useState(todayLocal)
  const [pending, setPending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { loadCheckIns(1) }, [])

  async function loadCheckIns(limit: number) {
    const supabase = createClient()
    const { data, error: qErr } = await supabase
      .from('check_ins')
      .select('id, sleep_hours, sleep_quality, energy_level, rhr, hrv, notes, created_at, coach_feedback, reviewed_by_coach')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (!qErr && data) {
      setCheckIns(data)
    } else {
      const { data: fb } = await supabase
        .from('check_ins')
        .select('id, notes, created_at')
        .order('created_at', { ascending: false })
        .limit(limit)
      setCheckIns((fb ?? []).map((r) => ({ sleep_hours: null, sleep_quality: null, energy_level: null, rhr: null, hrv: null, coach_feedback: null, reviewed_by_coach: false, ...r })))
    }
  }

  function handleToggle() {
    if (!expanded && !historyLoaded) {
      loadCheckIns(30)
      setHistoryLoaded(true)
    }
    setExpanded((v) => !v)
  }

  function handleUpdate(updated: CheckIn) {
    setCheckIns((prev) => prev.map((c) => c.id === updated.id ? updated : c))
  }

  function handleDelete(id: string) {
    setCheckIns((prev) => prev.filter((c) => c.id !== id))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setPending(true)

    const form = e.currentTarget
    const formData = new FormData(form)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) { setError('Not authenticated'); setPending(false); return }

    const created_at = new Date(date + 'T12:00:00').toISOString()
    const sleepHours = formData.get('sleep_hours')
    const sleepQuality = (formData.get('sleep_quality') as string) || null
    const energyLevel = (formData.get('energy_level') as string) || null
    const rhr = formData.get('rhr')
    const hrv = formData.get('hrv')
    const notes = (formData.get('notes') as string) || null

    const fullPayload = {
      user_id: session.user.id,
      created_at,
      notes,
      sleep_hours: sleepHours ? Number(sleepHours) : null,
      sleep_quality: sleepQuality,
      energy_level: energyLevel,
      rhr: rhr ? Number(rhr) : null,
      hrv: hrv ? Number(hrv) : null,
    }

    const { data: inserted, error: insertError } = await supabase
      .from('check_ins').insert(fullPayload).select('id').single()

    if (insertError) {
      const { data: fb, error: fallbackError } = await supabase
        .from('check_ins').insert({ user_id: session.user.id, created_at, notes }).select('id').single()
      if (fallbackError) { setError(fallbackError.message); setPending(false); return }
      setCheckIns((prev) => [{
        id: fb.id, sleep_hours: null, sleep_quality: null, energy_level: null,
        rhr: null, hrv: null, notes, created_at, coach_feedback: null, reviewed_by_coach: false,
      }, ...prev])
    } else {
      setCheckIns((prev) => [{
        id: inserted.id,
        sleep_hours: sleepHours ? Number(sleepHours) : null,
        sleep_quality: sleepQuality,
        energy_level: energyLevel,
        rhr: rhr ? Number(rhr) : null,
        hrv: hrv ? Number(hrv) : null,
        notes,
        created_at,
        coach_feedback: null,
        reviewed_by_coach: false,
      }, ...prev])
    }

    setSuccess(true)
    form.reset()
    setDate(todayLocal())
    setPending(false)
  }

  const latest = checkIns[0] ?? null
  const previous = checkIns.slice(1)

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900">Daily Check-In</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={todayLocal()} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Hours of sleep last night</label>
            <input name="sleep_hours" type="number" min={0} max={24} step="0.5" placeholder="e.g. 7.5" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Sleep quality</label>
            <select name="sleep_quality" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">Select quality...</option>
              {SLEEP_QUALITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Energy level</label>
            <select name="energy_level" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">Select energy...</option>
              {ENERGY_LEVEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Resting Heart Rate <span className="font-normal text-gray-400">(bpm, optional)</span>
            </label>
            <input name="rhr" type="number" min={30} max={220} step="1" placeholder="e.g. 58" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-gray-400 mt-1">A lower RHR over time often indicates improved cardiovascular fitness.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Heart Rate Variability <span className="font-normal text-gray-400">(ms, optional)</span>
            </label>
            <input name="hrv" type="number" min={0} step="1" placeholder="e.g. 65" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-gray-400 mt-1">Monitors your body's readiness for stress and recovery.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea name="notes" rows={2} placeholder="How are you feeling today? Recovery, soreness, motivation..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
          {success && <p className="text-sm text-green-600 bg-green-50 rounded px-3 py-2">Check-in saved!</p>}
          <button type="submit" disabled={pending} className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {pending ? 'Saving...' : 'Save Daily Check-In'}
          </button>
        </form>
      </Card>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Latest Check-In</h3>
        {latest ? (
          <Card className="overflow-hidden">
            <button onClick={handleToggle} className="w-full text-left px-4 pt-4 pb-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-gray-500">
                    {new Date(latest.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                  {latest.reviewed_by_coach ? (
                    <span className="text-xs bg-green-50 text-green-600 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Reviewed
                    </span>
                  ) : (
                    <span className="text-xs bg-amber-50 text-amber-500 font-semibold px-2 py-0.5 rounded-full">Pending</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  {checkIns.length > 1 && <span>{checkIns.length - 1} previous</span>}
                  <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div><p className="text-gray-400 text-xs">Sleep</p><p className="font-semibold text-gray-900">{latest.sleep_hours != null ? `${latest.sleep_hours}h` : '—'}</p></div>
                <div><p className="text-gray-400 text-xs">Quality</p><p className="font-semibold text-gray-900">{labelFor(SLEEP_QUALITY_OPTIONS, latest.sleep_quality)}</p></div>
                <div><p className="text-gray-400 text-xs">Energy</p><p className="font-semibold text-gray-900">{labelFor(ENERGY_LEVEL_OPTIONS, latest.energy_level)}</p></div>
                <div><p className="text-gray-400 text-xs">RHR</p><p className="font-semibold text-gray-900">{latest.rhr != null ? `${latest.rhr} bpm` : '—'}</p></div>
                <div><p className="text-gray-400 text-xs">HRV</p><p className="font-semibold text-gray-900">{latest.hrv != null ? `${latest.hrv} ms` : '—'}</p></div>
              </div>
              {latest.notes && <p className="text-xs text-gray-500 italic mt-2">"{latest.notes}"</p>}
            </button>

            {expanded && (
              <div className="border-t border-gray-100 px-4 max-h-96 overflow-y-auto divide-y divide-gray-100">
                {previous.length === 0 && (
                  <p className="py-3 text-xs text-gray-400">No previous check-ins.</p>
                )}
                {previous.map((c) => (
                  <CheckInCard key={c.id} c={c} onUpdate={handleUpdate} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </Card>
        ) : (
          <p className="text-gray-400 text-sm">No check-ins yet. Complete your first check-in below.</p>
        )}
      </section>

    </div>
  )
}
