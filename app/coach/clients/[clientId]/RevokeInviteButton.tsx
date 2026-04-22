'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RevokeInviteButton({ token }: { token: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function revoke() {
    if (!confirm('Revoke this invite? The link will stop working and the client will be removed from your roster.')) return
    setLoading(true)
    await fetch(`/api/coach/invite/${token}`, { method: 'DELETE' })
    router.push('/coach/clients')
  }

  return (
    <button
      onClick={revoke}
      disabled={loading}
      className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors flex-shrink-0 disabled:opacity-50"
    >
      {loading ? 'Revoking…' : 'Revoke invite'}
    </button>
  )
}
