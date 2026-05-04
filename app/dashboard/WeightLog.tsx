'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'

function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type WeightEntry = { id: string; weight_lbs: number; weight_unit: string; logged_at: string }

function EditRow({
  entry,
  onSave,
  onDelete,
  onCancel,
}: {
  entry: WeightEntry
  onSave: (id: string, weightLbs: number, unit: 'lbs' | 'kg') => Promise<void>
  onDelete: (id: string) => Promise<void>
  onCancel: () => void
}) {
  const initUnit = (entry.weight_unit === 'kg' ? 'kg' : 'lbs') as 'lbs' | 'kg'
  const initVal = initUnit === 'kg'
    ? (entry.weight_lbs / 2.20462).toFixed(1)
    : entry.weight_lbs.toFixed(1)

  const [unit, setUnit] = useState<'lbs' | 'kg'>(initUnit)
  const [val, setVal] = useState(initVal)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function toggleUnit() {
    const next = unit === 'lbs' ? 'kg' : 'lbs'
    const num = parseFloat(val) || 0
    const converted = unit === 'lbs'
      ? (num / 2.20462).toFixed(1)
      : (num * 2.20462).toFixed(1)
    setUnit(next)
    setVal(converted)
  }

  async function save() {
    const num = parseFloat(val)
    if (!num) return
    setSaving(true)
    const lbs = unit === 'kg' ? num * 2.20462 : num
    await onSave(entry.id, lbs, unit)
    setSaving(false)
  }

  async function remove() {
    setDeleting(true)
    await onDelete(entry.id)
    setDeleting(false)
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={val}
          onChange={e => setVal(e.target.value)}
          step="0.1"
          min={0}
          className="flex-1 border border-blue-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
        />
        <button
          type="button"
          onClick={toggleUnit}
          className="text-xs font-semibold text-blue-600 bg-white border border-blue-200 px-2 py-1.5 rounded-lg hover:bg-blue-50 whitespace-nowrap"
        >
          {unit}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex-1 text-xs font-semibold bg-blue-600 text-white rounded-lg py-1.5 hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 text-xs font-semibold bg-white border border-gray-200 text-gray-600 rounded-lg py-1.5 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={deleting}
          className="text-xs font-semibold text-red-500 hover:text-red-700 px-2 py-1.5 disabled:opacity-50"
        >
          {deleting ? '…' : 'Delete'}
        </button>
      </div>
    </div>
  )
}

export default function WeightLog() {
  const router = useRouter()
  const [unit, setUnit] = useState<'lbs' | 'kg'>('lbs')
  const [weight, setWeight] = useState('')
  const [date, setDate] = useState(todayLocal)
  const [pending, setPending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<WeightEntry[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('checkin_weight_unit')
    if (saved === 'kg' || saved === 'lbs') setUnit(saved)
  }, [])

  async function fetchHistory() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('weight_logs')
      .select('id, weight_lbs, weight_unit, logged_at')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false })
      .limit(10)
    if (data) setHistory(data)
  }

  useEffect(() => {
    fetchHistory()
    const handler = () => fetchHistory()
    window.addEventListener('weight-logged', handler)
    return () => window.removeEventListener('weight-logged', handler)
  }, [])

  function toggleUnit() {
    const next = unit === 'lbs' ? 'kg' : 'lbs'
    setUnit(next)
    localStorage.setItem('checkin_weight_unit', next)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!weight) return
    setPending(true)
    setError(null)
    setSuccess(false)

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Not authenticated'); setPending(false); return }

    const weightLbs = unit === 'kg' ? Number(weight) * 2.20462 : Number(weight)
    const created_at = new Date(date + 'T12:00:00').toISOString()

    const { error: insertError } = await supabase.from('weight_logs').insert({
      user_id: session.user.id,
      weight_lbs: weightLbs,
      weight_unit: unit,
      logged_at: created_at,
    })

    if (insertError) { setError(insertError.message); setPending(false); return }

    setWeight('')
    setDate(todayLocal())
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
    window.dispatchEvent(new Event('weight-logged'))
    router.refresh()
    setPending(false)
  }

  async function handleSaveEdit(id: string, weightLbs: number, editUnit: 'lbs' | 'kg') {
    const supabase = createClient()
    await supabase
      .from('weight_logs')
      .update({ weight_lbs: weightLbs, weight_unit: editUnit })
      .eq('id', id)
    setEditingId(null)
    await fetchHistory()
    window.dispatchEvent(new Event('weight-logged'))
    router.refresh()
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    await supabase.from('weight_logs').delete().eq('id', id)
    setEditingId(null)
    await fetchHistory()
    window.dispatchEvent(new Event('weight-logged'))
    router.refresh()
  }

  return (
    <Card className="p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900">Log Weight</h3>
        <button
          type="button"
          onClick={toggleUnit}
          className="text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full transition-colors"
        >
          {unit === 'lbs' ? 'Switch to kg' : 'Switch to lbs'}
        </button>
      </div>

      <p className="text-xs text-gray-400 leading-relaxed mb-2">
        Weight fluctuates daily — for best results, weigh yourself first thing in the morning after using the bathroom. Weekly averages reveal the real trend.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 flex-1 justify-between">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={todayLocal()}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="relative">
          <input
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            min={0}
            step="0.1"
            placeholder={unit === 'lbs' ? 'e.g. 165.5' : 'e.g. 75.0'}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">
            {unit}
          </span>
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1.5">{error}</p>}
        {success && <p className="text-xs text-green-600 bg-green-50 rounded px-2 py-1.5">Weight logged!</p>}

        <button
          type="submit"
          disabled={pending || !weight}
          className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {pending ? 'Saving...' : 'Log Weight'}
        </button>
      </form>

      {history.length > 0 && (
        <div className="mt-4 border-t pt-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Recent entries</p>
          <div className="space-y-1.5">
            {history.map((entry) => {
              const displayUnit = (entry.weight_unit === 'kg' ? 'kg' : 'lbs') as 'lbs' | 'kg'
              const display = displayUnit === 'kg'
                ? `${(entry.weight_lbs / 2.20462).toFixed(1)} kg`
                : `${entry.weight_lbs.toFixed(1)} lbs`
              const d = new Date(entry.logged_at)
              const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

              if (editingId === entry.id) {
                return (
                  <EditRow
                    key={entry.id}
                    entry={entry}
                    onSave={handleSaveEdit}
                    onDelete={handleDelete}
                    onCancel={() => setEditingId(null)}
                  />
                )
              }

              return (
                <div key={entry.id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">{label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-700">{display}</span>
                    <button
                      type="button"
                      onClick={() => setEditingId(entry.id)}
                      className="text-gray-300 hover:text-blue-500 active:text-blue-600 transition-colors p-1 -mr-1"
                      title="Edit"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Card>
  )
}
