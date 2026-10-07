'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type ApplicationStatus = {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  app_name: string
  custom_domain: string | null
  submitted_at: string
  rejection_reason: string | null
}

type LiveBranding = {
  custom_domain: string | null
  app_name: string | null
  brand_colour: string | null
  brand_colour_secondary: string | null
  support_email: string | null
  logo_url: string | null
  favicon_url: string | null
  app_icon_url: string | null
}

type StatusResponse = {
  application: ApplicationStatus | null
  subscriptionTier: string | null
  hasWhiteLabelTier: boolean
  subdomain: string | null
  isLive?: boolean
  liveBranding?: LiveBranding | null
}

const PLAN_OPTIONS = [
  { planKey: 'wl_starter', name: 'Web White-label', price: '$299 AUD/mo', description: 'Your own branded web app — logo, colours, and a free instant link.', comingSoon: false },
  { planKey: 'wl_pro', name: 'App Store White-label', price: '$499 AUD/mo', description: 'Everything in Web, plus a dedicated app listing on the App Store / Google Play.', comingSoon: true },
] as const

// Shared by the first-time application form and the post-approval edit
// form — same fields either way, just a different submit target.
function BrandingFields({
  appName, setAppName,
  brandColour, setBrandColour,
  brandColourSecondary, setBrandColourSecondary,
  supportEmail, setSupportEmail,
  setLogoFile, setFaviconFile, setAppIconFile,
  currentLogoUrl, currentFaviconUrl, currentAppIconUrl,
}: {
  appName: string; setAppName: (v: string) => void
  brandColour: string; setBrandColour: (v: string) => void
  brandColourSecondary: string; setBrandColourSecondary: (v: string) => void
  supportEmail: string; setSupportEmail: (v: string) => void
  setLogoFile: (f: File | null) => void
  setFaviconFile: (f: File | null) => void
  setAppIconFile: (f: File | null) => void
  currentLogoUrl?: string | null
  currentFaviconUrl?: string | null
  currentAppIconUrl?: string | null
}) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          App name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={appName}
          onChange={e => setAppName(e.target.value)}
          placeholder="e.g. Peak Performance"
          required
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400 mt-1">What your clients see as the platform name.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Primary brand colour <span className="text-red-400">*</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={brandColour}
              onChange={e => setBrandColour(e.target.value)}
              className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
            />
            <span className="font-mono text-sm text-gray-600">{brandColour}</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Secondary colour
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={brandColourSecondary}
              onChange={e => setBrandColourSecondary(e.target.value)}
              className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
            />
            <span className="font-mono text-sm text-gray-600">{brandColourSecondary}</span>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Support email <span className="text-red-400">*</span>
        </label>
        <input
          type="email"
          value={supportEmail}
          onChange={e => setSupportEmail(e.target.value)}
          placeholder="support@yourdomain.com"
          required
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Logo {currentLogoUrl === undefined ? '(optional)' : ''}
        </label>
        {currentLogoUrl && (
          <img src={currentLogoUrl} alt="Current logo" className="h-8 w-auto object-contain mb-2 rounded border border-gray-100 bg-gray-50 px-2 py-1" />
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          onChange={e => setLogoFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
        />
        <p className="text-xs text-gray-400 mt-1">
          PNG, JPG, SVG or WebP. Max 2 MB. Recommended: 200×50 px. Shown in the app header.
          {currentLogoUrl !== undefined && ' Leave blank to keep your current logo.'}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          App icon {currentAppIconUrl === undefined ? '(optional)' : ''}
        </label>
        {currentAppIconUrl && (
          <img src={currentAppIconUrl} alt="Current app icon" className="h-10 w-10 object-contain mb-2 rounded border border-gray-100 bg-gray-50 p-1" />
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={e => setAppIconFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
        />
        <p className="text-xs text-gray-400 mt-1">
          Square image, 512×512 px recommended. This is the icon shown when a client adds the app to their phone&apos;s home screen. Falls back to your favicon if skipped.
          {currentAppIconUrl !== undefined && ' Leave blank to keep your current icon.'}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Favicon {currentFaviconUrl === undefined ? '(optional)' : ''}
        </label>
        {currentFaviconUrl && (
          <img src={currentFaviconUrl} alt="Current favicon" className="h-6 w-6 object-contain mb-2 rounded border border-gray-100 bg-gray-50 p-0.5" />
        )}
        <input
          type="file"
          accept="image/png,image/x-icon,image/svg+xml"
          onChange={e => setFaviconFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
        />
        <p className="text-xs text-gray-400 mt-1">
          PNG or ICO. 32×32 px recommended. Shown in the browser tab.
          {currentFaviconUrl !== undefined && ' Leave blank to keep your current favicon.'}
        </p>
      </div>
    </>
  )
}

export default function WhiteLabelPage() {
  const [status, setStatus] = useState<StatusResponse | 'loading'>('loading')
  const [upgrading, setUpgrading] = useState<string | null>(null)

  const [appName, setAppName] = useState('')
  // Deliberately neutral, not Prokol's own brand colours (#F5C842 / #1A1A1A)
  // — defaulting the picker to Prokol's exact colours meant anyone who
  // didn't touch it submitted "Prokol's colours" without realising, then
  // wondered why their white-labelled app still looked like Prokol.
  const [brandColour, setBrandColour] = useState('#4B5563')
  const [brandColourSecondary, setBrandColourSecondary] = useState('#111827')
  const [supportEmail, setSupportEmail] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [faviconFile, setFaviconFile] = useState<File | null>(null)
  const [appIconFile, setAppIconFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [dnsChecking, setDnsChecking] = useState(false)
  const [dnsStatus, setDnsStatus] = useState<string | null>(null)

  const [editSaved, setEditSaved] = useState(false)

  useEffect(() => {
    fetch('/api/org/white-label/status')
      .then(r => r.json())
      .then((d: StatusResponse) => {
        setStatus(d)
        if (d.isLive && d.liveBranding) {
          setAppName(d.liveBranding.app_name ?? '')
          setBrandColour(d.liveBranding.brand_colour ?? '#F5C842')
          setBrandColourSecondary(d.liveBranding.brand_colour_secondary ?? '#1A1A1A')
          setSupportEmail(d.liveBranding.support_email ?? '')
        }
      })
      .catch(() => setStatus({ application: null, subscriptionTier: null, hasWhiteLabelTier: false, subdomain: null }))
  }, [])

  async function startUpgrade(planKey: string) {
    setUpgrading(planKey)
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planKey, billing: 'monthly', userType: 'coach' }),
    })
    const data = await res.json()
    if (data.url) {
      window.location.href = data.url
    } else {
      setUpgrading(null)
      setError(data.error ?? 'Could not start checkout')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append('appName', appName)
    formData.append('brandColour', brandColour)
    formData.append('brandColourSecondary', brandColourSecondary)
    formData.append('supportEmail', supportEmail)
    if (logoFile) formData.append('logo', logoFile)
    if (faviconFile) formData.append('favicon', faviconFile)
    if (appIconFile) formData.append('appIcon', appIconFile)

    const res = await fetch('/api/org/white-label/apply', {
      method: 'POST',
      body: formData,
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong')
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setEditSaved(false)

    const formData = new FormData()
    formData.append('appName', appName)
    formData.append('brandColour', brandColour)
    formData.append('brandColourSecondary', brandColourSecondary)
    formData.append('supportEmail', supportEmail)
    if (logoFile) formData.append('logo', logoFile)
    if (faviconFile) formData.append('favicon', faviconFile)
    if (appIconFile) formData.append('appIcon', appIconFile)

    const res = await fetch('/api/org/white-label/update-branding', {
      method: 'POST',
      body: formData,
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong')
      return
    }

    setEditSaved(true)
    setLogoFile(null)
    setFaviconFile(null)
    setAppIconFile(null)
    // Refresh so the "current asset" previews reflect what was just uploaded.
    const refreshed: StatusResponse = await fetch('/api/org/white-label/status').then(r => r.json())
    setStatus(refreshed)
  }

  async function checkDns() {
    setDnsChecking(true)
    setDnsStatus(null)
    const res = await fetch('/api/org/white-label/verify-domain', { method: 'POST' })
    const data = await res.json()
    setDnsStatus(data.verified ? 'verified' : data.message ?? data.error ?? 'Not verified yet')
    setDnsChecking(false)
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    )
  }

  const { application: existing, hasWhiteLabelTier, isLive, liveBranding } = status

  // ── Upsell: not on a white-label plan yet ──────────────────────────────────
  if (!existing && !hasWhiteLabelTier) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-12">
        <div className="max-w-xl mx-auto">
          <div className="mb-6">
            <Link href="/coach/dashboard" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              ← Back to dashboard
            </Link>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-8 space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">White-label</h1>
              <p className="text-sm text-gray-500 mt-1">
                Give your clients a fully branded experience — your logo, your colours, your own link. Live instantly, no setup required.
              </p>
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
            )}
            <div className="space-y-3">
              {PLAN_OPTIONS.map((plan) => (
                <div key={plan.planKey} className={`border border-gray-200 rounded-xl p-5 flex items-start justify-between gap-4 ${plan.comingSoon ? 'opacity-60' : ''}`}>
                  <div>
                    <p className="font-semibold text-gray-900">{plan.name}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{plan.description}</p>
                    <p className="text-sm font-medium text-gray-700 mt-2">{plan.price}</p>
                  </div>
                  {plan.comingSoon ? (
                    <span className="shrink-0 px-4 py-2 text-sm font-semibold rounded-xl text-gray-500 bg-gray-100 whitespace-nowrap cursor-not-allowed">
                      Coming soon
                    </span>
                  ) : (
                    <button
                      onClick={() => startUpgrade(plan.planKey)}
                      disabled={upgrading !== null}
                      className="shrink-0 px-4 py-2 text-sm font-semibold rounded-xl text-gray-900 hover:opacity-90 disabled:opacity-50 transition-colors whitespace-nowrap"
                      style={{ backgroundColor: '#1D9E75' }}
                    >
                      {upgrading === plan.planKey ? 'Starting…' : 'Choose plan'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (success || (existing && existing.status === 'pending')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <div className="text-3xl mb-4">⏳</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Application submitted</h1>
          <p className="text-sm text-gray-500">
            Your white-label application is under review. We&apos;ll email you within 24–48 hours.
          </p>
        </div>
      </div>
    )
  }

  // Approved historically, but an admin has since turned it off — distinct
  // from "approved and live" below. There's no self-serve reactivate;
  // that's an admin-only action (see Admin Mode > White-label).
  if (existing && existing.status === 'approved' && !isLive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-full mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
            Inactive
          </span>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">White-label is currently off</h1>
          <p className="text-sm text-gray-500">
            Your white-label was approved previously, but it&apos;s not switched on right now. Contact <a href="mailto:info@prokol.io" className="underline">info@prokol.io</a> to turn it back on.
          </p>
        </div>
      </div>
    )
  }

  if (existing && existing.status === 'approved' && isLive && liveBranding) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-12">
        <div className="max-w-xl mx-auto space-y-6">
          <Link href="/coach/dashboard" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            ← Back to dashboard
          </Link>
          <div className="bg-white rounded-2xl border border-gray-100 p-8 space-y-6">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                Live
              </span>
              <h1 className="text-xl font-semibold text-gray-900">White-label active</h1>
              <p className="text-sm text-gray-500 mt-1">
                Changes below save immediately — no need to reapply.
              </p>
            </div>


            {liveBranding.custom_domain ? (
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <p className="font-medium text-gray-700">Your own domain ({liveBranding.custom_domain})</p>
                <p className="text-gray-500">
                  Add a CNAME record at your domain registrar and we&apos;ll pick it up automatically (checked once a day), or click below to check right now.
                </p>
                <div className="font-mono text-xs bg-white border rounded-lg p-3 space-y-1">
                  <p><span className="text-gray-400">Type:</span> CNAME</p>
                  <p><span className="text-gray-400">Host:</span> @ (or subdomain)</p>
                  <p><span className="text-gray-400">Value:</span> cname.vercel-dns.com</p>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={checkDns}
                    disabled={dnsChecking}
                    className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    {dnsChecking ? 'Checking…' : 'Check now'}
                  </button>
                  {dnsStatus && (
                    <span className={`text-sm font-medium ${dnsStatus === 'verified' ? 'text-green-600' : 'text-amber-600'}`}>
                      {dnsStatus === 'verified' ? '✓ Verified' : dnsStatus}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400">
                Want your own domain too (e.g. app.yourstudio.com)? Contact <a href="mailto:info@prokol.io" className="underline">info@prokol.io</a>.
              </p>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-8 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Edit branding</h2>
              <p className="text-sm text-gray-500 mt-1">
                Update your name, colours, logo or icons any time — changes go live right away.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            {editSaved && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
                Saved.
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-5">
              <BrandingFields
                appName={appName} setAppName={setAppName}
                brandColour={brandColour} setBrandColour={setBrandColour}
                brandColourSecondary={brandColourSecondary} setBrandColourSecondary={setBrandColourSecondary}
                supportEmail={supportEmail} setSupportEmail={setSupportEmail}
                setLogoFile={setLogoFile} setFaviconFile={setFaviconFile} setAppIconFile={setAppIconFile}
                currentLogoUrl={liveBranding.logo_url}
                currentFaviconUrl={liveBranding.favicon_url}
                currentAppIconUrl={liveBranding.app_icon_url}
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-semibold text-gray-900 hover:opacity-90 disabled:opacity-50 transition-colors"
                style={{ backgroundColor: '#1D9E75' }}
              >
                {loading ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  if (existing && existing.status === 'rejected') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 p-8">
          <div className="text-3xl mb-4">❌</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Application rejected</h1>
          {existing.rejection_reason && (
            <p className="text-sm text-gray-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4">
              {existing.rejection_reason}
            </p>
          )}
          <p className="text-sm text-gray-500 mb-4">
            Please contact <a href="mailto:info@prokol.io" className="underline">info@prokol.io</a> if you have questions.
          </p>
        </div>
      </div>
    )
  }

  // Show the application form — only reachable once on a white-label plan
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="max-w-xl mx-auto">
        <div className="mb-6">
          <Link href="/coach/dashboard" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            ← Back to dashboard
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Set up white-label</h1>
            <p className="text-sm text-gray-500 mt-1">
              Once approved, you&apos;ll get a free branded link (yourname.prokol.io) instantly — no setup needed.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <BrandingFields
              appName={appName} setAppName={setAppName}
              brandColour={brandColour} setBrandColour={setBrandColour}
              brandColourSecondary={brandColourSecondary} setBrandColourSecondary={setBrandColourSecondary}
              supportEmail={supportEmail} setSupportEmail={setSupportEmail}
              setLogoFile={setLogoFile} setFaviconFile={setFaviconFile} setAppIconFile={setAppIconFile}
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-gray-900 hover:opacity-90 disabled:opacity-50 transition-colors"
              style={{ backgroundColor: '#1D9E75' }}
            >
              {loading ? 'Submitting…' : 'Submit application'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
