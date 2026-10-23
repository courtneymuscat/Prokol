'use client'

import { useState, useEffect, useCallback } from 'react'

type ProgramLink = {
  id: string
  code: string
  price_cents: number | null
  currency: string
  is_active: boolean
  created_at: string
}

// Lets Court sell a specific autoflow directly to individuals via a
// one-time-payment signup link — no gym involved. Deliberately invisible
// (renders nothing) to every other coach: the real authorization boundary
// is the 403 from /api/coach/program-links, not this component hiding
// itself, so there's nothing to bypass client-side even if someone tried.
export default function ProgramLinkPanel({ autoflowId }: { autoflowId: string }) {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [links, setLinks] = useState<ProgramLink[]>([])
  const [open, setOpen] = useState(false)
  const [priceInput, setPriceInput] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchLinks = useCallback(async () => {
    const res = await fetch(`/api/coach/program-links?autoflow_id=${autoflowId}`)
    if (res.status === 403) {
      setAllowed(false)
      return
    }
    setAllowed(true)
    const data = await res.json()
    setLinks(Array.isArray(data) ? data : [])
  }, [autoflowId])

  useEffect(() => { fetchLinks() }, [fetchLinks])

  async function createLink() {
    const priceCents = Math.round(Number(priceInput) * 100)
    if (!priceCents || priceCents <= 0) {
      setError('Enter a price')
      return
    }
    setCreating(true)
    setError(null)
    const res = await fetch('/api/coach/program-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoflowId, priceCents }),
    })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) {
      setError(data.error ?? 'Failed to create link')
      return
    }
    setPriceInput('')
    fetchLinks()
  }

  function copyLink(code: string, id: string) {
    navigator.clipboard.writeText(`${window.location.origin}/org/join/${code}`)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (allowed !== true) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-gray-400 hover:text-gray-700 transition-colors px-2 flex items-center gap-1"
        title="Sell this program directly to individuals"
      >
        💳 Sell
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Sell this program</h3>
              <button onClick={() => setOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-400">
                Anyone who signs up through this link pays once and is enrolled directly as your client — no gym involved.
              </p>

              {links.length > 0 && (
                <ul className="space-y-2">
                  {links.map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800">
                          {l.price_cents ? `$${(l.price_cents / 100).toFixed(2)} ${l.currency.toUpperCase()}` : 'Free'}
                          {!l.is_active && <span className="ml-2 text-xs text-gray-400">(inactive)</span>}
                        </p>
                        <p className="text-xs text-gray-400 truncate">/org/join/{l.code}</p>
                      </div>
                      <button
                        onClick={() => copyLink(l.code, l.id)}
                        className="flex-shrink-0 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
                      >
                        {copiedId === l.id ? '✓ Copied' : 'Copy link'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    placeholder="149.00"
                    className="w-full rounded-xl border border-gray-200 pl-6 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>
                <button
                  onClick={createLink}
                  disabled={creating}
                  className="flex-shrink-0 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {creating ? 'Creating…' : '+ New link'}
                </button>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
