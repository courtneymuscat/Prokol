'use client'

import { useState, useEffect, useRef } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

type Metrics = 'weight+reps' | 'reps' | 'weight+time' | 'time' | 'calories'

const METRICS_LABELS: Record<Metrics, string> = {
  'weight+reps': 'Wt + Reps',
  'reps':        'Reps only',
  'weight+time': 'Wt + Time',
  'time':        'Time',
  'calories':    'Cals',
}

type MetricsCfg = { col1: string; col2?: string; f1: keyof ProgramSet; f2?: keyof ProgramSet }
const METRICS_CONFIG: Record<Metrics, MetricsCfg> = {
  'weight+reps': { col1: 'Weight', col2: 'Reps',       f1: 'weight',   f2: 'reps'     },
  'reps':        { col1: 'Reps',                        f1: 'reps'                      },
  'weight+time': { col1: 'Weight', col2: 'Time (sec)',  f1: 'weight',   f2: 'duration' },
  'time':        { col1: 'Time (sec)',                  f1: 'duration'                  },
  'calories':    { col1: 'Calories', col2: 'Time (sec)',f1: 'calories', f2: 'duration' },
}

type ProgramSet = {
  id: string
  setNumber: number
  weight: string
  reps: string
  duration: string
  calories: string
  rest: string
}

type LibraryExercise = {
  id: string
  name: string
  category: string
  equipment: string
  muscles?: string
  video_url?: string | null
}

type ProgramExercise = {
  type: 'exercise'
  id: string
  exercise_id: string | null
  name: string
  category: string
  equipment: string
  video_url: string
  metrics: Metrics
  showRest: boolean
  sets: ProgramSet[]
  notes: string
}

type ProgramSection = {
  type: 'section'
  id: string
  title: string
  notes: string
}

type DayItem = ProgramExercise | ProgramSection

type Day = {
  id: string
  name: string
  items: DayItem[]
}

type Week = {
  id: string
  label: string
  days: Day[]
}

type Program = {
  id: string
  name: string
  description: string | null
  content: Week[]
  created_at: string
  updated_at: string
}

// ── Migration ──────────────────────────────────────────────────────────────────

function migrateOldEx(ex: Record<string, unknown>): ProgramExercise {
  const numSets = Number(ex.sets) || 3
  return {
    type: 'exercise',
    id: (ex.id as string) || crypto.randomUUID(),
    exercise_id: (ex.exercise_id as string | null) || null,
    name: (ex.name as string) || '',
    category: (ex.category as string) || '',
    equipment: (ex.equipment as string) || '',
    video_url: (ex.video_url as string) || '',
    metrics: 'weight+reps',
    showRest: false,
    sets: Array.from({ length: numSets }, (_, i) => ({
      id: crypto.randomUUID(),
      setNumber: i + 1,
      weight: String(ex.weight || ''),
      reps: String(ex.reps || '8-12'),
      duration: '',
      calories: '',
      rest: '',
    })),
    notes: (ex.notes as string) || '',
  }
}

function migrateDay(raw: Record<string, unknown>): Day {
  if (Array.isArray(raw.items)) return raw as unknown as Day
  const items: DayItem[] = []
  if (Array.isArray(raw.sections)) {
    for (const sec of raw.sections as Record<string, unknown>[]) {
      if ((sec.title as string)?.trim()) {
        items.push({ type: 'section', id: crypto.randomUUID(), title: sec.title as string, notes: '' })
      }
      for (const ex of (sec.exercises as Record<string, unknown>[]) || []) {
        items.push(migrateOldEx(ex))
      }
    }
  } else {
    for (const ex of (raw.exercises as Record<string, unknown>[]) || []) {
      items.push(migrateOldEx(ex))
    }
  }
  return { id: (raw.id as string) || crypto.randomUUID(), name: (raw.name as string) || 'Day', items }
}

function migrateContent(content: unknown[]): Week[] {
  return content.map((w) => {
    const week = w as Record<string, unknown>
    return {
      id: (week.id as string) || crypto.randomUUID(),
      label: (week.label as string) || 'Week',
      days: ((week.days as Record<string, unknown>[]) || []).map(migrateDay),
    }
  })
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const CATEGORIES = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'other']

