'use client'

import { useState, useEffect } from 'react'

type Service = {
  id: string
  name: string
  price_label: string | null
}

type Form = {
  id: string
  title: string
}

export default function InviteForm() {
  const [email, setEmail] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [formId, setFormId] = useState('')
  const [services, setServices] = useState<Service[]>([])
  const [forms, setForms] = useState<Form[]>([])
  const [servicesLoaded, setServicesLoaded] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/coach/services')
      .then((r) => r.ok ? r.json() : [])
      .then((data: Service[]) => {
        setServices(data)
        setServicesLoaded(true)
      })
      .catch(() => setServicesLoaded(true))

    fetch('/api/forms')
      .then((r) => r.ok ? r.json() : [])
      .then((data: Form[]) => setForms(data))
      .catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!serviceId) { setError('Please select a service before sending an invite.'); return }
    setPending(true)
    setError(null)
    setLink(null)

    const res = await fetch('/api/coach/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, service_id: serviceId, form_id: formId || null }),
    })
    const json = await res.json()

    if (!res.ok) {
      setError(json.error ?? 'Failed to create invite')
    } else {
      setLink(json.url)
      setEmail('')
      setServiceId('')
      setFormId('')
    }
    setPending(false)
  }

  async function copyLink() {
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-white rounded-xl border p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Invite a client</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        {servicesLoaded && services.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Service <span className="text-red-500">*</span>
            </label>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Select a service…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.price_label ? ` — ${s.price_label}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        {forms.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Onboarding form (optional)</label>
            <select
              value={formId}
              onChange={(e) => setFormId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">No form</option>
              {forms.map((f) => (
                <option key={f.id} value={f.id}>{f.title}</option>
              ))}
            </select>
          </div>
        )}

        {servicesLoaded && services.length === 0 && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            You need to add at least one service before inviting clients.{' '}
            <a href="/coach/settings" className="underline font-medium">Go to Settings →</a>
          </p>
        )}
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="client@example.com"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={pending || !serviceId || services.length === 0}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {pending ? 'Generating…' : 'Generate link'}
          </button>
        </div>
      </form>

      {error && <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}

      {link && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Share this link with your client:</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={link}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600 bg-gray-50 truncate"
            />
            <button
              onClick={copyLink}
              className="flex-shrink-0 border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-gray-400">Expires in 7 days.</p>
        </div>
      )}
    </div>
  )
}
