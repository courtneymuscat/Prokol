'use client'

import { useState, useEffect, useRef } from 'react'

// ── Program tab ───────────────────────────────────────────────────────────────

type PMetrics = 'weight+reps' | 'reps' | 'weight+time' | 'time' | 'calories'
const PMETRICS_LABELS: Record<PMetrics, string> = {
  'weight+reps': 'Wt + Reps', 'reps': 'Reps only', 'weight+time': 'Wt + Time',
  'time': 'Time', 'calories': 'Cals',
}
type PMetricsCfg = { col1: string; col2?: string; f1: keyof PSet; f2?: keyof PSet }
const PMETRICS_CONFIG: Record<PMetrics, PMetricsCfg> = {
  'weight+reps': { col1: 'Weight', col2: 'Reps',       f1: 'weight',   f2: 'reps'     },
  'reps':        { col1: 'Reps',                        f1: 'reps'                      },
  'weight+time': { col1: 'Weight', col2: 'Time (sec)',  f1: 'weight',   f2: 'duration' },
  'time':        { col1: 'Time (sec)',                  f1: 'duration'                  },
  'calories':    { col1: 'Calories', col2: 'Time (sec)',f1: 'calories', f2: 'duration' },
}
type PSet = { id: string; setNumber: number; weight: string; reps: string; duration: string; calories: string; rest: string }
type PLibEx = { id: string; name: string; category: string; equipment: string; muscles?: string; video_url?: string | null }
type PExercise = {
  type: 'exercise'; id: string; exercise_id: string | null
  name: string; category: string; equipment: string; video_url: string
  metrics: PMetrics; showRest: boolean; sets: PSet[]; notes: string
}
type PScoreType = 'time' | 'reps' | 'rounds' | 'weight' | 'distance' | 'calories' | 'custom'
// PSectionExercise is a lightweight reference — sections list exercises
// purely for context (e.g. "what's in this WOD"), they're not loggable
// like a top-level PExercise. We snapshot the lib id + name + category so
// the list renders consistently even if the library exercise is later renamed.
type PSectionExercise = { id: string; name: string; category?: string; equipment?: string; video_url?: string | null }
type PSection = {
  type: 'section'
  id: string
  title: string
  notes: string
  scoreType: PScoreType | 'none'
  scoreValue: string
  exercises?: PSectionExercise[]
}
type PDayItem = PExercise | PSection
type PDay = { id: string; name: string; items: PDayItem[] }
type PWeek = { id: string; label: string; days: PDay[] }

type ClientProgram = {
  id: string
  program_id: string | null
  name: string
  content: PWeek[]
  start_date: string
  status: string
  created_at: string
  updated_at: string
}

type ProgramTemplate = {
  id: string
  name: string
  description: string | null
  week_count: number
}

const PCATS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'other']

function pNewSet(num: number, prev?: PSet): PSet {
  return { id: crypto.randomUUID(), setNumber: num, weight: prev?.weight ?? '', reps: prev?.reps ?? '', duration: prev?.duration ?? '', calories: prev?.calories ?? '', rest: prev?.rest ?? '' }
}
function pNewEx(lib?: PLibEx): PExercise {
  return { type: 'exercise', id: crypto.randomUUID(), exercise_id: lib?.id ?? null, name: lib?.name ?? '', category: lib?.category ?? '', equipment: lib?.equipment ?? '', video_url: lib?.video_url ?? '', metrics: lib?.category === 'cardio' ? 'calories' : 'weight+reps', showRest: false, sets: [pNewSet(1)], notes: '' }
}
function pNewSection(): PSection { return { type: 'section', id: crypto.randomUUID(), title: '', notes: '', scoreType: 'none', scoreValue: '', exercises: [] } }
function pNewDay(n: number): PDay { return { id: crypto.randomUUID(), name: `Day ${n}`, items: [] } }
function pNewWeek(n: number): PWeek { return { id: crypto.randomUUID(), label: `Week ${n}`, days: [] } }
function pCloneWeek(src: PWeek, label: string): PWeek {
  return { id: crypto.randomUUID(), label, days: src.days.map((d) => ({ ...d, id: crypto.randomUUID(), items: d.items.map((it) => ({ ...it, id: crypto.randomUUID(), ...(it.type === 'exercise' ? { sets: it.sets.map((s) => ({ ...s, id: crypto.randomUUID() })) } : {}) })) as PDayItem[] })) }
}

// Migrate old content formats to new PWeek[] format
function migrateOldPEx(ex: Record<string, unknown>): PExercise {
  const n = Number(ex.sets) || 3
  return {
    type: 'exercise', id: (ex.id as string) || crypto.randomUUID(), exercise_id: (ex.exercise_id as string | null) || null,
    name: (ex.name as string) || '', category: (ex.category as string) || '', equipment: (ex.equipment as string) || '',
    video_url: (ex.video_url as string) || '', metrics: 'weight+reps', showRest: false,
    sets: Array.from({ length: n }, (_, i) => ({ id: crypto.randomUUID(), setNumber: i + 1, weight: String(ex.weight || ''), reps: String(ex.reps || '8-12'), duration: '', calories: '', rest: '' })),
    notes: (ex.notes as string) || '',
  }
}
function migratePDay(raw: Record<string, unknown>): PDay {
  if (Array.isArray(raw.items)) {
    const items = (raw.items as PDayItem[]).map((item) => {
      if (item.type === 'section') {
        return { ...item, scoreType: (item as PSection).scoreType ?? 'none', scoreValue: (item as PSection).scoreValue ?? '' } as PSection
      }
      return item
    })
    return { ...(raw as unknown as PDay), items }
  }
  const items: PDayItem[] = []
  if (Array.isArray(raw.sections)) {
    for (const sec of raw.sections as Record<string, unknown>[]) {
      if ((sec.title as string)?.trim()) items.push({ type: 'section', id: crypto.randomUUID(), title: sec.title as string, notes: '', scoreType: 'none', scoreValue: '' })
      for (const ex of (sec.exercises as Record<string, unknown>[]) || []) items.push(migrateOldPEx(ex))
    }
  } else {
    for (const ex of (raw.exercises as Record<string, unknown>[]) || []) items.push(migrateOldPEx(ex))
  }
  return { id: (raw.id as string) || crypto.randomUUID(), name: (raw.name as string) || 'Day', items }
}
function migratePContent(content: unknown[]): PWeek[] {
  return content.map((w) => {
    const wk = w as Record<string, unknown>
    return { id: (wk.id as string) || crypto.randomUUID(), label: (wk.label as string) || 'Week', days: ((wk.days as Record<string, unknown>[]) || []).map(migratePDay) }
  })
}

