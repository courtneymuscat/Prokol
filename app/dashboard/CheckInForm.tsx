'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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

function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function CheckInForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [pending, setPending] = useState(false)
  const [date, setDate] = useState(todayLocal)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setPending(true)

    const formData = new FormData(e.currentTarget)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      setError('Not authenticated')
      setPending(false)
      return
    }

    const created_at = new Date(date + 'T12:00:00').toISOString()

    const payload: Record<string, unknown> = {
      user_id: session.user.id,
      notes: (formData.get('notes') as string) || null,
      created_at,
    }

    // Resilient: try with new columns, fall back if they don't exist yet
    const fullPayload = {
      ...payload,
      sleep_hours: formData.get('sleep_hours') ? Number(formData.get('sleep_hours')) : null,
      sleep_quality: (formData.get('sleep_quality') as string) || null,
      energy_level: (formData.get('energy_level') as string) || null,
    }

    const { error: insertError } = await supabase.from('check_ins').insert(fullPayload)

    if (insertError) {
      // New columns may not exist yet — fall back to base columns only
      const { error: fallbackError } = await supabase.from('check_ins').insert(payload)
      if (fallbackError) {
        setError(fallbackError.message)
        setPending(false)
        return
      }
    }

    setSuccess(true)
    ;(e.target as HTMLFormElement).reset()
    setDate(todayLocal())
    window.dispatchEvent(new Event('checkin-saved'))
    router.refresh()
    setPending(false)
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-900">Daily Check-In</h3>
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Date */}
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

        {/* Sleep hours */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Hours of sleep last night</label>
          <input
            name="sleep_hours"
            type="number"
            min={0}
            max={24}
            step="0.5"
            placeholder="e.g. 7.5"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Sleep quality */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Sleep quality</label>
          <select
            name="sleep_quality"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Select quality...</option>
            {SLEEP_QUALITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Energy level */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Energy level</label>
          <select
            name="energy_level"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Select energy...</option>
            {ENERGY_LEVEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
          <textarea
            name="notes"
            rows={2}
            placeholder="How are you feeling today? Recovery, soreness, motivation..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
        {success && <p className="text-sm text-green-600 bg-green-50 rounded px-3 py-2">Check-in saved!</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Saving...' : 'Save Daily Check-In'}
        </button>
      </form>
    </Card>
  )
}