function newSet(num: number, prev?: ProgramSet): ProgramSet {
  return { id: crypto.randomUUID(), setNumber: num, weight: prev?.weight ?? '', reps: prev?.reps ?? '', duration: prev?.duration ?? '', calories: prev?.calories ?? '', rest: prev?.rest ?? '' }
}

function newExerciseItem(lib?: LibraryExercise): ProgramExercise {
  return {
    type: 'exercise', id: crypto.randomUUID(),
    exercise_id: lib?.id ?? null, name: lib?.name ?? '', category: lib?.category ?? '',
    equipment: lib?.equipment ?? '', video_url: lib?.video_url ?? '',
    metrics: lib?.category === 'cardio' ? 'calories' : 'weight+reps',
    showRest: false, sets: [newSet(1)], notes: '',
  }
}

function newSectionItem(): ProgramSection {
  return { type: 'section', id: crypto.randomUUID(), title: '', notes: '' }
}

function newDay(): Day {
  return { id: crypto.randomUUID(), name: 'Day', items: [] }
}

function newWeek(index: number): Week {
  return { id: crypto.randomUUID(), label: `Week ${index}`, days: [] }
}

function cloneWeek(source: Week, newLabel: string): Week {
  return {
    id: crypto.randomUUID(), label: newLabel,
    days: source.days.map((d) => ({
      ...d, id: crypto.randomUUID(),
      items: d.items.map((item) => ({
        ...item, id: crypto.randomUUID(),
        ...(item.type === 'exercise' ? { sets: item.sets.map((s) => ({ ...s, id: crypto.randomUUID() })) } : {}),
      })) as DayItem[],
    })),
  }
}

// ── Move buttons ──────────────────────────────────────────────────────────────

function MoveButtons({ onUp, onDown, canUp, canDown }: { onUp: () => void; onDown: () => void; canUp: boolean; canDown: boolean }) {
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

// ── Exercise Picker ────────────────────────────────────────────────────────────

function ExercisePicker({ onSelect, onClose }: { onSelect: (ex: LibraryExercise) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LibraryExercise[]>([])
  const [recent, setRecent] = useState<LibraryExercise[]>([])
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
    const res = await fetch('/api/exercises/custom', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: createName, category: createCategory, equipment: createEquipment }),
    })
    setCreateSaving(false)
    if (res.ok) onSelect(await res.json())
  }

  const list = query.length >= 2 ? results : recent

  return (
    <div className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercise library…"
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg px-1">✕</button>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {['all', ...CATEGORIES].map((cat) => (
          <button key={cat} onClick={() => setCategory(cat)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize transition-colors ${category === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {cat}
          </button>
        ))}
      </div>
      <div className="max-h-64 overflow-y-auto space-y-0.5">
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
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
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

// ── Section block ─────────────────────────────────────────────────────────────

function SectionBlock({ section, canUp, canDown, onChange, onRemove, onMoveUp, onMoveDown }: {
  section: ProgramSection; canUp: boolean; canDown: boolean
  onChange: (s: ProgramSection) => void; onRemove: () => void; onMoveUp: () => void; onMoveDown: () => void
}) {
  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MoveButtons onUp={onMoveUp} onDown={onMoveDown} canUp={canUp} canDown={canDown} />
        <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0">Section</span>
        <input value={section.title} onChange={(e) => onChange({ ...section, title: e.target.value })}
          placeholder="Section title (e.g. Warm Up, Metcon, Notes)"
          className="flex-1 text-sm font-semibold text-gray-900 bg-transparent outline-none border-b border-transparent focus:border-gray-300 min-w-0" />
        <button onClick={onRemove} className="text-gray-300 hover:text-red-400 text-xl leading-none flex-shrink-0">×</button>
      </div>
      <textarea value={section.notes} onChange={(e) => onChange({ ...section, notes: e.target.value })}
        placeholder="Add notes, instructions, or reminders..."
        rows={3}
        className="w-full text-sm text-gray-700 border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-purple-300 placeholder:text-gray-300" />
    </div>
  )
}

// ── Exercise block ────────────────────────────────────────────────────────────