// ── Program sub-components ────────────────────────────────────────────────────

function PMoveButtons({ onUp, onDown, canUp, canDown }: { onUp: () => void; onDown: () => void; canUp: boolean; canDown: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <button onClick={onUp} disabled={!canUp} className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 disabled:opacity-20 disabled:cursor-default transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
      </button>
      <button onClick={onDown} disabled={!canDown} className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 disabled:opacity-20 disabled:cursor-default transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
      </button>
    </div>
  )
}

function PExercisePicker({ onSelect, onClose }: { onSelect: (ex: PLibEx) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PLibEx[]>([])
  const [recent, setRecent] = useState<PLibEx[]>([])
  const [category, setCategory] = useState('all')
  const [creating, setCreating] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createCategory, setCreateCategory] = useState('other')
  const [createEquipment, setCreateEquipment] = useState('bodyweight')
  const [createSaving, setCreateSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    fetch('/api/exercises/recent').then((r) => r.json()).then(setRecent).catch(() => {})
  }, [])

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      const p = new URLSearchParams({ q: query })
      if (category !== 'all') p.set('category', category)
      const res = await fetch(`/api/exercises/search?${p}`)
      setResults(await res.json())
    }, 250)
    return () => clearTimeout(t)
  }, [query, category])

  async function handleCreate() {
    if (!createName.trim()) return
    setCreateSaving(true)
    const res = await fetch('/api/exercises/custom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: createName, category: createCategory, equipment: createEquipment }) })
    setCreateSaving(false)
    if (res.ok) onSelect(await res.json())
  }

  const list = query.length >= 2 ? results : recent

  return (
    <div className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search exercise library…"
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg px-1">✕</button>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {['all', ...PCATS].map((cat) => (
          <button key={cat} onClick={() => setCategory(cat)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize transition-colors ${category === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {cat}
          </button>
        ))}
      </div>
      <div className="max-h-56 overflow-y-auto space-y-0.5">
        {query.length >= 2 && !creating && (
          <button onClick={() => { setCreateName(query); setCreating(true) }}
            className="w-full text-left px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 border-b transition-colors">
            + Create &quot;{query}&quot; as custom exercise
          </button>
        )}
        {creating && (
          <div className="p-3 space-y-2 bg-gray-50 border-b">
            <input autoFocus value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Exercise name"
              className="w-full border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <div className="flex gap-2">
              <select value={createCategory} onChange={(e) => setCreateCategory(e.target.value)} className="flex-1 border rounded-lg px-2 py-1.5 text-xs focus:outline-none">
                {PCATS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={createEquipment} onChange={(e) => setCreateEquipment(e.target.value)} className="flex-1 border rounded-lg px-2 py-1.5 text-xs focus:outline-none">
                {['bodyweight','barbell','dumbbell','machine','cable','kettlebell','bands','other'].map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={createSaving || !createName.trim()}
                className="flex-1 bg-blue-600 text-white text-xs font-semibold py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {createSaving ? 'Creating…' : 'Add exercise'}
              </button>
              <button onClick={() => setCreating(false)} className="text-xs text-gray-400 hover:text-gray-600 px-2">Cancel</button>
            </div>
          </div>
        )}
        {query.length < 2 && recent.length > 0 && <p className="text-xs text-gray-400 font-medium px-3 pb-1">Recently used</p>}
        {list.length === 0 && query.length < 2 && !creating && <p className="text-sm text-gray-400 text-center py-4">Type to search exercises</p>}
        {list.length === 0 && query.length >= 2 && !creating && <p className="text-sm text-gray-400 text-center py-4">No exercises found</p>}
        {list.map((ex) => (
          <button key={ex.id} onClick={() => onSelect(ex)} className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors">
            <p className="text-sm font-medium text-gray-900">{ex.name}</p>
            <p className="text-xs text-gray-400 capitalize">{ex.category} · {ex.equipment}{ex.muscles ? ` · ${ex.muscles}` : ''}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

const P_SCORE_TYPES: Array<PScoreType | 'none'> = ['none', 'time', 'rounds', 'reps', 'weight', 'distance', 'calories', 'custom']
const P_SCORE_LABEL: Record<PScoreType | 'none', string> = {
  none: 'No score', time: 'Time', rounds: 'Rounds+Reps', reps: 'Reps', weight: 'Weight', distance: 'Distance', calories: 'Calories', custom: 'Custom',
}

function PSectionScoreInput({ scoreType, value, onChange }: { scoreType: PScoreType | 'none'; value: string; onChange: (v: string) => void }) {
  if (scoreType === 'none') return null
  if (scoreType === 'time') {
    const [mm, ss] = value.split(':')
    return (
      <div className="flex items-center gap-1.5">
        <input type="number" min={0} placeholder="00" value={mm ?? ''} onChange={(e) => onChange(`${e.target.value}:${ss ?? '00'}`)}
          className="w-16 border rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-purple-300" />
        <span className="text-gray-400 font-medium">:</span>
        <input type="number" min={0} max={59} placeholder="00" value={ss ?? ''} onChange={(e) => onChange(`${mm ?? '0'}:${e.target.value}`)}
          className="w-16 border rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-purple-300" />
        <span className="text-xs text-gray-400">min : sec (target / cap)</span>
      </div>
    )
  }
  if (scoreType === 'rounds') {
    const [r, rp] = value.split('+')
    return (
      <div className="flex items-center gap-1.5">
        <input type="number" min={0} placeholder="0" value={r ?? ''} onChange={(e) => onChange(`${e.target.value}+${rp ?? '0'}`)}
          className="w-16 border rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-purple-300" />
        <span className="text-gray-400 font-medium">+</span>
        <input type="number" min={0} placeholder="0" value={rp ?? ''} onChange={(e) => onChange(`${r ?? '0'}+${e.target.value}`)}
          className="w-16 border rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-purple-300" />
        <span className="text-xs text-gray-400">rounds + reps (target)</span>
      </div>
    )
  }
  const units: Partial<Record<PScoreType, string>> = { reps: 'reps', weight: 'kg / lbs', distance: 'm', calories: 'cals' }
  return (
    <div className="flex items-center gap-2">
      <input type={scoreType === 'custom' ? 'text' : 'number'} min={0} value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={scoreType === 'custom' ? 'e.g. Rx, scaled, 21-15-9…' : '0'}
        className="w-36 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-purple-300" />
      {units[scoreType] && <span className="text-xs text-gray-400">{units[scoreType]} (target)</span>}
    </div>
  )
}

function PSectionBlock({ section, canUp, canDown, onChange, onRemove, onMoveUp, onMoveDown }: {
  section: PSection; canUp: boolean; canDown: boolean
  onChange: (s: PSection) => void; onRemove: () => void; onMoveUp: () => void; onMoveDown: () => void
}) {
  const [showPicker, setShowPicker] = useState(false)
  const sectionExercises = section.exercises ?? []

  function addExercise(lib: PLibEx) {
    if (sectionExercises.some((e) => e.id === lib.id)) {
      setShowPicker(false)
      return
    }
    onChange({
      ...section,
      exercises: [
        ...sectionExercises,
        { id: lib.id, name: lib.name, category: lib.category, equipment: lib.equipment, video_url: lib.video_url ?? null },
      ],
    })
    setShowPicker(false)
  }

  function removeExercise(id: string) {
    onChange({ ...section, exercises: sectionExercises.filter((e) => e.id !== id) })
  }

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <PMoveButtons onUp={onMoveUp} onDown={onMoveDown} canUp={canUp} canDown={canDown} />
        <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0">Section</span>
        <input value={section.title} onChange={(e) => onChange({ ...section, title: e.target.value })}
          placeholder="Section title (e.g. Warm Up, Metcon, WOD)"
          className="flex-1 text-sm font-semibold text-gray-900 bg-transparent outline-none border-b border-transparent focus:border-gray-300 min-w-0" />
        <button onClick={onRemove} className="text-gray-300 hover:text-red-400 text-xl leading-none flex-shrink-0">×</button>
      </div>
      <textarea value={section.notes} onChange={(e) => onChange({ ...section, notes: e.target.value })}
        placeholder="Add notes, WOD description, or instructions…"
        rows={3}
        className="w-full text-sm text-gray-700 border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-purple-300 placeholder:text-gray-300" />

      {/* Section exercise list — informational reference to the exercises
          mentioned in the section's instructions (e.g. movements in a WOD).
          Not loggable; the client viewer shows them with video links. */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">List Exercises <span className="font-normal normal-case text-gray-300">(optional)</span></p>
          {!showPicker && (
            <button
              onClick={() => setShowPicker(true)}
              className="text-xs font-semibold text-purple-600 hover:text-purple-800 transition-colors"
            >
              + Add exercise
            </button>
          )}
        </div>
        {sectionExercises.length > 0 && (
          <div className="space-y-1.5">
            {sectionExercises.map((ex) => (
              <div key={ex.id} className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{ex.name}</p>
                  {(ex.category || ex.equipment) && (
                    <p className="text-[11px] text-gray-400 capitalize">
                      {[ex.category, ex.equipment].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => removeExercise(ex.id)}
                  className="text-gray-300 hover:text-red-400 text-lg leading-none flex-shrink-0"
                  aria-label={`Remove ${ex.name}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {showPicker && (
          <PExercisePicker onSelect={addExercise} onClose={() => setShowPicker(false)} />
        )}
        {!showPicker && sectionExercises.length === 0 && (
          <p className="text-xs text-gray-300">No exercises listed yet — useful for WODs, circuits, or referencing movements named in the instructions.</p>
        )}
      </div>

      {/* Score type */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Score type</p>
        <div className="flex gap-1.5 flex-wrap">
          {P_SCORE_TYPES.map((t) => (
            <button key={t} onClick={() => onChange({ ...section, scoreType: t, scoreValue: '' })}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${section.scoreType === t ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {P_SCORE_LABEL[t]}
            </button>
          ))}
        </div>
        <PSectionScoreInput scoreType={section.scoreType} value={section.scoreValue}
          onChange={(v) => onChange({ ...section, scoreValue: v })} />
      </div>
    </div>
  )
}

function PExerciseBlock({ we, canUp, canDown, onMoveUp, onMoveDown, onChange, onRemove }: {
  we: PExercise; canUp: boolean; canDown: boolean
  onMoveUp: () => void; onMoveDown: () => void
  onChange: (u: PExercise) => void; onRemove: () => void
}) {
  const [showPicker, setShowPicker] = useState(false)
  const cfg = PMETRICS_CONFIG[we.metrics]
  const hasTwoCols = !!cfg.col2
  const gridCols = we.showRest
    ? hasTwoCols ? 'grid-cols-[24px_1fr_1fr_72px_28px]' : 'grid-cols-[24px_1fr_72px_28px]'
    : hasTwoCols ? 'grid-cols-[24px_1fr_1fr_28px]'    : 'grid-cols-[24px_1fr_28px]'

  function updateSet(setId: string, field: keyof PSet, value: string) {
    onChange({ ...we, sets: we.sets.map((s) => s.id === setId ? { ...s, [field]: value } : s) })
  }
  function addSet() {
    const prev = we.sets[we.sets.length - 1]
    onChange({ ...we, sets: [...we.sets, pNewSet(we.sets.length + 1, prev)] })
  }
  function removeSet(setId: string) {
    const sets = we.sets.filter((s) => s.id !== setId).map((s, i) => ({ ...s, setNumber: i + 1 }))
    onChange({ ...we, sets })
  }
  function handleLibSelect(lib: PLibEx) {
    onChange({ ...we, exercise_id: lib.id, name: lib.name, category: lib.category, equipment: lib.equipment, video_url: lib.video_url ?? '', metrics: lib.category === 'cardio' ? 'calories' : we.metrics })
    setShowPicker(false)
  }

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <div className="flex items-start gap-2">
        <PMoveButtons onUp={onMoveUp} onDown={onMoveDown} canUp={canUp} canDown={canDown} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">{we.name || <span className="text-gray-300 italic font-normal">Unnamed exercise</span>}</p>
          {(we.category || we.equipment) && <p className="text-xs text-gray-400 capitalize mt-0.5">{we.category}{we.equipment ? ` · ${we.equipment}` : ''}</p>}
        </div>
        <button onClick={() => setShowPicker(true)}
          className="text-xs text-blue-500 hover:text-blue-700 border border-blue-100 rounded-lg px-2 py-1 flex-shrink-0 font-medium transition-colors">
          {we.exercise_id ? 'Change' : 'Search'}
        </button>
        <button onClick={onRemove} className="text-gray-300 hover:text-red-400 text-xl leading-none flex-shrink-0">×</button>
      </div>
      {showPicker && <PExercisePicker onSelect={handleLibSelect} onClose={() => setShowPicker(false)} />}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(Object.keys(PMETRICS_LABELS) as PMetrics[]).map((m) => (
          <button key={m} onClick={() => onChange({ ...we, metrics: m })}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${we.metrics === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {PMETRICS_LABELS[m]}
          </button>
        ))}
        <button onClick={() => onChange({ ...we, showRest: !we.showRest })}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ml-auto ${we.showRest ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
          ⏱ Rest
        </button>
      </div>
      <div className={`${gridCols} gap-2 text-xs text-gray-400 font-medium px-1 grid`}>
        <span className="text-center">#</span>
        <span className="text-center">{cfg.col1}</span>
        {cfg.col2 && <span className="text-center">{cfg.col2}</span>}
        {we.showRest && <span className="text-center">Rest (s)</span>}
        <span />
      </div>
      {we.sets.map((set) => (
        <div key={set.id} className={`${gridCols} gap-2 items-center grid`}>
          <span className="text-sm text-gray-500 text-center">{set.setNumber}</span>
          <input type="text" placeholder="—" value={set[cfg.f1] as string}
            onChange={(e) => updateSet(set.id, cfg.f1, e.target.value)}
            className="border rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-300" />
          {cfg.col2 && cfg.f2 && (
            <input type="text" placeholder="—" value={set[cfg.f2] as string}
              onChange={(e) => updateSet(set.id, cfg.f2!, e.target.value)}
              className="border rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-300" />
          )}
          {we.showRest && (
            <input type="number" inputMode="numeric" placeholder="90" value={set.rest}
              onChange={(e) => updateSet(set.id, 'rest', e.target.value)}
              className="border rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-1 focus:ring-orange-300" />
          )}
          <button onClick={() => removeSet(set.id)} className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-400 text-xl">×</button>
        </div>
      ))}
      <button onClick={addSet} className="text-sm text-blue-600 hover:text-blue-700 font-medium">+ Add Set</button>
      <textarea value={we.notes} onChange={(e) => onChange({ ...we, notes: e.target.value })}
        placeholder="Coaching notes, cues, or tempo…"
        rows={we.notes ? 2 : 1}
        className="w-full text-xs text-gray-600 border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-300 placeholder:text-gray-300" />
    </div>
  )
}

function PDayEditor({ day, onChange, onClose }: { day: PDay; onChange: (d: PDay) => void; onClose: () => void }) {
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  function updateItem(i: number, item: PDayItem) {
    const items = [...day.items]; items[i] = item; onChange({ ...day, items })
  }
  function removeItem(i: number) {
    onChange({ ...day, items: day.items.filter((_, idx) => idx !== i) })
  }
  function moveItem(i: number, dir: 'up' | 'down') {
    const next = dir === 'up' ? i - 1 : i + 1
    if (next < 0 || next >= day.items.length) return
    const items = [...day.items];
    [items[i], items[next]] = [items[next], items[i]]
    onChange({ ...day, items })
  }
  function addExercise(lib: PLibEx) {
    onChange({ ...day, items: [...day.items, pNewEx(lib)] })
    setShowSearch(false); setShowAddMenu(false)
  }
  function addSection() {
    onChange({ ...day, items: [...day.items, pNewSection()] })
    setShowAddMenu(false)
  }

  return (
    <div className="border-t border-blue-100 bg-blue-50/30 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-800">{day.name}</p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">✕ Close</button>
      </div>
      <div className="space-y-3">
        {day.items.length === 0 && !showSearch && (
          <p className="text-sm text-gray-400 text-center py-4">No exercises yet. Add one below.</p>
        )}
        {day.items.map((item, i) =>
          item.type === 'exercise' ? (
            <PExerciseBlock key={item.id} we={item}
              canUp={i > 0} canDown={i < day.items.length - 1}
              onMoveUp={() => moveItem(i, 'up')} onMoveDown={() => moveItem(i, 'down')}
              onChange={(u) => updateItem(i, u)} onRemove={() => removeItem(i)} />
          ) : (
            <PSectionBlock key={item.id} section={item}
              canUp={i > 0} canDown={i < day.items.length - 1}
              onChange={(u) => updateItem(i, u)} onRemove={() => removeItem(i)}
              onMoveUp={() => moveItem(i, 'up')} onMoveDown={() => moveItem(i, 'down')} />
          )
        )}
        {showSearch && <PExercisePicker onSelect={addExercise} onClose={() => { setShowSearch(false); setShowAddMenu(false) }} />}
        {!showSearch && (
          showAddMenu ? (
            <div className="flex gap-2">
              <button onClick={() => setShowSearch(true)}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                Add Exercise
              </button>
              <button onClick={addSection}
                className="flex-1 flex items-center justify-center gap-2 border border-purple-200 text-purple-600 rounded-xl py-2.5 text-sm font-semibold hover:bg-purple-50 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
                Add Section
              </button>
              <button onClick={() => setShowAddMenu(false)}
                className="w-10 flex items-center justify-center text-gray-400 hover:text-gray-600 border border-gray-200 rounded-xl text-lg">✕</button>
            </div>
          ) : (
            <button onClick={() => setShowAddMenu(true)}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-200 rounded-xl py-3 text-sm font-semibold text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add
            </button>
          )
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') {
    return (
      <span className="text-xs bg-green-50 text-green-600 font-semibold px-2 py-0.5 rounded-full">Active</span>
    )
  }
  if (status === 'completed') {
    return (
      <span className="text-xs bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-full">Completed</span>
    )
  }
  return (
    <span className="text-xs bg-amber-50 text-amber-500 font-semibold px-2 py-0.5 rounded-full capitalize">{status}</span>
  )
}

function AssignedProgramCard({
  assignment,
  clientId,
  onUnassign,
  onUpdated,
  onSaveAsTemplate,
  savingTemplateId,
  savedTemplateId,
}: {
  assignment: ClientProgram
  clientId: string
  onUnassign: (id: string) => void
  onUpdated: (updated: ClientProgram) => void
  onSaveAsTemplate?: (id: string) => void
  savingTemplateId?: string | null
  savedTemplateId?: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [localContent, setLocalContent] = useState<PWeek[]>(() =>
    migratePContent(Array.isArray(assignment.content) ? assignment.content : [])
  )
  const [editingStartDate, setEditingStartDate] = useState(false)
  const [localStartDate, setLocalStartDate] = useState(assignment.start_date)
  // selectedDay: [weekIndex, dayIndex] | null
  const [selectedDay, setSelectedDay] = useState<[number, number] | null>(null)
  const [dragFrom, setDragFrom] = useState<[number, number] | null>(null)
  const [dragOver, setDragOver] = useState<[number, number] | null>(null)
  const [renamingDay, setRenamingDay] = useState<[number, number] | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dayEditorRef = useRef<HTMLDivElement>(null)

  // Scroll to day editor when a day is selected
  useEffect(() => {
    if (selectedDay && dayEditorRef.current) {
      dayEditorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [selectedDay])

  // Compute end date from start + weeks
  const numWeeks = localContent.length
  const startDateObj = new Date(localStartDate + 'T00:00:00')
  const endDateObj = new Date(startDateObj)
  endDateObj.setDate(startDateObj.getDate() + numWeeks * 7 - 1)
  const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  function updateContent(next: PWeek[]) { setLocalContent(next); setDirty(true); setSaveStatus('idle') }

  async function handleSave(contentOverride?: PWeek[], startDateOverride?: string) {
    if (saving) return
    setSaving(true)
    const res = await fetch(`/api/coach/clients/${clientId}/programs/${assignment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: contentOverride ?? localContent, start_date: startDateOverride ?? localStartDate }),
    })
    setSaving(false)
    if (res.ok) {
      const updated = await res.json()
      onUpdated(updated)
      setDirty(false)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } else {
      setSaveStatus('error')
    }
  }

  // Auto-save 1.5 s after last change
  useEffect(() => {
    if (!dirty) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    const snap = { content: localContent, startDate: localStartDate }
    autoSaveTimer.current = setTimeout(() => handleSave(snap.content, snap.startDate), 1500)
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, localContent, localStartDate])

  async function handleStartDateChange(newDate: string) {
    setLocalStartDate(newDate)
    setEditingStartDate(false)
    setDirty(true)
    setSaveStatus('idle')
  }

  async function handleStatusChange(status: string) {
    const res = await fetch(`/api/coach/clients/${clientId}/programs/${assignment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) onUpdated(await res.json())
  }

  async function handleUnassign() {
    if (!confirm(`Remove "${assignment.name}" from this client?`)) return
    const res = await fetch(`/api/coach/clients/${clientId}/programs/${assignment.id}`, { method: 'DELETE' })
    if (res.ok) onUnassign(assignment.id)
  }

  function addWeek() {
    const next = [...localContent, pNewWeek(localContent.length + 1)]
    updateContent(next)
  }

  function duplicateWeek(i: number) {
    const copy = pCloneWeek(localContent[i], `Week ${localContent.length + 1}`)
    const next = [...localContent.slice(0, i + 1), copy, ...localContent.slice(i + 1)]
    updateContent(next)
    if (selectedDay?.[0] === i) setSelectedDay(null)
  }

  function deleteWeek(i: number) {
    if (!confirm(`Delete ${localContent[i].label}?`)) return
    const next = localContent.filter((_, wi) => wi !== i)
    updateContent(next)
    if (selectedDay?.[0] === i) setSelectedDay(null)
  }

  function addDay(weekIdx: number) {
    const week = localContent[weekIdx]
    const next = localContent.map((w, i) => i !== weekIdx ? w : { ...w, days: [...w.days, pNewDay(w.days.length + 1)] })
    updateContent(next)
    setSelectedDay([weekIdx, week.days.length])
  }

  function updateDay(weekIdx: number, dayIdx: number, day: PDay) {
    updateContent(localContent.map((w, i) => {
      if (i !== weekIdx) return w
      const days = [...w.days]; days[dayIdx] = day; return { ...w, days }
    }))
  }

  function deleteDay(weekIdx: number, dayIdx: number) {
    if (!confirm('Remove this day?')) return
    updateContent(localContent.map((w, i) => i !== weekIdx ? w : { ...w, days: w.days.filter((_, di) => di !== dayIdx) }))
    if (selectedDay?.[0] === weekIdx && selectedDay?.[1] === dayIdx) setSelectedDay(null)
  }

  function moveDay(weekIdx: number, from: number, to: number) {
    if (from === to) return
    const week = localContent[weekIdx]
    if (!week) return
    const days = [...week.days]
    const [moved] = days.splice(from, 1)
    days.splice(to, 0, moved)
    updateContent(localContent.map((w, i) => i === weekIdx ? { ...w, days } : w))
    if (selectedDay?.[0] === weekIdx && selectedDay?.[1] === from) setSelectedDay([weekIdx, to])
  }

  const maxDays = Math.max(4, ...localContent.map((w) => w.days.length))
  const cols = Math.min(maxDays, 7)

  return (
    <div className="bg-white rounded-2xl border overflow-hidden">
      {/* Card header */}
      <div className="flex items-start justify-between p-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <button onClick={() => setExpanded((v) => !v)} className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors text-left">{assignment.name}</button>
            <StatusBadge status={assignment.status} />
          </div>
          {/* Editable start date + computed date range */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {editingStartDate ? (
              <input
                type="date"
                autoFocus
                defaultValue={localStartDate}
                onBlur={(e) => handleStartDateChange(e.target.value || localStartDate)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleStartDateChange((e.target as HTMLInputElement).value || localStartDate); if (e.key === 'Escape') setEditingStartDate(false) }}
                className="text-xs border border-blue-300 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            ) : (
              <button
                onClick={() => setEditingStartDate(true)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors group"
                title="Edit start date"
              >
                {fmtDate(startDateObj)}
                <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
                </svg>
              </button>
            )}
            {numWeeks > 0 && (
              <span className="text-xs text-gray-400">
                → {fmtDate(endDateObj)} · {numWeeks} week{numWeeks !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-3 flex-wrap justify-end">
          <select
            value={assignment.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="paused">Paused</option>
          </select>
          {saving && <span className="text-xs text-gray-400">Saving…</span>}
          {!saving && saveStatus === 'saved' && <span className="text-xs text-green-500">Saved</span>}
          {!saving && saveStatus === 'error' && <span className="text-xs text-red-500">Save failed</span>}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-gray-400 hover:text-gray-700 transition-colors"
          >
            <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {onSaveAsTemplate && (
            <button
              onClick={() => onSaveAsTemplate(assignment.id)}
              disabled={savingTemplateId === assignment.id}
              className="text-xs font-semibold text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {savedTemplateId === assignment.id ? 'Saved ✓' : savingTemplateId === assignment.id ? 'Saving…' : 'Save as Template'}
            </button>
          )}
          <button onClick={handleUnassign} className="text-gray-300 hover:text-red-400 transition-colors" title="Remove program">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded: calendar grid */}
      {expanded && (
        <div className="border-t border-gray-100">
          {/* Calendar grid header */}
          <div className="px-5 pt-4 pb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Program Calendar</p>
            <button onClick={addWeek} className="text-xs font-semibold text-blue-600 hover:text-blue-700">+ Add Week</button>
          </div>

          {localContent.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-gray-400 mb-3">No weeks yet.</p>
              <button onClick={addWeek} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700">+ Add Week 1</button>
            </div>
          ) : (
            <div className="px-5 pb-4 overflow-x-auto">
              <div style={{ minWidth: `${cols * 130 + 110}px` }}>
                {/* Column headers */}
                <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: `106px repeat(${cols}, 1fr)` }}>
                  <div />
                  {Array.from({ length: cols }, (_, i) => (
                    <div key={i} className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center py-1">Day {i + 1}</div>
                  ))}
                </div>
                {/* Week rows */}
                {localContent.map((week, wi) => (
                  <div key={week.id} className="grid gap-2 mb-3" style={{ gridTemplateColumns: `106px repeat(${cols}, 1fr)` }}>
                    {/* Week label + actions */}
                    <div className="flex flex-col items-end justify-start pr-2 pt-2 gap-1">
                      <span className="text-xs font-bold text-gray-700 truncate max-w-full">{week.label}</span>
                      <button onClick={() => addDay(wi)} className="text-[10px] text-blue-500 hover:text-blue-700 font-medium">+ Day</button>
                      <button onClick={() => duplicateWeek(wi)} className="text-[10px] text-gray-400 hover:text-gray-600">Dupe</button>
                      <button onClick={() => deleteWeek(wi)} className="text-[10px] text-gray-300 hover:text-red-400">Del</button>
                    </div>
                    {/* Day cells */}
                    {Array.from({ length: cols }, (_, di) => {
                      const day = week.days[di]
                      const exercises = (day?.items ?? []).filter((it) => it.type === 'exercise') as PExercise[]
                      const isSelected = selectedDay?.[0] === wi && selectedDay?.[1] === di
                      const isDragging = dragFrom?.[0] === wi && dragFrom?.[1] === di
                      const isDropTarget = dragOver?.[0] === wi && dragOver?.[1] === di && dragFrom?.[0] === wi && !isDragging
                      return (
                        <div key={di}
                          draggable={!!day}
                          onDragStart={day ? (e) => { e.dataTransfer.effectAllowed = 'move'; setDragFrom([wi, di]) } : undefined}
                          onDragOver={day ? (e) => { e.preventDefault(); setDragOver([wi, di]) } : (e) => e.preventDefault()}
                          onDragEnter={dragFrom?.[0] === wi ? (e) => { e.preventDefault(); setDragOver([wi, di]) } : undefined}
                          onDragEnd={() => { setDragFrom(null); setDragOver(null) }}
                          onDrop={(e) => {
                            e.preventDefault()
                            if (dragFrom && dragFrom[0] === wi) moveDay(wi, dragFrom[1], di)
                            setDragFrom(null); setDragOver(null)
                          }}
                          onClick={() => day && !dragFrom && setSelectedDay(isSelected ? null : [wi, di])}
                          className={`min-h-[80px] rounded-xl border p-2 transition-all ${
                            isDragging
                              ? 'opacity-40 border-blue-300 bg-blue-50 cursor-grabbing'
                              : isDropTarget
                                ? 'border-blue-500 bg-blue-50 shadow-md scale-[1.02]'
                                : day
                                  ? isSelected
                                    ? 'bg-blue-50 border-blue-400 shadow-sm cursor-pointer'
                                    : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm cursor-grab'
                                  : dragFrom?.[0] === wi
                                    ? 'bg-blue-50/30 border-dashed border-blue-200'
                                    : 'bg-gray-50/40 border-dashed border-gray-100'
                          }`}>
                          {day ? (
                            <>
                              <div className="flex items-start justify-between gap-1 mb-1">
                                {renamingDay?.[0] === wi && renamingDay?.[1] === di ? (
                                  <input
                                    autoFocus
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    onBlur={(e) => {
                                      e.stopPropagation()
                                      const name = renameValue.trim() || day.name
                                      updateDay(wi, di, { ...day, name })
                                      setRenamingDay(null)
                                    }}
                                    onKeyDown={(e) => {
                                      e.stopPropagation()
                                      if (e.key === 'Enter' || e.key === 'Escape') {
                                        const name = renameValue.trim() || day.name
                                        updateDay(wi, di, { ...day, name })
                                        setRenamingDay(null)
                                      }
                                    }}
                                    className="text-[10px] font-bold text-blue-700 flex-1 bg-transparent border-b border-blue-400 outline-none min-w-0 w-full"
                                  />
                                ) : (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setRenameValue(day.name); setRenamingDay([wi, di]) }}
                                    className="text-[10px] font-bold text-blue-700 truncate flex-1 text-left hover:text-blue-500 transition-colors"
                                    title="Click to rename"
                                  >
                                    {day.name || 'Day'}
                                  </button>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); deleteDay(wi, di) }}
                                  className="text-gray-200 hover:text-red-400 text-xs leading-none flex-shrink-0">×</button>
                              </div>
                              <div className="space-y-0.5">
                                {exercises.slice(0, 4).map((ex, i) => (
                                  <p key={i} className="text-[10px] text-gray-500 truncate">{ex.name || <span className="text-gray-300 italic">Unnamed</span>}</p>
                                ))}
                                {exercises.length > 4 && <p className="text-[10px] text-gray-300">+{exercises.length - 4} more</p>}
                                {exercises.length === 0 && <p className="text-[10px] text-gray-300 italic">Empty</p>}
                              </div>
                            </>
                          ) : (
                            <p className="text-[10px] text-gray-200 text-center mt-5">—</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Day editor panel */}
          {selectedDay && (() => {
            const [wi, di] = selectedDay
            const day = localContent[wi]?.days[di]
            if (!day) return null
            return (
              <div ref={dayEditorRef}>
                <PDayEditor
                  day={day}
                  onChange={(d) => updateDay(wi, di, d)}
                  onClose={() => setSelectedDay(null)}
                />
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

function AssignProgramModal({
  clientId,
  onClose,
  onAssigned,
}: {
  clientId: string
  onClose: () => void
  onAssigned: (assignment: ClientProgram) => void
}) {
  const [templates, setTemplates] = useState<ProgramTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [assigning, setAssigning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/coach/programs')
      .then((r) => r.json())
      .then((d) => setTemplates(Array.isArray(d) ? d : []))
      .finally(() => setLoadingTemplates(false))
  }, [])

  async function handleAssign() {
    if (!selectedId) return
    setAssigning(true)
    setError(null)
    const res = await fetch(`/api/coach/clients/${clientId}/programs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ program_id: selectedId, start_date: startDate }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to assign program')
      setAssigning(false)
      return
    }
    onAssigned(data)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900">Assign Program</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loadingTemplates ? (
          <p className="text-sm text-gray-400 text-center py-8">Loading programs…</p>
        ) : templates.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 mb-3">No programs yet.</p>
            <a
              href="/coach/programs"
              className="text-sm font-semibold text-blue-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Create a program first →
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full text-left rounded-xl border p-3.5 transition-colors ${
                    selectedId === t.id
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                  {t.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{t.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {t.week_count} week{t.week_count !== 1 ? 's' : ''}
                  </p>
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Start date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                className="flex-1 border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={!selectedId || assigning}
                className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {assigning ? 'Assigning…' : 'Assign Program'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ProgramTab({ clientId }: { clientId: string }) {
  const [assignments, setAssignments] = useState<ClientProgram[]>([])
  const [loading, setLoading] = useState(true)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [savingProgTemplateId, setSavingProgTemplateId] = useState<string | null>(null)
  const [savedProgTemplateId, setSavedProgTemplateId] = useState<string | null>(null)

  async function loadPrograms() {
    const d = await fetch(`/api/coach/clients/${clientId}/programs`).then((r) => r.json())
    const list: ClientProgram[] = Array.isArray(d) ? d : []

    // Sort by start_date descending (most recent first)
    list.sort((a, b) => b.start_date.localeCompare(a.start_date))

    // Auto-complete expired programs
    const today = new Date().toISOString().slice(0, 10)
    const toComplete = list.filter((a) => {
      if (a.status !== 'active') return false
      const numWeeks = Array.isArray(a.content) ? a.content.length : 0
      if (numWeeks === 0) return false
      const end = new Date(a.start_date + 'T00:00:00')
      end.setDate(end.getDate() + numWeeks * 7 - 1)
      return end.toISOString().slice(0, 10) < today
    })
    await Promise.all(
      toComplete.map((a) =>
        fetch(`/api/coach/clients/${clientId}/programs/${a.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'completed' }),
        }).then((r) => r.ok ? r.json() : null)
          .then((updated) => { if (updated) { const idx = list.findIndex((x) => x.id === updated.id); if (idx >= 0) list[idx] = updated } })
      )
    )
    setAssignments([...list])
  }

  useEffect(() => {
    loadPrograms().finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  function handleAssigned(assignment: ClientProgram) {
    setAssignments((prev) => [...prev, assignment].sort((a, b) => b.start_date.localeCompare(a.start_date)))
  }

  function handleUnassign(id: string) {
    setAssignments((prev) => prev.filter((a) => a.id !== id))
  }

  function handleUpdated(updated: ClientProgram) {
    setAssignments((prev) =>
      prev.map((a) => (a.id === updated.id ? updated : a))
          .sort((a, b) => b.start_date.localeCompare(a.start_date))
    )
  }

  async function handleCreateProgram() {
    const name = prompt('Program name:')
    if (!name?.trim()) return
    const blankContent = [pNewWeek(1)]
    const res = await fetch(`/api/coach/clients/${clientId}/programs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        program_id: null,
        name: name.trim(),
        content: blankContent,
        start_date: new Date().toISOString().split('T')[0],
      }),
    })
    if (res.ok) {
      await loadPrograms()
    }
  }

  async function handleSaveProgAsTemplate(assignmentId: string) {
    setSavingProgTemplateId(assignmentId)
    await fetch(`/api/coach/clients/${clientId}/programs/${assignmentId}/save-as-template`, { method: 'POST' })
    setSavingProgTemplateId(null)
    setSavedProgTemplateId(assignmentId)
    setTimeout(() => setSavedProgTemplateId(null), 3000)
  }

  if (loading) {
    return <p className="text-sm text-gray-400 text-center py-10">Loading programs…</p>
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          {assignments.length === 0 ? 'No programs assigned' : `${assignments.length} program${assignments.length !== 1 ? 's' : ''}`}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCreateProgram}
            className="text-xs font-semibold text-white bg-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Create New
          </button>
          <button
            onClick={() => setShowAssignModal(true)}
            className="text-xs font-semibold text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Assign Program
          </button>
        </div>
      </div>

      {assignments.length === 0 && (
        <div className="text-center py-14 bg-white rounded-2xl border">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 mb-1">No programs assigned yet</p>
          <p className="text-xs text-gray-400 mb-4">Assign a training program template to this client.</p>
          <button
            onClick={() => setShowAssignModal(true)}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            + Assign Program
          </button>
        </div>
      )}

      {assignments.map((a) => (
        <AssignedProgramCard
          key={a.id}
          assignment={a}
          clientId={clientId}
          onUnassign={handleUnassign}
          onUpdated={handleUpdated}
          onSaveAsTemplate={handleSaveProgAsTemplate}
          savingTemplateId={savingProgTemplateId}
          savedTemplateId={savedProgTemplateId}
        />
      ))}

      {showAssignModal && (
        <AssignProgramModal
          clientId={clientId}
          onClose={() => setShowAssignModal(false)}
          onAssigned={handleAssigned}
        />
      )}
    </div>
  )
}
