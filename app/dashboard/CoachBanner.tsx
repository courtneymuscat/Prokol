'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CoachBanner({ coachEmail }: { coachEmail: string }) {
  const [confirm, setConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLeave() {
    setLoading(true)
    await fetch('/api/leave-coach', { method: 'POST' })
    router.refresh()
  }

  return (
    <div className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-5 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">Coached by {coachEmail}</p>
          <p className="text-xs text-gray-400">Your coach manages your plan</p>
        </div>
      </div>

      {!confirm ? (
        <button
          onClick={() => setConfirm(true)}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors"
        >
          Leave coach
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Are you sure?</span>
          <button
            onClick={handleLeave}
            disabled={loading}
            className="text-xs font-semibold text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Leaving…' : 'Yes, leave'}
          </button>
          <button
            onClick={() => setConfirm(false)}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
