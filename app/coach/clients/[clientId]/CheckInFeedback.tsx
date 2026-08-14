'use client'

import { useState } from 'react'

type Props = {
  checkInId: string
  initialFeedback: string | null
  initialReviewed: boolean
  onReviewedChange?: (reviewed: boolean) => void
}

export default function CheckInFeedback({ checkInId, initialFeedback, initialReviewed, onReviewedChange }: Props) {
  const [feedback, setFeedback] = useState(initialFeedback ?? '')
  const [reviewed, setReviewed] = useState(initialReviewed)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function toggleReviewed(val: boolean) {
    setReviewed(val)
    await fetch(`/api/check-ins/${checkInId}/feedback`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewed: val }),
    })
    onReviewedChange?.(val)
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    const res = await fetch(`/api/check-ins/${checkInId}/feedback`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback, reviewed }),
    })
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
    setSaving(false)
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Coach feedback</p>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={reviewed}
            onChange={(e) => toggleReviewed(e.target.checked)}
            className="rounded"
          />
          <span className={`text-xs font-medium ${reviewed ? 'text-green-600' : 'text-gray-400'}`}>
            {reviewed ? 'Reviewed' : 'Mark as reviewed'}
          </span>
        </label>
      </div>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        rows={2}
        placeholder="Add feedback for this check-in…"
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="text-xs font-semibold bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving…' : saved ? 'Saved!' : 'Save feedback'}
      </button>
    </div>
  )
}
