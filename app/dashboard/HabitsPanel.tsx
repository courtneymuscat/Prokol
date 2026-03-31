'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

type Habit = {
  id: string
  name: string
  type: string
  target: number
  unit: string
  icon: string
  active: boolean
}

type HabitLog = {
  habit_id: string
  log_date: string
  value: number
  completed: boolean
  habit_name: string
  habit_unit: string
  habit_target: number
  habit_icon: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function formatTarget(target: number, unit: string): string {
  if (unit === 'steps') return `${target.toLocaleString()} steps`
  if (unit === 'glasses') return `${target} glasses`
  if (unit === 'hours') return `${target} hrs`
  if (unit === 'times') return target === 1 ? 'Once' : `${target}x`
  return `${target} ${unit}`
}

function isBinary(habit: Habit): boolean {
  return habit.unit === 'times' && habit.target === 1
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value, target, completed }: { value: number; target: number; completed: boolean }) {
  const pct = Math.min(100, target > 0 ? Math.round((value / target) * 100) : 0)
  return (
    <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden mt-1.5">
      <div
        className={`h-full rounded-full transition-all duration-500 ${completed ? 'bg-green-500' : 'bg-blue-400'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ─── Habit Row ────────────────────────────────────────────────────────────────

interface HabitRowProps {
  habit: Habit
  log: HabitLog | undefined
  onLog: (habitId: string, value: number) => Promise<void>
}

function HabitRow({ habit, log, onLog }: HabitRowProps) {
  const currentValue = log?.value ?? 0
  const completed = log?.completed ?? false
  const binary = isBinary(habit)

  const [inputValue, setInputValue] = useState<string>(String(currentValue || ''))
  const [saving, setSaving] = useState(false)

  // Sync input when log changes externally
  useEffect(() => {
    setInputValue(String(log?.value ?? ''))
  }, [log?.value])

  async function handleToggle() {
    if (saving) return
    setSaving(true)
    try {
      await onLog(habit.id, completed ? 0 : 1)
    } finally {
      setSaving(false)
    }
  }

  async function handleLog() {
    const val = parseFloat(inputValue)
    if (isNaN(val) || val < 0) return
    setSaving(true)
    try {
      await onLog(habit.id, val)
    } finally {
      setSaving(false)
    }
  }

  async function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') await handleLog()
  }

  return (
    <div
      className={[
        'rounded-xl border p-4 transition-all',
        completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200',
      ].join(' ')}
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <span className="text-2xl leading-none">{habit.icon}</span>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={[
                'text-sm font-semibold',
                completed ? 'line-through text-gray-400' : 'text-gray-800',
              ].join(' ')}
            >
              {habit.name}
            </span>
            {completed && (
              <span className="text-green-500 text-base leading-none">✓</span>
            )}
          </div>
          <span className="text-xs text-gray-400">{formatTarget(habit.target, habit.unit)}</span>

          {!binary && (
            <ProgressBar value={currentValue} target={habit.target} completed={completed} />
          )}
        </div>

        {/* Control */}
        {binary ? (
          <button
            onClick={handleToggle}
            disabled={saving}
            aria-label={completed ? 'Mark incomplete' : 'Mark complete'}
            className={[
              'w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all shrink-0',
              completed
                ? 'bg-green-500 border-green-500 text-white'
                : 'border-gray-300 hover:border-green-400 bg-white',
              saving ? 'opacity-50 cursor-not-allowed' : '',
            ].join(' ')}
          >
            {completed && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        ) : (
          <div className="flex items-center gap-1.5 shrink-0">
            <input
              type="number"
              min={0}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="0"
              className="w-16 text-center rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400"
            />
            <button
              onClick={handleLog}
              disabled={saving}
              className={[
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                completed
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-blue-600 text-white hover:bg-blue-700',
                saving ? 'opacity-50 cursor-not-allowed' : '',
              ].join(' ')}
            >
              {saving ? '…' : 'Log'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function HabitsPanel() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const today = todayStr()

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const [habitsResult, logsResult] = await Promise.all([
        supabase
          .from('habits')
          .select('id, name, type, target, unit, icon, active')
          .eq('client_id', user.id)
          .eq('active', true)
          .order('name'),
        supabase
          .from('habit_logs')
          .select(`
            habit_id,
            log_date,
            value,
            completed,
            habits ( name, unit, target, icon )
          `)
          .eq('user_id', user.id)
          .eq('log_date', today),
      ])

      setHabits(habitsResult.data ?? [])

      const mappedLogs: HabitLog[] = (logsResult.data ?? []).map((row) => {
        const habit = row.habits as unknown as { name: string; unit: string; target: number; icon: string } | null
        return {
          habit_id: row.habit_id,
          log_date: row.log_date,
          value: row.value,
          completed: row.completed,
          habit_name: habit?.name ?? '',
          habit_unit: habit?.unit ?? '',
          habit_target: habit?.target ?? 0,
          habit_icon: habit?.icon ?? '',
        }
      })
      setLogs(mappedLogs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load habits')
    } finally {
      setLoading(false)
    }
  }, [today])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleLog(habitId: string, value: number) {
    const habit = habits.find(h => h.id === habitId)
    if (!habit) return

    const completed = value >= habit.target

    // Optimistic update
    setLogs(prev => {
      const existing = prev.find(l => l.habit_id === habitId)
      if (existing) {
        return prev.map(l =>
          l.habit_id === habitId ? { ...l, value, completed } : l
        )
      }
      return [
        ...prev,
        {
          habit_id: habitId,
          log_date: today,
          value,
          completed,
          habit_name: habit.name,
          habit_unit: habit.unit,
          habit_target: habit.target,
          habit_icon: habit.icon,
        },
      ]
    })

    try {
      await fetch('/api/habits/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ habit_id: habitId, log_date: today, value, completed }),
      })
    } catch {
      // Revert on error by re-fetching
      await fetchData()
    }
  }

  const completedCount = habits.filter(h => {
    const log = logs.find(l => l.habit_id === h.id)
    return log?.completed ?? false
  }).length
  const total = habits.length

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="space-y-3 animate-pulse">
          <div className="h-5 w-48 bg-gray-100 rounded-full" />
          <div className="h-4 w-32 bg-gray-50 rounded-full" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-50 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    )
  }

  if (habits.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
        <div className="text-3xl mb-3">🎯</div>
        <p className="font-semibold text-gray-800 mb-1">No habits yet</p>
        <p className="text-sm text-gray-400">Your coach will set up your daily habits soon.</p>
      </div>
    )
  }

  const allDone = total > 0 && completedCount === total

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-gray-900">Today's Habits</h2>
          <span
            className={[
              'text-sm font-semibold',
              allDone ? 'text-green-600' : 'text-gray-500',
            ].join(' ')}
          >
            {completedCount}/{total}
          </span>
        </div>

        {/* Motivational summary */}
        <p className={`text-xs ${allDone ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
          {allDone
            ? '🎉 All habits done — great work!'
            : completedCount === 0
            ? 'Start your habits for today'
            : `${completedCount} of ${total} habits completed today`}
        </p>

        {/* Overall progress bar */}
        <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden mt-3">
          <div
            className={`h-full rounded-full transition-all duration-700 ${allDone ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: total > 0 ? `${Math.round((completedCount / total) * 100)}%` : '0%' }}
          />
        </div>
      </div>

      {/* Habits list */}
      <div className="p-4 flex flex-col gap-2.5">
        {habits.map(habit => {
          const log = logs.find(l => l.habit_id === habit.id)
          return (
            <HabitRow
              key={habit.id}
              habit={habit}
              log={log}
              onLog={handleLog}
            />
          )
        })}
      </div>
    </div>
  )
}
