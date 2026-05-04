'use client'

import { useState, useEffect } from 'react'

type Lapsed = { clientId: string; clientEmail: string; clientName?: string }
type RemindState = 'idle' | 'sending' | 'sent'

function RemindButton({ clientId }: { clientId: string }) {
  const [state, setState] = useState<RemindState>('idle')

  async function handle(e: React.MouseEvent) {
    e.preventDefault()
    setState('sending')
    const res = await fetch(`/api/coach/remind/${clientId}`, { method: 'POST' })
    setState(res.ok ? 'sent' : 'idle')
  }

  if (state === 'sent') return <span className="text-xs text-green-600 font-semibold">Sent ✓</span>
  return (
    <button
      onClick={handle}
      disabled={state === 'sending'}
      className="text-xs font-semibold border px-2.5 py-1 rounded-lg transition-colors disabled:opacity-40 flex-shrink-0"
      style={{ color: '#1D9E75', borderColor: 'rgba(29,158,117,0.3)' }}
    >
      {state === 'sending' ? '…' : 'Remind'}
    </button>
  )
}

export default function LapsedClients() {
  const [lapsed, setLapsed] = useState<Lapsed[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/coach/activity')
      .then((r) => r.json())
      .then((d) => setLapsed(d.lapsed ?? []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="bg-white rounded-2xl border p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-900">No check-in</p>
        {!loading && lapsed.length > 0 && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full border"
            style={{ backgroundColor: 'rgba(29,158,117,0.08)', color: '#1D9E75', borderColor: 'rgba(29,158,117,0.2)' }}>
            {lapsed.length} client{lapsed.length !== 1 ? 's' : ''} · no check-in in 7+ days
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-gray-400 py-2">Loading…</p>
      ) : lapsed.length === 0 ? (
        <div className="flex items-center gap-2 py-1">
          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(29,158,117,0.1)' }}>
            <svg className="w-3 h-3" style={{ color: '#1D9E75' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-xs text-gray-400">All clients active</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {lapsed.map((c) => {
            const display = c.clientName ?? c.clientEmail
            const initial = display[0].toUpperCase()
            return (
              <div key={c.clientId} className="flex items-center gap-2.5 py-1.5 px-2 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'rgba(29,158,117,0.1)' }}>
                  <span className="text-[10px] font-bold" style={{ color: '#1D9E75' }}>{initial}</span>
                </div>
                <a href={`/coach/clients/${c.clientId}`}
                  className="flex-1 min-w-0 hover:opacity-70 transition-opacity">
                  <p className="text-sm text-gray-800 truncate">{display.split('@')[0]}</p>
                  <p className="text-[10px] text-gray-400">No check-in in 7+ days</p>
                </a>
                <RemindButton clientId={c.clientId} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
