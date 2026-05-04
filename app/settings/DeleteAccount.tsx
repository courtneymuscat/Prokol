'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function DeleteAccount() {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    if (input !== 'DELETE') return
    setLoading(true)
    setError(null)
    const res = await fetch('/api/account', { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Something went wrong')
      setLoading(false)
      return
    }
    // Clear the local session — the auth user no longer exists server-side
    const supabase = createClient()
    await supabase.auth.signOut({ scope: 'local' })
    router.push('/')
  }

  return (
    <div className="rounded-2xl border border-red-100 bg-red-50 p-5 space-y-3">
      <div>
        <p className="text-sm font-bold text-red-700">Delete account</p>
        <p className="text-xs text-red-600 mt-1">
          Permanently deletes your account and all associated data — food logs, workouts, check-ins, cycle logs, progress photos, meal plans, habits, coaching relationships, messages, and any active subscription. This cannot be undone.
        </p>
      </div>

      {!showConfirm && (
        <button
          onClick={() => setShowConfirm(true)}
          className="text-xs font-semibold px-4 py-2 rounded-xl border border-red-300 text-red-700 hover:bg-red-100 transition-colors"
        >
          Delete my account
        </button>
      )}

      {showConfirm && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-red-700">
            Type <span className="font-mono bg-red-100 px-1 py-0.5 rounded">DELETE</span> to confirm
          </p>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="DELETE"
            className="w-full border border-red-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => { setShowConfirm(false); setInput('') }}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={input !== 'DELETE' || loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Deleting…' : 'Delete permanently'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
