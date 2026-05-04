'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import TimezoneSelector from '@/app/components/TimezoneSelector'
import BillingSection from '@/app/components/BillingSection'

// All coach tiers get branding
const BRANDING_TIERS = new Set(['coach_solo', 'coach_pt_solo', 'coach_nutritionist_solo', 'coach_pro', 'coach_business', 'wl_starter', 'wl_pro'])
const SERVICE_TIERS = new Set(['coach_solo', 'coach_pt_solo', 'coach_nutritionist_solo', 'coach_pro', 'coach_business', 'wl_starter', 'wl_pro'])

type Service = {
  id: string
  name: string
  description: string | null
  price_label: string | null
  payment_link: string
  tos_url: string | null
  created_at: string
}

function ServicesSection({ tier }: { tier: string }) {
  const [services, setServices] = useState<Service[]>([])
  const [loadingServices, setLoadingServices] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', price_label: '', payment_link: '', description: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [tosUploading, setTosUploading] = useState<string | null>(null) // serviceId being uploaded
  const tosInputRef = useRef<HTMLInputElement>(null)
  const [addName, setAddName] = useState('')
  const [addPrice, setAddPrice] = useState('')
  const [addLink, setAddLink] = useState('')
  const [addDesc, setAddDesc] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const hasAccess = SERVICE_TIERS.has(tier)

  async function loadServices() {
    const res = await fetch('/api/coach/services')
    if (res.ok) setServices(await res.json())
    setLoadingServices(false)
  }

  useEffect(() => { loadServices() }, [])

  function startEdit(s: Service) {
    setEditingId(s.id)
    setEditForm({ name: s.name, price_label: s.price_label ?? '', payment_link: s.payment_link, description: s.description ?? '' })
    setEditError(null)
  }

  async function handleEditSave(id: string) {
    setEditSaving(true)
    setEditError(null)
    const res = await fetch(`/api/coach/services/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name,
        price_label: editForm.price_label || null,
        payment_link: editForm.payment_link,
        description: editForm.description || null,
      }),
    })
    const json = await res.json()
    setEditSaving(false)
    if (!res.ok) { setEditError(json.error ?? 'Failed to save'); return }
    setServices((prev) => prev.map((s) => s.id === id ? json : s))
    setEditingId(null)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setAddError(null)
    const res = await fetch('/api/coach/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: addName, price_label: addPrice || null, payment_link: addLink, description: addDesc || null }),
    })
    const json = await res.json()
    setAdding(false)
    if (!res.ok) { setAddError(json.error ?? 'Failed to add service'); return }
    setServices((prev) => [...prev, json])
    setAddName(''); setAddPrice(''); setAddLink(''); setAddDesc('')
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this service?')) return
    const res = await fetch(`/api/coach/services/${id}`, { method: 'DELETE' })
    if (res.ok) setServices((prev) => prev.filter((s) => s.id !== id))
  }

  async function uploadTos(serviceId: string, file: File) {
    setTosUploading(serviceId)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/coach/services/${serviceId}/tos`, { method: 'POST', body: fd })
    const json = await res.json()
    if (res.ok) setServices((prev) => prev.map((s) => s.id === serviceId ? { ...s, tos_url: json.tos_url } : s))
    setTosUploading(null)
  }

  async function removeTos(serviceId: string) {
    if (!confirm('Remove the terms of service for this service?')) return
    await fetch(`/api/coach/services/${serviceId}/tos`, { method: 'DELETE' })
    setServices((prev) => prev.map((s) => s.id === serviceId ? { ...s, tos_url: null } : s))
  }

  const inputClass = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  if (!hasAccess) {
    return (
      <div className="bg-gray-50 rounded-2xl border border-dashed border-gray-200 p-6 space-y-2">
        <h2 className="text-sm font-semibold text-gray-400">Services</h2>
        <p className="text-xs text-gray-400">
          Create service offerings with payment links on the{' '}
          <a href="/pricing" className="underline text-gray-500">Coach Pro plan or above</a>.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border p-6 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Services</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Define your offerings. Attach a service to a client invite to send them to the right payment page.
        </p>
      </div>

      {loadingServices ? (
        <p className="text-sm text-gray-400 py-2">Loading…</p>
      ) : services.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No services yet. Add your first service below.</p>
      ) : (
        <div className="space-y-3">
          {services.map((s) =>
            editingId === s.id ? (
              <div key={s.id} className="border border-blue-200 rounded-xl p-4 space-y-3 bg-blue-50/30">
                <p className="text-xs font-semibold text-gray-700">Edit service</p>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                  <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} required className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Price <span className="text-gray-400">(optional)</span></label>
                  <input value={editForm.price_label} onChange={(e) => setEditForm((f) => ({ ...f, price_label: e.target.value }))} placeholder="e.g. $299 one-off" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Payment link <span className="text-red-500">*</span></label>
                  <input type="url" value={editForm.payment_link} onChange={(e) => setEditForm((f) => ({ ...f, payment_link: e.target.value }))} required className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Description <span className="text-gray-400">(optional)</span></label>
                  <textarea value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} rows={2} placeholder="What's included in this service" className={`${inputClass} resize-none`} />
                </div>
                {editError && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{editError}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => handleEditSave(s.id)} disabled={editSaving || !editForm.name.trim() || !editForm.payment_link.trim()} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
                    {editSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div key={s.id} className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                      {s.price_label && (
                        <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">{s.price_label}</span>
                      )}
                    </div>
                    {s.description && <p className="text-xs text-gray-500">{s.description}</p>}
                    <a href={s.payment_link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline truncate block">{s.payment_link}</a>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button onClick={() => startEdit(s)} className="text-xs text-gray-500 hover:text-gray-900 transition-colors font-medium">Edit</button>
                    <button onClick={() => handleDelete(s.id)} className="text-xs text-red-500 hover:text-red-700 transition-colors font-medium">Delete</button>
                  </div>
                </div>
                {/* ToS section */}
                <div className="border-t border-gray-100 pt-3">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Terms of Service</p>
                    {s.tos_url ? (
                      <div className="flex items-center gap-2">
                        <a href={s.tos_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline font-medium">View</a>
                        <span className="text-gray-200">·</span>
                        <label className="text-xs text-gray-500 hover:text-gray-900 cursor-pointer font-medium transition-colors">
                          Replace
                          <input type="file" accept=".pdf,.doc,.docx" className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadTos(s.id, f); e.target.value = '' }} />
                        </label>
                        <span className="text-gray-200">·</span>
                        <button onClick={() => removeTos(s.id)} className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors">Remove</button>
                      </div>
                    ) : (
                      <label className={`text-xs font-semibold px-3 py-1 rounded-lg border cursor-pointer transition-colors ${tosUploading === s.id ? 'opacity-50 pointer-events-none' : 'border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900'}`}>
                        {tosUploading === s.id ? 'Uploading…' : '+ Upload PDF'}
                        <input type="file" accept=".pdf,.doc,.docx" className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadTos(s.id, f); e.target.value = '' }} />
                      </label>
                    )}
                  </div>
                  {s.tos_url ? (
                    <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-1.5">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      ToS uploaded — clients must accept before payment
                    </div>
                  ) : (
                    <div className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 space-y-1">
                      <p>No ToS uploaded. Clients will be shown the <strong>Prokol Template Terms of Service</strong> and must accept it before payment.</p>
                      <a href="/prokol-tos-template.html" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold underline hover:no-underline">
                        Download template to customise ↗
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      )}

      <div className="border-t pt-4 space-y-3">
        <p className="text-xs font-semibold text-gray-700">Add a service</p>
        <form onSubmit={handleAdd} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
            <input value={addName} onChange={(e) => setAddName(e.target.value)} required placeholder="e.g. 12-week nutrition program" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Price <span className="text-gray-400">(optional)</span></label>
            <input value={addPrice} onChange={(e) => setAddPrice(e.target.value)} placeholder="e.g. $299 one-off" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Payment link <span className="text-red-500">*</span></label>
            <input type="url" value={addLink} onChange={(e) => setAddLink(e.target.value)} required placeholder="https://buy.stripe.com/…" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description <span className="text-gray-400">(optional)</span></label>
            <textarea value={addDesc} onChange={(e) => setAddDesc(e.target.value)} rows={2} placeholder="What's included — e.g. weekly check-ins, custom meal plan, 24/7 support" className={`${inputClass} resize-none`} />
          </div>
          {addError && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{addError}</p>}
          <button type="submit" disabled={adding} className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {adding ? 'Adding…' : 'Add service'}
          </button>
        </form>
      </div>
    </div>
  )
}

function BrandingSection({ initialColour, initialLogoUrl, initialBrandName }: { initialColour: string | null; initialLogoUrl: string | null; initialBrandName: string | null }) {
  const [colour, setColour] = useState(initialColour ?? '#F5C842')
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl ?? '')
  const [brandName, setBrandName] = useState(initialBrandName ?? '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function persistSettings(overrides: { logo_url?: string | null; brand_colour?: string; brand_name?: string } = {}) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/coach/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_colour: overrides.brand_colour ?? colour,
          logo_url: ('logo_url' in overrides ? overrides.logo_url : logoUrl) ?? null,
          brand_name: (overrides.brand_name ?? brandName) || null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Failed to save')
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so the same file can be re-selected if needed
    e.target.value = ''
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo must be under 2 MB')
      return
    }
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/coach/settings/logo', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Upload failed')
      // Add cache buster so browsers show the new image immediately
      const newUrl = `${json.url}?t=${Date.now()}`
      setLogoUrl(newUrl)
      // Auto-save the new URL to the profile so navigating away doesn't lose it
      await persistSettings({ logo_url: newUrl })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    await persistSettings()
  }

  return (
    <div className="bg-white rounded-2xl border p-6 space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Branding</h2>
        <p className="text-xs text-gray-500 mt-0.5">Your logo and brand colour appear in your clients&apos; app experience.</p>
      </div>

      {/* Brand name */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-gray-700">Brand name</label>
        <input
          type="text"
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
          placeholder="e.g. Elite Coaching Co."
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400">Shown to clients on their invite and in the app.</p>
      </div>

      {/* Logo upload */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-700">Logo</label>
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <img src={logoUrl} alt="Brand logo" className="h-12 w-12 object-contain rounded-xl border" />
          ) : (
            <div className="h-12 w-12 rounded-xl border border-dashed border-gray-300 flex items-center justify-center text-gray-300 text-xs">
              No logo
            </div>
          )}
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || saving}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:border-gray-500 transition-colors disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : saved && logoUrl ? 'Logo saved ✓' : 'Upload logo'}
            </button>
            <p className="text-xs text-gray-400">PNG, JPG or SVG · max 2 MB · saves automatically</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/svg+xml,image/jpeg,image/webp"
            className="hidden"
            onChange={handleLogoUpload}
          />
        </div>
        {logoUrl && (
          <button
            type="button"
            onClick={async () => {
              setLogoUrl('')
              await persistSettings({ logo_url: null })
            }}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Remove logo
          </button>
        )}
      </div>

      {/* Brand colour */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-700">Brand colour</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={colour}
            onChange={(e) => setColour(e.target.value)}
            className="h-9 w-14 rounded-lg cursor-pointer border border-gray-200"
          />
          <input
            type="text"
            value={colour}
            onChange={(e) => setColour(e.target.value)}
            placeholder="#F5C842"
            className="w-28 border border-gray-300 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div
            className="h-9 w-9 rounded-xl border border-gray-200"
            style={{ backgroundColor: colour }}
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving…' : saved ? 'Saved!' : 'Save branding'}
      </button>
    </div>
  )
}

