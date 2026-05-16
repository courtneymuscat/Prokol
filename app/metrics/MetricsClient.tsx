'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'

type Metric = {
  id: string
  name: string
  unit: string
  sort_order: number
}

type MetricLog = {
  id: string
  metric_id: string
  value: number
  logged_at: string
}

type PresetMetric = { name: string; unit: string; paired?: boolean }

// Paired body parts (arms / legs) are tracked per side. Tapping them
// surfaces a Left / Right / Both chooser so users can pick the side(s)
// they want without typing.
const PRESETS: PresetMetric[] = [
  { name: 'Body Fat',  unit: '%' },
  { name: 'Waist',     unit: 'cm' },
  { name: 'Hips',      unit: 'cm' },
  { name: 'Chest',     unit: 'cm' },
  { name: 'Neck',      unit: 'cm' },
  { name: 'Bicep',     unit: 'cm', paired: true },
  { name: 'Forearm',   unit: 'cm', paired: true },
  { name: 'Thigh',     unit: 'cm', paired: true },
  { name: 'Calf',      unit: 'cm', paired: true },
  { name: 'Resting HR',unit: 'bpm' },
]

// Heuristic: warn the user that custom names matching paired body parts
// (e.g. "Quad", "Hamstring") usually need Left/Right tracking.
const PAIRED_KEYWORDS = ['arm', 'leg', 'bicep', 'tricep', 'forearm', 'shoulder', 'thigh', 'quad', 'hamstring', 'calf', 'ankle', 'wrist', 'knee', 'elbow', 'glute']

function looksPaired(name: string): boolean {
  const lower = name.toLowerCase()
  if (/\b(left|right|l\.|r\.)\b/.test(lower)) return false
  return PAIRED_KEYWORDS.some((k) => lower.includes(k))
}

