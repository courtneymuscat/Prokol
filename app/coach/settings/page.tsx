'use client'

import { useState, useEffect } from 'react'
import TimezoneSelector from '@/app/components/TimezoneSelector'
import BillingSection from '@/app/components/BillingSection'

type Service = {
  id: string
  name: string
  description: string | null
  price_label: string | null
  payment_link: string
  created_at: string
}

function ServicesSection() {
  const [services, setServices] = useState<Service[]>([])
  const [loadingServices, setLoadingServices] = useState(true)
  const [addName, setAddName] = useState('')
  const [addPrice, setAddPrice] = useState('')
  const [addLink, setAddLink] = useState('')
  const [addDesc, setAddDesc] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  async function loadServices() {
    const res = await fetch('/api/coach/services')
    if (res.ok) {
      const data = await res.json()
      setServices(data)
    }
    setLoadingServices(false)
  }

  useEffect(() => { loadServices() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setAddError(null)
    const res = await fetch('/api/coach/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: addName,
        price_label: addPrice || null,
        payment_link: addLink,
        description: addDesc || null,
      }),
    })
    const json = await res.json()
    setAdding(false)
    if (!res.ok) { setAddError(json.error ?? 'Failed to add service'); return }
    setAddName('')
    setAddPrice('')
    setAddLink('')
    setAddDesc('')
    await loadServices()
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/coach/services/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setServices((prev) => prev.filter((s) => s.id !== id))
    }
  }

  const inputClass = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="bg-white rounded-2xl border p-6 space-y-4">
      <h2 className="text-sm font-semibold text-gray-900">Services</h2>
      <p className="text-xs text-gray-500">
        Define the services you offer. When inviting a client, you can attach a service to send them the right payment link.
      </p>

      {loadingServices ? (
        <p className="text-sm text-gray-400 py-2">Loading…</p>
      ) : services.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No services yet. Add your first service below.</p>
      ) : (
        <div className="space-y-3">
          {services.map((s) => (
            <div key={s.id} className="border border-gray-200 rounded-xl p-4 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {s.name}
                    {s.price_label && (
                      <span className="ml-2 text-xs font-normal text-gray-500">{s.price_label}</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{s.payment_link}</p>
                  {s.description && (
                    <p className="text-xs text-gray-500">{s.description}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="flex-shrink-0 text-xs text-red-500 hover:text-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add service form */}
      <div className="border-t pt-4 space-y-3">
        <p className="text-xs font-semibold text-gray-700">Add a service</p>
        <form onSubmit={handleAdd} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
            <input
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              required
              placeholder="e.g. 1-on-1 Coaching"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Price <span className="text-gray-400">(optional)</span></label>
            <input
              value={addPrice}
              onChange={(e) => setAddPrice(e.target.value)}
              placeholder="e.g. $150/mo"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Payment link <span className="text-red-500">*</span></label>
            <input
              type="url"
              value={addLink}
              onChange={(e) => setAddLink(e.target.value)}
              required
              placeholder="https://buy.stripe.com/..."
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description <span className="text-gray-400">(optional)</span></label>
            <input
              value={addDesc}
              onChange={(e) => setAddDesc(e.target.value)}
              placeholder="Brief description of this service"
              className={inputClass}
            />
          </div>
          {addError && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{addError}</p>}
          <button
            type="submit"
            disabled={adding}
            className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {adding ? 'Adding…' : 'Add service'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function CoachSettingsPage() {
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
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
      body: JSON.stringify({ first_name: firstName }),
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
          <>
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

              {/* Password */}
              <div className="bg-white rounded-2xl border p-6 space-y-4">
                <h2 className="text-sm font-semibold text-gray-900">Password</h2>
                <p className="text-xs text-gray-500">
                  To change your password, sign out and use the &quot;Forgot password&quot; link on the login page.
                </p>
              </div>

              {/* Timezone */}
              <div className="bg-white rounded-2xl border p-6 space-y-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Timezone</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Used to display your schedule and client activity in the correct local time.</p>
                </div>
                <TimezoneSelector apiUrl="/api/coach/settings" />
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

            {/* Services — outside the profile form */}
            <ServicesSection />

            {/* Billing & subscription */}
            <BillingSection returnPath="/coach/settings" />
          </>
        )}
      </main>
    </div>
  )
}
