'use client'

import { useState, useEffect } from 'react'

export default function CoachSettingsPage() {
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [paymentLink, setPaymentLink] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/coach/settings')
      .then((r) => r.json())
      .then((d) => {
        setFirstName(d.first_name ?? '')
        setEmail(d.email ?? '')
        setPaymentLink(d.payment_link ?? '')
        setLoading(false)
      })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await fetch('/api/coach/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: firstName, payment_link: paymentLink }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setError(json.error ?? 'Failed to save'); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const inputClass = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-lg font-bold text-gray-900">Settings</h1>
      </div>

      <main className="max-w-xl mx-auto w-full p-6 space-y-6">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-10">Loading…</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">

            {/* Profile */}
            <div className="bg-white rounded-2xl border p-6 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">Profile</h2>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Display name</label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Your name"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input
                  value={email}
                  readOnly
                  className={`${inputClass} bg-gray-50 text-gray-400 cursor-not-allowed`}
                />
                <p className="text-xs text-gray-400 mt-1">Email cannot be changed here.</p>
              </div>
            </div>

            {/* Payment */}
            <div className="bg-white rounded-2xl border p-6 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">Payment</h2>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Client payment link</label>
                <input
                  type="url"
                  value={paymentLink}
                  onChange={(e) => setPaymentLink(e.target.value)}
                  placeholder="https://buy.stripe.com/..."
                  className={inputClass}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Clients will be shown this link when they accept your invite. Use any payment provider — Stripe, PayPal, direct bank, etc.
                </p>
              </div>
            </div>

            {/* Password */}
            <div className="bg-white rounded-2xl border p-6 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">Password</h2>
              <p className="text-xs text-gray-500">
                To change your password, sign out and use the "Forgot password" link on the login page.
              </p>
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : saved ? 'Saved!' : 'Save changes'}
            </button>
          </form>
        )}
      </main>
    </div>
  )
}
