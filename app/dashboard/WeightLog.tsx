'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'

function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function WeightLog() {
  const router = useRouter()
  const [unit, setUnit] = useState<'lbs' | 'kg'>('lbs')
  const [weight, setWeight] = useState('')
  const [date, setDate] = useState(todayLocal)
  const [pending, setPending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('checkin_weight_unit')
    if (saved === 'kg' || saved === 'lbs') setUnit(saved)
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
    </Card>
  )
}