function ExerciseBlock({ we, canUp, canDown, onMoveUp, onMoveDown, onChange, onRemove }: {
  we: ProgramExercise; canUp: boolean; canDown: boolean
  onMoveUp: () => void; onMoveDown: () => void
  onChange: (u: ProgramExercise) => void; onRemove: () => void
}) {
  const [showPicker, setShowPicker] = useState(false)
  const cfg = METRICS_CONFIG[we.metrics]
  const hasTwoCols = !!cfg.col2
  const gridCols = we.showRest
    ? hasTwoCols ? 'grid-cols-[24px_1fr_1fr_72px_28px]' : 'grid-cols-[24px_1fr_72px_28px]'
    : hasTwoCols ? 'grid-cols-[24px_1fr_1fr_28px]'    : 'grid-cols-[24px_1fr_28px]'

  function updateSet(setId: string, field: keyof ProgramSet, value: string) {
    onChange({ ...we, sets: we.sets.map((s) => s.id === setId ? { ...s, [field]: value } : s) })
  }

  function addSet() {
    const prev = we.sets[we.sets.length - 1]
    onChange({ ...we, sets: [...we.sets, newSet(we.sets.length + 1, prev)] })
  }

  function removeSet(setId: string) {
    const sets = we.sets.filter((s) => s.id !== setId).map((s, i) => ({ ...s, setNumber: i + 1 }))
    onChange({ ...we, sets })
  }

  function handleLibrarySelect(lib: LibraryExercise) {
    onChange({ ...we, exercise_id: lib.id, name: lib.name, category: lib.category, equipment: lib.equipment, video_url: lib.video_url ?? '', metrics: lib.category === 'cardio' ? 'calories' : we.metrics })
    setShowPicker(false)
  }

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start gap-2">
        <MoveButtons onUp={onMoveUp} onDown={onMoveDown} canUp={canUp} canDown={canDown} />
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

      {showPicker && <ExercisePicker onSelect={handleLibrarySelect} onClose={() => setShowPicker(false)} />}

      {/* Metrics selector */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(Object.keys(METRICS_LABELS) as Metrics[]).map((m) => (
          <button key={m} onClick={() => onChange({ ...we, metrics: m })}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${we.metrics === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {METRICS_LABELS[m]}
          </button>
        ))}
        <button onClick={() => onChange({ ...we, showRest: !we.showRest })}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ml-auto ${we.showRest ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
          ⏱ Rest
        </button>
      </div>

      {/* Column headers */}
      <div className={`${gridCols} gap-2 text-xs text-gray-400 font-medium px-1 grid`}>
        <span className="text-center">#</span>
        <span className="text-center">{cfg.col1}</span>
        {cfg.col2 && <span className="text-center">{cfg.col2}</span>}
        {we.showRest && <span className="text-center">Rest (s)</span>}
        <span />
      </div>

      {/* Set rows */}
      {we.sets.map((set) => (
        <div key={set.id} className={`${gridCols} gap-2 items-center grid`}>
          <span className="text-sm text-gray-500 text-center">{set.setNumber}</span>
          <input type="text" placeholder="—"
            value={set[cfg.f1] as string}
            onChange={(e) => updateSet(set.id, cfg.f1, e.target.value)}
            className="border rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-300" />
          {cfg.col2 && cfg.f2 && (
            <input type="text" placeholder="—"
              value={set[cfg.f2] as string}
              onChange={(e) => updateSet(set.id, cfg.f2!, e.target.value)}
              className="border rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-300" />
          )}
          {we.showRest && (
            <input type="number" inputMode="numeric" placeholder="90"
              value={set.rest}
              onChange={(e) => updateSet(set.id, 'rest', e.target.value)}
              className="border rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-1 focus:ring-orange-300" />
          )}
          <button onClick={() => removeSet(set.id)} className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-400 text-xl">×</button>
        </div>
      ))}

      <button onClick={addSet} className="text-sm text-blue-600 hover:text-blue-700 font-medium">+ Add Set</button>

      {/* Coaching notes */}
      <textarea value={we.notes} onChange={(e) => onChange({ ...we, notes: e.target.value })}
        placeholder="Coaching notes, cues, or tempo…"
        rows={we.notes ? 2 : 1}
        className="w-full text-xs text-gray-600 border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-300 placeholder:text-gray-300" />
    </div>
  )
}

// ── Day block ─────────────────────────────────────────────────────────────────

function DayBlock({ day, dayIndex, isDragging, isDragOver, onChange, onDelete, onDragStart, onDragEnd, onDragOverEl, onDrop }: {
  day: Day; dayIndex: number; isDragging: boolean; isDragOver: boolean
  onChange: (d: Day) => void; onDelete: () => void
  onDragStart: () => void; onDragEnd: () => void
  onDragOverEl: (e: React.DragEvent) => void; onDrop: () => void
}) {
  const [editingName, setEditingName] = useState(false)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  function updateItem(i: number, item: DayItem) {
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

  function addExercise(lib: LibraryExercise) {
    onChange({ ...day, items: [...day.items, newExerciseItem(lib)] })
    setShowSearch(false); setShowAddMenu(false)
  }

  function addSection() {
    onChange({ ...day, items: [...day.items, newSectionItem()] })
    setShowAddMenu(false)
  }

  const exCount = day.items.filter((i) => i.type === 'exercise').length

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOverEl}
      onDrop={(e) => { e.preventDefault(); onDrop() }}
      className={`rounded-2xl border-2 transition-all ${
        isDragging ? 'opacity-40 border-blue-300 bg-blue-50'
        : isDragOver ? 'border-blue-400 shadow-lg scale-[1.01]'
        : 'border-gray-100 bg-white'
      }`}
    >
      {/* Day header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
        </div>
        {editingName ? (
          <input autoFocus type="text" value={day.name}
            onChange={(e) => onChange({ ...day, name: e.target.value })}
            onBlur={() => setEditingName(false)}
            onKeyDown={(e) => { if (e.key === 'Enter') setEditingName(false) }}
            className="flex-1 text-sm font-semibold text-gray-900 border border-blue-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        ) : (
          <button onClick={() => setEditingName(true)}
            className="flex-1 text-sm font-semibold text-gray-900 hover:text-blue-600 text-left flex items-center gap-1.5 group">
            {day.name || `Day ${dayIndex + 1}`}
            <svg className="w-3 h-3 text-gray-300 group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}
        <span className="text-xs text-gray-400 flex-shrink-0">{exCount} exercise{exCount !== 1 ? 's' : ''}</span>
        <button onClick={onDelete} className="text-gray-300 hover:text-red-400 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>

      {/* Items */}
      <div className="p-4 space-y-3">
        {day.items.length === 0 && !showSearch && (
          <p className="text-sm text-gray-400 text-center py-4">No exercises yet.</p>
        )}

        {day.items.map((item, i) =>
          item.type === 'exercise' ? (
            <ExerciseBlock key={item.id} we={item}
              canUp={i > 0} canDown={i < day.items.length - 1}
              onMoveUp={() => moveItem(i, 'up')} onMoveDown={() => moveItem(i, 'down')}
              onChange={(u) => updateItem(i, u)} onRemove={() => removeItem(i)} />
          ) : (
            <SectionBlock key={item.id} section={item}
              canUp={i > 0} canDown={i < day.items.length - 1}
              onChange={(u) => updateItem(i, u)} onRemove={() => removeItem(i)}
              onMoveUp={() => moveItem(i, 'up')} onMoveDown={() => moveItem(i, 'down')} />
          )
        )}

        {showSearch && (
          <ExercisePicker onSelect={addExercise} onClose={() => { setShowSearch(false); setShowAddMenu(false) }} />
        )}

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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProgramBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const [programId, setProgramId] = useState<string | null>(null)
  const [program, setProgram] = useState<Program | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [dirty, setDirty] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [editingDesc, setEditingDesc] = useState(false)
  // selectedDay: [weekIndex, dayIndex] | null — drives the inline day editor
  const [selectedDay, setSelectedDay] = useState<[number, number] | null>(null)
  // drag-and-drop day reordering within a week
  const [dragFrom, setDragFrom] = useState<[number, number] | null>(null)
  const [dragOver, setDragOver] = useState<[number, number] | null>(null)
  // inline day rename
  const [renamingDay, setRenamingDay] = useState<[number, number] | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const dayEditorRef = useRef<HTMLDivElement>(null)

  useEffect(() => { params.then(({ id }) => setProgramId(id)) }, [params])

  // Scroll to day editor when a day is selected
  useEffect(() => {
    if (selectedDay && dayEditorRef.current) {
      dayEditorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [selectedDay])

  // Warn before leaving with unsaved changes
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirty) return
      e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  useEffect(() => {
    if (!programId) return
    fetch(`/api/coach/programs/${programId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) return
        setProgram({ ...d, content: migrateContent(Array.isArray(d.content) ? d.content : []) })
      })
      .finally(() => setLoading(false))
  }, [programId])

  function updateProgram(updated: Program) { setProgram(updated); setDirty(true); setSaveStatus('idle') }
  function updateContent(content: Week[]) { if (!program) return; updateProgram({ ...program, content }) }

  async function saveNow() {
    if (!program) return
    setSaving(true); setSaveStatus('saving')
    const res = await fetch(`/api/coach/programs/${program.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: program.name, description: program.description, content: program.content }),
    })
    setSaving(false)
    if (res.ok) { setDirty(false); setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2000) }
    else { setSaveStatus('error') }
  }

  function addWeek() {
    if (!program) return
    updateContent([...program.content, newWeek(program.content.length + 1)])
  }

  function duplicateWeek(i: number) {
    if (!program) return
    const copy = cloneWeek(program.content[i], `Week ${program.content.length + 1}`)
    updateContent([...program.content.slice(0, i + 1), copy, ...program.content.slice(i + 1)])
    if (selectedDay?.[0] === i) setSelectedDay(null)
  }

  function deleteWeek(i: number) {
    if (!program || !confirm(`Delete ${program.content[i].label}?`)) return
    updateContent(program.content.filter((_, wi) => wi !== i))
    if (selectedDay?.[0] === i) setSelectedDay(null)
  }

  function addDay(weekIdx: number) {
    if (!program) return
    const week = program.content[weekIdx]
    updateContent(program.content.map((w, i) => i !== weekIdx ? w : { ...w, days: [...w.days, newDay()] }))
    setSelectedDay([weekIdx, week.days.length])
  }

  function updateDay(weekIdx: number, dayIdx: number, day: Day) {
    if (!program) return
    updateContent(program.content.map((w, i) => {
      if (i !== weekIdx) return w
      const days = [...w.days]; days[dayIdx] = day; return { ...w, days }
    }))
  }

  function deleteDay(weekIdx: number, dayIdx: number) {
    if (!program) return
    updateContent(program.content.map((w, i) => i !== weekIdx ? w : { ...w, days: w.days.filter((_, di) => di !== dayIdx) }))
    if (selectedDay?.[0] === weekIdx && selectedDay?.[1] === dayIdx) setSelectedDay(null)
  }

  function moveDay(weekIdx: number, from: number, to: number) {
    if (!program || from === to) return
    const week = program.content[weekIdx]
    if (!week) return
    const days = [...week.days]
    const [moved] = days.splice(from, 1)
    days.splice(to, 0, moved)
    updateContent(program.content.map((w, i) => i === weekIdx ? { ...w, days } : w))
    // keep selectedDay tracking the moved day
    if (selectedDay?.[0] === weekIdx && selectedDay?.[1] === from) setSelectedDay([weekIdx, to])
  }

  if (loading) return <div className="flex-1 flex items-center justify-center"><p className="text-sm text-gray-400">Loading…</p></div>
  if (!program) return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <p className="text-sm text-red-500 mb-4">Program not found or you don&apos;t have access.</p>
      <a href="/coach/programs" className="text-sm text-blue-600 hover:underline">← Back to Programs</a>
    </div>
  )

  const maxDays = Math.max(4, ...program.content.map((w) => w.days.length))
  const cols = Math.min(maxDays, 7)

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <a href="/coach/programs" className="text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </a>
        <div className="flex-1 min-w-0">
          {editingName ? (
            <input autoFocus type="text" value={program.name}
              onChange={(e) => setProgram({ ...program, name: e.target.value })}
              onBlur={() => { setEditingName(false); setDirty(true) }}
              onKeyDown={(e) => { if (e.key === 'Enter') { setEditingName(false); setDirty(true) } }}
              className="text-lg font-bold text-gray-900 border border-blue-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full max-w-xs" />
          ) : (
            <button onClick={() => setEditingName(true)} className="text-lg font-bold text-gray-900 hover:text-blue-600 text-left flex items-center gap-1.5 group">
              {program.name}
              <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {saveStatus === 'saving' && <span className="text-xs text-gray-400">Saving…</span>}
          {saveStatus === 'saved' && <span className="text-xs text-green-500">Saved</span>}
          {saveStatus === 'error' && <span className="text-xs text-red-500">Save failed</span>}
          {dirty && saveStatus === 'idle' && <span className="text-xs text-amber-500">Unsaved changes</span>}
          <button onClick={saveNow} disabled={saving}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${dirty ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          {/* Description */}
          <div className="bg-white rounded-2xl border p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Description</p>
            {editingDesc ? (
              <textarea autoFocus value={program.description ?? ''}
                onChange={(e) => setProgram({ ...program, description: e.target.value })}
                onBlur={() => { setEditingDesc(false); setDirty(true) }}
                rows={3} placeholder="Describe this program…"
                className="w-full text-sm text-gray-700 border border-blue-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            ) : (
              <button onClick={() => setEditingDesc(true)} className="text-sm text-left w-full flex items-start gap-2 group">
                <span className={program.description ? 'text-gray-700' : 'text-gray-300 italic'}>{program.description || 'Click to add a description…'}</span>
                <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </button>
            )}
          </div>

          {/* Calendar grid */}
          <div className="bg-white rounded-2xl border overflow-hidden">
            <div className="px-5 pt-4 pb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Program Calendar</p>
              <button onClick={addWeek} className="text-xs font-semibold text-blue-600 hover:text-blue-700">+ Add Week</button>
            </div>

            {program.content.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-sm text-gray-400 mb-3">No weeks yet.</p>
                <button onClick={addWeek} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700">+ Add Week 1</button>
              </div>
            ) : (
              <div className="px-5 pb-4 overflow-x-auto">
                <div style={{ minWidth: `${cols * 140 + 120}px` }}>
                  {/* Column headers */}
                  <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: `116px repeat(${cols}, 1fr)` }}>
                    <div />
                    {Array.from({ length: cols }, (_, i) => (
                      <div key={i} className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center py-1">Day {i + 1}</div>
                    ))}
                  </div>
                  {/* Week rows */}
                  {program.content.map((week, wi) => (
                    <div key={week.id} className="grid gap-2 mb-3" style={{ gridTemplateColumns: `116px repeat(${cols}, 1fr)` }}>
                      {/* Week label + actions */}
                      <div className="flex flex-col items-end justify-start pr-2 pt-2 gap-1">
                        <span className="text-xs font-bold text-gray-700 truncate max-w-full">{week.label}</span>
                        <button onClick={() => addDay(wi)} className="text-[10px] text-blue-500 hover:text-blue-700 font-medium">+ Day</button>
                        <button onClick={() => duplicateWeek(wi)} className="text-[10px] text-gray-400 hover:text-gray-600">Duplicate</button>
                        <button onClick={() => deleteWeek(wi)} className="text-[10px] text-gray-300 hover:text-red-400">Delete</button>
                      </div>
                      {/* Day cells */}
                      {Array.from({ length: cols }, (_, di) => {
                        const day = week.days[di]
                        const exercises = (day?.items ?? []).filter((it) => it.type === 'exercise') as ProgramExercise[]
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
                            className={`min-h-[90px] rounded-xl border p-2 transition-all ${
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
                                <div className="flex items-start justify-between gap-1 mb-1.5">
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
                                  {exercises.slice(0, 5).map((ex, i) => (
                                    <p key={i} className="text-[10px] text-gray-500 truncate">{ex.name || <span className="text-gray-300 italic">Unnamed</span>}</p>
                                  ))}
                                  {exercises.length > 5 && <p className="text-[10px] text-gray-300">+{exercises.length - 5} more</p>}
                                  {exercises.length === 0 && <p className="text-[10px] text-gray-300 italic">Empty</p>}
                                </div>
                              </>
                            ) : (
                              <p className="text-[10px] text-gray-200 text-center mt-8">—</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inline day editor */}
            {selectedDay && (() => {
              const [wi, di] = selectedDay
              const day = program.content[wi]?.days[di]
              if (!day) return null
              return (
                <div ref={dayEditorRef} className="border-t border-blue-100 bg-blue-50/30">
                  <div className="max-w-2xl mx-auto p-5">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-bold text-gray-800">
                        {program.content[wi].label} — {day.name}
                      </p>
                      <button onClick={() => setSelectedDay(null)} className="text-gray-400 hover:text-gray-600 text-sm">✕ Close</button>
                    </div>
                    <DayBlock
                      day={day} dayIndex={di}
                      isDragging={false} isDragOver={false}
                      onChange={(d) => updateDay(wi, di, d)}
                      onDelete={() => { deleteDay(wi, di); setSelectedDay(null) }}
                      onDragStart={() => {}} onDragEnd={() => {}}
                      onDragOverEl={() => {}} onDrop={() => {}}
                    />
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}
