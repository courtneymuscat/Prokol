'use client'

import { useState, useEffect } from 'react'

type Service  = { id: string; name: string; price_label: string | null }
type Form     = { id: string; title: string }
type Autoflow = { id: string; name: string; type: string }

export default function InviteForm() {
  const [email, setEmail]                   = useState('')
  const [serviceId, setServiceId]           = useState('')
  const [formId, setFormId]                 = useState('')
  const [formSaveToFile, setFormSaveToFile] = useState(false)
  const [autoflowId, setAutoflowId]         = useState('')
  const [services, setServices]             = useState<Service[]>([])
  const [forms, setForms]                   = useState<Form[]>([])
  const [autoflows, setAutoflows]           = useState<Autoflow[]>([])
  const [link, setLink]                     = useState<string | null>(null)
  const [pending, setPending]               = useState(false)
  const [error, setError]                   = useState<string | null>(null)
  const [copied, setCopied]                 = useState(false)
  const [seatWarning, setSeatWarning]       = useState<{ used: number; included: number } | null>(null)

  useEffect(() => {
    fetch('/api/coach/services').then(r => r.ok ? r.json() : []).then(d => setServices(Array.isArray(d) ? d : []))
    fetch('/api/forms').then(r => r.ok ? r.json() : []).then(d => setForms(Array.isArray(d) ? d : []))
    fetch('/api/coach/autoflows').then(r => r.ok ? r.json() : []).then(d => setAutoflows(Array.isArray(d) ? d : []))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    setLink(null)

    const res = await fetch('/api/coach/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        service_id: serviceId || null,
        form_id: formId || null,
        form_save_to_file: formId ? formSaveToFile : false,
        autoflow_id: autoflowId || null,
      }),
    })
    const json = await res.json()
    setPending(false)

    if (!res.ok) {
      setError(json.requiresUpgrade
        ? 'An active coaching subscription is required. Please upgrade your plan.'
        : (json.error ?? 'Failed to create invite'))
      return
    }

    setLink(json.url)
    setEmail('')
    setServiceId('')
    setFormId('')
    setFormSaveToFile(false)
    setAutoflowId('')
    setSeatWarning(json.seatInfo?.overCapacity
      ? { used: json.seatInfo.used, included: json.seatInfo.included }
      : null)
  }

  async function copyLink() {
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const select = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700'

  return (
    <div className="bg-white rounded-2xl border p-5 space-y-3">
      <p className="text-sm font-semibold text-gray-900">Invite a client</p>

      <form onSubmit={handleSubmit} className="space-y-2.5">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          placeholder="client@example.com"
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {services.length > 0 && (
          <select value={serviceId} onChange={e => setServiceId(e.target.value)} className={select}>
            <option value="">Service (optional)</option>
            {services.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}{s.price_label ? ` — ${s.price_label}` : ''}
              </option>
            ))}
          </select>
        )}

        {forms.length > 0 && (
          <>
            <select value={formId} onChange={e => { setFormId(e.target.value); if (!e.target.value) setFormSaveToFile(false) }} className={select}>
              <option value="">Onboarding form (optional)</option>
              {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
            </select>
            {formId && (
              <label className="flex items-center gap-2.5 cursor-pointer px-1">
                <div
                  onClick={() => setFormSaveToFile(v => !v)}
                  className={`relative w-8 h-4.5 rounded-full transition-colors flex-shrink-0 cursor-pointer ${formSaveToFile ? 'bg-blue-600' : 'bg-gray-200'}`}
                  style={{ height: '18px', width: '32px' }}
                >
                  <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${formSaveToFile ? 'translate-x-3.5' : ''}`} />
                </div>
                <span className="text-xs text-gray-600">Save to client files</span>
              </label>
            )}
          </>
        )}

        {autoflows.length > 0 && (
          <select value={autoflowId} onChange={e => setAutoflowId(e.target.value)} className={select}>
            <option value="">Autoflow (optional)</option>
            {autoflows.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full bg-blue-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Sending…' : 'Send invite'}
        </button>
      </form>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">
          {error}
          {error.includes('subscription') && <a href="/pricing" className="ml-1 underline font-semibold">View plans →</a>}
        </p>
      )}

      {seatWarning && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          {seatWarning.used} of {seatWarning.included} seats used — extra clients are billed at your plan&apos;s overage rate.{' '}
          <a href="/coach/settings" className="underline font-semibold">Manage billing →</a>
        </p>
      )}

      {link && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
            <svg className="w-3.5 h-3.5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-xs text-green-800 font-medium">Invite sent!</p>
          </div>
          <div className="flex items-center gap-2">
            <input readOnly value={link} className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-500 bg-gray-50 truncate" />
            <button onClick={copyLink} className="flex-shrink-0 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              {copied ? '✓' : 'Copy'}
            </button>
          </div>
          <p className="text-[11px] text-gray-400">Link expires in 7 days.</p>
        </div>
      )}
    </div>
  )
}