function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function MetricsClient() {
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [logsByMetric, setLogsByMetric] = useState<Record<string, MetricLog[]>>({})
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)

    const { data: metricsData } = await supabase
      .from('custom_metrics')
      .select('id, name, unit, sort_order')
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    const list = metricsData ?? []
    setMetrics(list)

    if (list.length > 0) {
      const ids = list.map(m => m.id)
      const { data: logs } = await supabase
        .from('custom_metric_logs')
        .select('id, metric_id, value, logged_at')
        .eq('user_id', user.id)
        .in('metric_id', ids)
        .order('logged_at', { ascending: false })

      const grouped: Record<string, MetricLog[]> = {}
      for (const m of list) grouped[m.id] = []
      for (const l of logs ?? []) {
        if (grouped[l.metric_id]) grouped[l.metric_id].push(l)
      }
      setLogsByMetric(grouped)
    } else {
      setLogsByMetric({})
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function addMetric(name: string, unit: string) {
    if (!userId) return
    const supabase = createClient()
    const trimmedName = name.trim()
    const trimmedUnit = unit.trim()
    if (!trimmedName || !trimmedUnit) return
    const nextSort = metrics.length ? Math.max(...metrics.map(m => m.sort_order)) + 1 : 0
    const { error } = await supabase.from('custom_metrics').insert({
      user_id: userId,
      name: trimmedName,
      unit: trimmedUnit,
      sort_order: nextSort,
    })
    if (error) {
      alert(error.message)
      return
    }
    setShowAdd(false)
    await load()
  }

  async function archiveMetric(id: string) {
    if (!confirm('Stop tracking this metric? Your past entries will be kept but hidden.')) return
    const supabase = createClient()
    await supabase.from('custom_metrics').update({ archived: true }).eq('id', id)
    await load()
  }

  async function renameMetric(id: string, name: string, unit: string) {
    const supabase = createClient()
    const trimmedName = name.trim()
    const trimmedUnit = unit.trim()
    if (!trimmedName || !trimmedUnit) return
    const { error } = await supabase
      .from('custom_metrics')
      .update({ name: trimmedName, unit: trimmedUnit })
      .eq('id', id)
    if (error) {
      alert(error.message)
      return
    }
    await load()
  }

  async function logEntry(metricId: string, value: number, date: string) {
    if (!userId) return
    const supabase = createClient()
    const loggedAt = new Date(date + 'T12:00:00').toISOString()
    const { error } = await supabase.from('custom_metric_logs').insert({
      user_id: userId,
      metric_id: metricId,
      value,
      logged_at: loggedAt,
    })
    if (error) {
      alert(error.message)
      return
    }
    await load()
  }

  async function updateLog(logId: string, value: number) {
    const supabase = createClient()
    await supabase.from('custom_metric_logs').update({ value }).eq('id', logId)
    await load()
  }

  async function deleteLog(logId: string) {
    const supabase = createClient()
    await supabase.from('custom_metric_logs').delete().eq('id', logId)
    await load()
  }

  const usedNames = useMemo(() => new Set(metrics.map(m => m.name.toLowerCase())), [metrics])

  if (loading) {
    return <p className="text-sm text-gray-400">Loading…</p>
  }

  return (
    <div className="space-y-4">
      {metrics.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-sm text-gray-500 mb-1">No metrics tracked yet.</p>
          <p className="text-xs text-gray-400 mb-4">
            Track things like body fat, measurements, or anything else important to your goal.
          </p>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="text-sm font-semibold px-4 py-2 rounded-xl text-white"
            style={{ backgroundColor: '#1D9E75' }}
          >
            Add your first metric
          </button>
        </Card>
      ) : (
        <>
          {metrics.map((m) => (
            <MetricCard
              key={m.id}
              metric={m}
              logs={logsByMetric[m.id] ?? []}
              expanded={expandedId === m.id}
              onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
              onLog={(value, date) => logEntry(m.id, value, date)}
              onArchive={() => archiveMetric(m.id)}
              onRename={(name, unit) => renameMetric(m.id, name, unit)}
              onUpdateLog={(logId, value) => updateLog(logId, value)}
              onDeleteLog={(logId) => deleteLog(logId)}
            />
          ))}
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="w-full text-sm font-semibold px-4 py-3 rounded-2xl border-2 border-dashed border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-800 transition-colors"
          >
            + Add another metric
          </button>
        </>
      )}

      {showAdd && (
        <AddMetricModal
          usedNames={usedNames}
          onCancel={() => setShowAdd(false)}
          onAdd={addMetric}
        />
      )}
    </div>
  )
}

