'use client'

import { useEffect, useMemo, useState } from 'react'
import ClientTagBadges from '../ClientTagBadges'

type Row = {
  id: string
  client_id: string
  client_name: string
  flow_id: string
  step_number: number
  title: string
  type: 'week0' | 'weekly' | 'final'
  path: 'ps' | 'ts' | 'pc' | null
  submitted_at: string
  overall_score: string | null
  reviewed: boolean
  reviewed_at: string | null
  has_feedback: boolean
  flags: { rule_key: string; severity: string; reason: string; cleared_at: string | null }[]
  is_flagged: boolean
  flag_severity: 'urgent' | 'lead' | 'normal' | null
  flag_counts: { urgent: number; normal: number; lead: number }
}

const TYPE_LABELS: Record<string, string> = { week0: 'Week 0', weekly: 'Weekly', final: 'Final' }

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Urgent = red, Normal = amber, Lead = blue — same scheme as the flag
// editor in the autoflow builder. r.flag_severity (used for the row's
// left border / sort order) only ever surfaces the single worst
// severity — this shows every severity that actually fired, with a count,
// since one response can carry several (e.g. 2 Normal + 3 Lead).
function FlagCounts({ counts }: { counts: { urgent: number; normal: number; lead: number } }) {
  const items: { label: string; n: number; className: string }[] = [
    { label: 'Urgent', n: counts.urgent, className: 'bg-red-600 text-white' },
    { label: 'Normal', n: counts.normal, className: 'bg-amber-50 text-amber-700 border border-amber-200' },
    { label: 'Lead', n: counts.lead, className: 'bg-blue-100 text-blue-700 border border-blue-200' },
  ].filter((i) => i.n > 0)
  if (items.length === 0) return null
  return (
    <div className="flex flex-col items-end gap-1">
      {items.map((i) => (
        <span key={i.label} className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full whitespace-nowrap ${i.className}`}>
          {i.n} {i.label}
        </span>
      ))}
    </div>
  )
}

const SEVERITY_BORDER: Record<'urgent' | 'lead' | 'normal', string> = {
  urgent: 'border-l-red-500',
  normal: 'border-l-amber-400',
  lead: 'border-l-blue-400',
}

export default function ProkolMethodCheckins() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [weekFilter, setWeekFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'new' | 'reviewed' | 'all'>('new')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sort, setSort] = useState<'flagged' | 'newest' | 'oldest'>('flagged')
  const [working, setWorking] = useState(false)

  async function load() {
    const res = await fetch('/api/coach/checkins/prokol-method')
    const data = await res.json()
    setRows(Array.isArray(data) ? data : [])
  }

  useEffect(() => { load() }, [])

  const weekOptions = useMemo(() => {
    const nums = new Set((rows ?? []).map((r) => r.step_number))
    return [...nums].sort((a, b) => a - b)
  }, [rows])

  const filtered = useMemo(() => {
    let list = rows ?? []
    if (weekFilter !== 'all') list = list.filter((r) => r.step_number === Number(weekFilter))
    if (typeFilter !== 'all') list = list.filter((r) => r.type === typeFilter)
    if (flaggedOnly) list = list.filter((r) => r.is_flagged)
    if (statusFilter === 'new') list = list.filter((r) => !r.reviewed)
    else if (statusFilter === 'reviewed') list = list.filter((r) => r.reviewed)
    if (dateFrom) list = list.filter((r) => r.submitted_at.slice(0, 10) >= dateFrom)
    if (dateTo) list = list.filter((r) => r.submitted_at.slice(0, 10) <= dateTo)

    const sorted = [...list]
    if (sort === 'newest') sorted.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
    else if (sort === 'oldest') sorted.sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime())
    else {
      sorted.sort((a, b) => {
        if (a.is_flagged !== b.is_flagged) return a.is_flagged ? -1 : 1
        return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
      })
    }
    return sorted
  }, [rows, weekFilter, typeFilter, flaggedOnly, statusFilter, dateFrom, dateTo, sort])

  const newCount = (rows ?? []).filter((r) => !r.reviewed).length
  const flaggedCount = (rows ?? []).filter((r) => r.is_flagged).length

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map((r) => r.id)))
  }

  async function markReviewed() {
    const ids = [...selected]
    const anyFlagged = filtered.some((r) => ids.includes(r.id) && r.is_flagged)
    let confirmFlagged = false
    if (anyFlagged) {
      const ok = confirm("One or more selected check-ins are flagged. Marking as reviewed will clear their flags (the reason stays in their history). I've looked into this — continue?")
      if (!ok) return
      confirmFlagged = true
    }
    setWorking(true)
    try {
      await fetch('/api/coach/checkins/prokol-method/bulk-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseIds: ids, confirmFlagged }),
      })
      setSelected(new Set())
      await load()
    } finally {
      setWorking(false)
    }
  }

  if (rows === null) {
    return <div className="bg-white rounded-2xl border p-8 text-center text-sm text-gray-400">Loading Prokol Method check-ins…</div>
  }

  if (rows.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-gray-900">The Prokol Method — Check-ins</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            <span className="font-semibold text-amber-600">{newCount} new</span>
            {' · '}
            <span className="font-semibold text-red-600">{flaggedCount} flagged</span>
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 bg-white rounded-xl border p-3">
        <select value={weekFilter} onChange={(e) => setWeekFilter(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
          <option value="all">All weeks</option>
          {weekOptions.map((n) => <option key={n} value={n}>{rows.find((r) => r.step_number === n)?.title ?? `Step ${n}`}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
          <option value="all">All types</option>
          <option value="week0">Week 0</option>
          <option value="weekly">Weekly</option>
          <option value="final">Final</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'new' | 'reviewed' | 'all')} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
          <option value="new">New</option>
          <option value="reviewed">Reviewed</option>
          <option value="all">All</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
          <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} className="rounded" />
          Flagged only
        </label>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5" title="From date" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5" title="To date" />
        <select value={sort} onChange={(e) => setSort(e.target.value as 'flagged' | 'newest' | 'oldest')} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white ml-auto">
          <option value="flagged">Flagged first</option>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
          <span className="text-xs font-semibold text-blue-800">{selected.size} selected</span>
          <button onClick={markReviewed} disabled={working} className="text-xs font-semibold bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {working ? 'Working…' : 'Mark as reviewed'}
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs font-medium text-blue-700 hover:text-blue-900">Clear selection</button>
        </div>
      )}

      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
          <input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleAll} className="rounded" />
          <span className="flex-1">Client</span>
          <span className="w-24">Week</span>
          <span className="w-40 hidden sm:block">Step</span>
          <span className="w-16">Score</span>
          <span className="w-24">Date</span>
          <span className="w-28 text-right">Flag</span>
        </div>
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">No check-ins match these filters.</p>
        ) : (
          filtered.map((r) => (
            <div
              key={r.id}
              className={`flex items-center gap-3 px-4 py-3 border-b last:border-0 hover:bg-gray-50 transition-colors ${r.is_flagged && r.flag_severity ? `border-l-4 ${SEVERITY_BORDER[r.flag_severity]}` : ''}`}
            >
              <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleRow(r.id)} className="rounded flex-shrink-0" />
              <a href={`/coach/clients/${r.client_id}?tab=checkins&checkin=${r.id}`} className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate flex items-center gap-2">
                  <span className="truncate">{r.client_name}</span>
                  <ClientTagBadges clientId={r.client_id} />
                </p>
                <p className="text-xs text-gray-400">{r.reviewed ? 'Reviewed' : 'New'}{r.has_feedback ? ' · replied' : ''}</p>
              </a>
              <span className="w-24 text-xs text-gray-600 flex-shrink-0">{TYPE_LABELS[r.type]}{r.type === 'weekly' ? ` ${r.step_number - 1}` : ''}</span>
              <span className="w-40 hidden sm:flex flex-shrink-0">
                {r.title === 'Intake Form' ? (
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full truncate">
                    {r.title}
                  </span>
                ) : (
                  <span className="text-xs text-gray-500 truncate">{r.title}</span>
                )}
              </span>
              <span className="w-16 text-xs font-semibold text-gray-700 flex-shrink-0">{r.overall_score ?? '—'}</span>
              <span className="w-24 text-xs text-gray-400 flex-shrink-0">{fmtDate(r.submitted_at)}</span>
              <span className="w-28 flex justify-end flex-shrink-0">
                <FlagCounts counts={r.flag_counts} />
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
