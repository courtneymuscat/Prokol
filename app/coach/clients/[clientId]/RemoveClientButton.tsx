'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RemoveClientButton({ clientId }: { clientId: string }) {
  const [state, setState] = useState<'idle' | 'confirm'>('idle')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleArchive() {
    setLoading(true)
    await fetch(`/api/coach/clients/${clientId}`, { method: 'PATCH' })
    router.refresh()
  }

  async function handleRemove() {
    setLoading(true)
    await fetch(`/api/coach/clients/${clientId}`, { method: 'DELETE' })
    router.push('/coach/clients')
  }

  if (state === 'confirm') {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500">Choose action:</span>
        <button
          onClick={handleArchive}
          disabled={loading}
          className="text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? '…' : 'Archive'}
        </button>
        <button
          onClick={handleRemove}
          disabled={loading}
          className="text-xs font-semibold text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? '…' : 'Remove'}
        </button>
        <button
          onClick={() => setState('idle')}
          className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setState('confirm')}
      className="text-xs font-medium text-gray-400 hover:text-red-500 border border-gray-200 hover:border-red-200 px-3 py-1.5 rounded-lg transition-colors"
    >
      Archive / Remove
    </button>
  )
}