function MetricCard({
  metric,
  logs,
  expanded,
  onToggle,
  onLog,
  onArchive,
  onRename,
  onUpdateLog,
  onDeleteLog,
}: {
  metric: Metric
  logs: MetricLog[]
  expanded: boolean
  onToggle: () => void
  onLog: (value: number, date: string) => Promise<void>
  onArchive: () => Promise<void>
  onRename: (name: string, unit: string) => Promise<void>
  onUpdateLog: (logId: string, value: number) => Promise<void>
  onDeleteLog: (logId: string) => Promise<void>
}) {
  const [value, setValue] = useState('')
  const [date, setDate] = useState(todayLocal)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(metric.name)
  const [editUnit, setEditUnit] = useState(metric.unit)
  const [editingLogId, setEditingLogId] = useState<string | null>(null)
  const [editLogValue, setEditLogValue] = useState('')

  const latest = logs[0] ?? null
  const previous = logs[1] ?? null
  const delta = latest && previous ? latest.value - previous.value : null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const num = parseFloat(value)
    if (!Number.isFinite(num)) return
    setSaving(true)
    await onLog(num, date)
    setValue('')
    setDate(todayLocal())
    setSaving(false)
  }

  async function saveRename() {
    await onRename(editName, editUnit)
    setEditing(false)
  }

  async function saveLogEdit(logId: string) {
    const num = parseFloat(editLogValue)
    if (!Number.isFinite(num)) return
    await onUpdateLog(logId, num)
    setEditingLogId(null)
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 flex items-center justify-between text-left -m-1 p-1 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <div>
            <h3 className="text-base font-semibold text-gray-900">{metric.name}</h3>
            {latest ? (
              <p className="text-xs text-gray-400 mt-0.5">
                Latest: <span className="text-gray-700 font-medium">{latest.value} {metric.unit}</span>
                <span className="text-gray-300"> · {fmtDate(latest.logged_at)}</span>
                {delta !== null && (
                  <span className={`ml-2 font-semibold ${delta < 0 ? 'text-green-600' : delta > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                    {delta >= 0 ? '+' : ''}{delta.toFixed(1)}
                  </span>
                )}
              </p>
            ) : (
              <p className="text-xs text-gray-400 mt-0.5">No entries yet · unit: {metric.unit}</p>
            )}
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <form onSubmit={submit} className="mt-4 flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={todayLocal()}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex-1">
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Value</label>
          <div className="relative">
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              step="0.1"
              placeholder="—"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">
              {metric.unit}
            </span>
          </div>
        </div>
        <button
          type="submit"
          disabled={saving || !value}
          className="text-sm font-semibold px-4 py-2 rounded-lg text-white disabled:opacity-40 transition-colors"
          style={{ backgroundColor: '#1D9E75' }}
        >
          {saving ? '…' : 'Log'}
        </button>
      </form>

      {expanded && (
        <div className="mt-5 pt-4 border-t border-gray-100 space-y-4">
          {logs.length >= 2 ? (
            <MetricChart logs={logs} unit={metric.unit} />
          ) : (
            <p className="text-xs text-gray-400">Log at least 2 entries to see the trend chart.</p>
          )}

          {logs.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">History</p>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {logs.map((l) => (
                  <div key={l.id} className="flex items-center justify-between text-xs gap-2">
                    <span className="text-gray-400 flex-shrink-0">{fmtDate(l.logged_at)}</span>
                    {editingLogId === l.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={editLogValue}
                          onChange={(e) => setEditLogValue(e.target.value)}
                          step="0.1"
                          className="w-20 border border-blue-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <button
                          type="button"
                          onClick={() => saveLogEdit(l.id)}
                          className="text-[11px] font-semibold text-white bg-blue-600 rounded px-2 py-1 hover:bg-blue-700"
                        >Save</button>
                        <button
                          type="button"
                          onClick={() => setEditingLogId(null)}
                          className="text-[11px] font-semibold text-gray-500 hover:text-gray-700"
                        >Cancel</button>
                        <button
                          type="button"
                          onClick={() => { onDeleteLog(l.id); setEditingLogId(null) }}
                          className="text-[11px] font-semibold text-red-500 hover:text-red-700"
                        >Delete</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-700">{l.value} {metric.unit}</span>
                        <button
                          type="button"
                          onClick={() => { setEditingLogId(l.id); setEditLogValue(String(l.value)) }}
                          className="text-gray-300 hover:text-blue-500 active:text-blue-600 transition-colors p-1 -mr-1"
                          title="Edit"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
            {editing ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Name"
                />
                <input
                  type="text"
                  value={editUnit}
                  onChange={(e) => setEditUnit(e.target.value)}
                  className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Unit"
                />
                <button
                  type="button"
                  onClick={saveRename}
                  className="text-xs font-semibold text-white bg-blue-600 rounded-lg px-3 py-1.5 hover:bg-blue-700"
                >Save</button>
                <button
                  type="button"
                  onClick={() => { setEditing(false); setEditName(metric.name); setEditUnit(metric.unit) }}
                  className="text-xs font-semibold text-gray-500 hover:text-gray-700"
                >Cancel</button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-xs font-medium text-gray-500 hover:text-gray-900"
                >
                  Rename / change unit
                </button>
                <button
                  type="button"
                  onClick={onArchive}
                  className="text-xs font-medium text-red-500 hover:text-red-700"
                >
                  Stop tracking
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

const CHART_W = 600
const CHART_H = 160
const PAD = { top: 12, right: 12, bottom: 28, left: 40 }
const INNER_W = CHART_W - PAD.left - PAD.right
const INNER_H = CHART_H - PAD.top - PAD.bottom

function MetricChart({ logs, unit }: { logs: MetricLog[]; unit: string }) {
  // Oldest first for chart
  const ordered = [...logs].slice().reverse()
  const values = ordered.map(l => l.value)
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const spread = maxVal - minVal || Math.max(1, Math.abs(maxVal) * 0.1)
  const yMin = minVal - spread * 0.15
  const yMax = maxVal + spread * 0.15

  const toX = (i: number) => PAD.left + (i / (ordered.length - 1)) * INNER_W
  const toY = (v: number) => PAD.top + INNER_H - ((v - yMin) / (yMax - yMin)) * INNER_H

  const pathD = ordered
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.value).toFixed(1)}`)
    .join(' ')
  const areaD =
    pathD +
    ` L ${toX(ordered.length - 1).toFixed(1)} ${(PAD.top + INNER_H).toFixed(1)}` +
    ` L ${PAD.left.toFixed(1)} ${(PAD.top + INNER_H).toFixed(1)} Z`

  const yTicks = [0, 0.5, 1].map((t) => yMin + t * (yMax - yMin))
  const labelCount = Math.min(4, ordered.length)
  const labelStep = Math.floor((ordered.length - 1) / Math.max(1, labelCount - 1)) || 1
  const labelIndices = Array.from({ length: labelCount }, (_, k) =>
    Math.min(k * labelStep, ordered.length - 1)
  )

  return (
    <div className="overflow-x-auto -mx-1">
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" style={{ height: CHART_H }}>
        <defs>
          <linearGradient id={`mgrad-${unit}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1D9E75" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#1D9E75" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={PAD.left + INNER_W} y1={toY(v)} y2={toY(v)} stroke="#f3f4f6" strokeWidth={1} />
            <text x={PAD.left - 6} y={toY(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#9ca3af">
              {v.toFixed(1)}
            </text>
          </g>
        ))}

        <path d={areaD} fill={`url(#mgrad-${unit})`} />
        <path d={pathD} fill="none" stroke="#1D9E75" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {ordered.length <= 20 && ordered.map((p, i) => (
          <circle key={i} cx={toX(i)} cy={toY(p.value)} r={3} fill="white" stroke="#1D9E75" strokeWidth={2} />
        ))}

        {labelIndices.map((idx) => (
          <text key={idx} x={toX(idx)} y={PAD.top + INNER_H + 16} textAnchor="middle" fontSize={10} fill="#9ca3af">
            {new Date(ordered[idx].logged_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </text>
        ))}
      </svg>
    </div>
  )
}

function AddMetricModal({
  usedNames,
  onCancel,
  onAdd,
}: {
  usedNames: Set<string>
  onCancel: () => void
  onAdd: (name: string, unit: string) => Promise<void>
}) {
  const [customName, setCustomName] = useState('')
  const [customUnit, setCustomUnit] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingPaired, setPendingPaired] = useState<PresetMetric | null>(null)

  async function addPreset(p: PresetMetric) {
    if (p.paired) {
      setPendingPaired(p)
      return
    }
    setBusy(true)
    await onAdd(p.name, p.unit)
    setBusy(false)
  }

  async function addSided(base: string, unit: string, side: 'Left' | 'Right' | 'Both') {
    setBusy(true)
    if (side === 'Both') {
      await onAdd(`Left ${base}`, unit)
      if (!usedNames.has(`right ${base.toLowerCase()}`)) {
        await onAdd(`Right ${base}`, unit)
      }
    } else {
      await onAdd(`${side} ${base}`, unit)
    }
    setBusy(false)
    setPendingPaired(null)
  }

  const customLooksPaired = looksPaired(customName)

  async function addCustom(side?: 'Left' | 'Right' | 'Both') {
    const name = customName.trim()
    const unit = customUnit.trim()
    if (!name || !unit) return
    setBusy(true)
    if (side === 'Both') {
      await onAdd(`Left ${name}`, unit)
      if (!usedNames.has(`right ${name.toLowerCase()}`)) {
        await onAdd(`Right ${name}`, unit)
      }
    } else if (side) {
      await onAdd(`${side} ${name}`, unit)
    } else {
      await onAdd(name, unit)
    }
    setCustomName('')
    setCustomUnit('')
    setBusy(false)
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Add metric</h3>
          <button
            type="button"
            onClick={onCancel}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Common</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => {
                const already = p.paired
                  ? usedNames.has(`left ${p.name.toLowerCase()}`) && usedNames.has(`right ${p.name.toLowerCase()}`)
                  : usedNames.has(p.name.toLowerCase())
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => !already && !busy && addPreset(p)}
                    disabled={already || busy}
                    className={`text-xs font-medium px-3 py-2 rounded-full border transition-colors ${
                      already
                        ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    {p.name}{p.paired && <span className="text-gray-400"> (L/R)</span>} <span className="text-gray-400">({p.unit})</span>
                  </button>
                )
              })}
            </div>

            {pendingPaired && (
              <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-xs font-semibold text-blue-900 mb-2">
                  Which side(s) of <span className="font-bold">{pendingPaired.name}</span>?
                </p>
                <div className="flex flex-wrap gap-2">
                  {(['Left', 'Right', 'Both'] as const).map((side) => {
                    const dupName = `${side === 'Both' ? 'Left' : side} ${pendingPaired.name}`.toLowerCase()
                    const taken = side !== 'Both' && usedNames.has(dupName)
                    return (
                      <button
                        key={side}
                        type="button"
                        disabled={busy || taken}
                        onClick={() => addSided(pendingPaired.name, pendingPaired.unit, side)}
                        className={`text-xs font-semibold px-3 py-2 rounded-full border transition-colors ${
                          taken
                            ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                            : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-100'
                        }`}
                      >
                        {side === 'Both' ? 'Both (Left + Right)' : `${side} ${pendingPaired.name}`}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => setPendingPaired(null)}
                    className="text-xs font-medium text-gray-500 hover:text-gray-700 px-2"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-gray-100">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Custom</p>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-[11px] font-medium text-gray-500 mb-1">Name</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Blood pressure"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="w-24">
                <label className="block text-[11px] font-medium text-gray-500 mb-1">Unit</label>
                <input
                  type="text"
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  placeholder="cm"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {!customLooksPaired && (
                <button
                  type="button"
                  onClick={() => addCustom()}
                  disabled={busy || !customName.trim() || !customUnit.trim()}
                  className="text-sm font-semibold px-4 py-2 rounded-lg text-white disabled:opacity-40"
                  style={{ backgroundColor: '#1D9E75' }}
                >
                  Add
                </button>
              )}
            </div>

            {customLooksPaired && customName.trim() && customUnit.trim() && (
              <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-3">
                <p className="text-xs text-blue-900 mb-2">
                  This looks like a paired body part — which side(s)?
                </p>
                <div className="flex flex-wrap gap-2">
                  {(['Left', 'Right', 'Both'] as const).map((side) => (
                    <button
                      key={side}
                      type="button"
                      disabled={busy}
                      onClick={() => addCustom(side)}
                      className="text-xs font-semibold px-3 py-2 rounded-full border bg-white text-blue-700 border-blue-200 hover:bg-blue-100"
                    >
                      {side === 'Both' ? 'Both (Left + Right)' : `${side} ${customName.trim()}`}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => addCustom()}
                    disabled={busy}
                    className="text-xs font-medium text-gray-600 hover:text-gray-800 px-2"
                  >
                    Skip — just &ldquo;{customName.trim()}&rdquo;
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
