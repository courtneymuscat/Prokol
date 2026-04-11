'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ClientMessagesInitiate({ coachId, userId }: { coachId: string; userId: string }) {
  const router = useRouter()
  const [starting, setStarting] = useState(false)

  async function start() {
    if (starting) return
    setStarting(true)
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coachId, clientId: userId }),
    })
    const data = await res.json()
    if (data.id) router.push(`/messages/${data.id}`)
    else setStarting(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center p-10">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <p className="text-gray-700 font-semibold text-lg">Chat with your coach</p>
        <p className="text-gray-400 text-sm mt-1 mb-6">Send a message to get started.</p>
        <button
          onClick={start}
          disabled={starting}
          className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-6 py-3 rounded-2xl hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {starting ? 'Opening chat…' : 'Message your coach'}
        </button>
      </div>
    </div>
  )
}