export default function CoachSettingsPage() {
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [subscriptionTier, setSubscriptionTier] = useState<string>('individual_free')
  const [brandColour, setBrandColour] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [brandName, setBrandName] = useState<string | null>(null)
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
        setSubscriptionTier(d.subscription_tier ?? 'individual_free')
        setBrandColour(d.brand_colour ?? null)
        setLogoUrl(d.logo_url ?? null)
        setBrandName(d.brand_name ?? null)
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
  const hasBranding = BRANDING_TIERS.has(subscriptionTier)

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

            {/* Branding — Pro and above */}
            {hasBranding ? (
              <BrandingSection initialColour={brandColour} initialLogoUrl={logoUrl} initialBrandName={brandName} />
            ) : (
              <div className="bg-gray-50 rounded-2xl border border-dashed border-gray-200 p-6 space-y-2">
                <h2 className="text-sm font-semibold text-gray-400">Branding</h2>
                <p className="text-xs text-gray-400">
                  Upload your logo and set a brand colour on the{' '}
                  <a href="/pricing" className="underline text-gray-500">Pro plan or above</a>.
                </p>
              </div>
            )}

            {/* Services */}
            <ServicesSection tier={subscriptionTier} />

            {/* Billing & subscription */}
            <BillingSection returnPath="/coach/settings" />

            {/* Legal */}
            <div className="border-t border-gray-100 pt-4 flex flex-wrap gap-x-5 gap-y-1.5">
              <a href="/terms" target="_blank" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Terms of Service</a>
              <a href="/privacy" target="_blank" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Privacy Policy</a>
              <a href="/health-data" target="_blank" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Health Data Processing</a>
              <a href="mailto:info@prokol.io" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">info@prokol.io</a>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
