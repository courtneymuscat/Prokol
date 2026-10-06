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

type StatusResponse = {
  application: ApplicationStatus | null
  subscriptionTier: string | null
  hasWhiteLabelTier: boolean
  subdomain: string | null
}

const PLAN_OPTIONS = [
  { planKey: 'wl_starter', name: 'Web White-label', price: '$299 AUD/mo', description: 'Your own branded web app — logo, colours, and a free instant link.' },
  { planKey: 'wl_pro', name: 'App Store White-label', price: '$499 AUD/mo', description: 'Everything in Web, plus a dedicated app listing on the App Store / Google Play.' },
] as const

export default function WhiteLabelPage() {
  const [status, setStatus] = useState<StatusResponse | 'loading'>('loading')
  const [upgrading, setUpgrading] = useState<string | null>(null)

  const [appName, setAppName] = useState('')
  const [brandColour, setBrandColour] = useState('#F5C842')
  const [brandColourSecondary, setBrandColourSecondary] = useState('#1A1A1A')
  const [supportEmail, setSupportEmail] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [faviconFile, setFaviconFile] = useState<File | null>(null)
  const [appIconFile, setAppIconFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [dnsChecking, setDnsChecking] = useState(false)
  const [dnsStatus, setDnsStatus] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/org/white-label/status')
      .then(r => r.json())
      .then((d: StatusResponse) => setStatus(d))
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

  const { application: existing, hasWhiteLabelTier, subdomain } = status

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
                <div key={plan.planKey} className="border border-gray-200 rounded-xl p-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-gray-900">{plan.name}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{plan.description}</p>
                    <p className="text-sm font-medium text-gray-700 mt-2">{plan.price}</p>
                  </div>
                  <button
                    onClick={() => startUpgrade(plan.planKey)}
                    disabled={upgrading !== null}
                    className="shrink-0 px-4 py-2 text-sm font-semibold rounded-xl text-gray-900 hover:opacity-90 disabled:opacity-50 transition-colors whitespace-nowrap"
                    style={{ backgroundColor: '#1D9E75' }}
                  >
                    {upgrading === plan.planKey ? 'Starting…' : 'Choose plan'}
                  </button>
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

  if (existing && existing.status === 'approved') {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-12">
        <div className="max-w-xl mx-auto">
          <div className="bg-white rounded-2xl border border-gray-100 p-8 space-y-6">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                Live
              </span>
              <h1 className="text-xl font-semibold text-gray-900">White-label active</h1>
              <p className="text-sm text-gray-500 mt-1">
                You&apos;re all set — nothing else to do.
              </p>
            </div>

            {subdomain && (
              <div className="bg-green-50 border border-green-100 rounded-xl p-4 space-y-1">
                <p className="text-sm font-medium text-gray-700">Your link is live right now</p>
                <a
                  href={`https://${subdomain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm text-green-700 hover:underline"
                >
                  {subdomain} →
                </a>
              </div>
            )}

            {existing.custom_domain ? (
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <p className="font-medium text-gray-700">Optional: your own domain ({existing.custom_domain})</p>
                <p className="text-gray-500">
                  You asked for this as well — add a CNAME record at your domain registrar and we&apos;ll pick it up automatically (checked once a day), or click below to check right now.
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

            <div className="text-xs text-gray-400 pt-2 border-t border-gray-100">
              App name: {existing.app_name}
            </div>
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
                Logo (optional)
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={e => setLogoFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
              />
              <p className="text-xs text-gray-400 mt-1">PNG, JPG, SVG or WebP. Max 2 MB. Recommended: 200×50 px. Shown in the app header.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                App icon (optional)
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={e => setAppIconFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
              />
              <p className="text-xs text-gray-400 mt-1">Square image, 512×512 px recommended. This is the icon shown when a client adds the app to their phone&apos;s home screen. Falls back to your favicon if skipped.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Favicon (optional)
              </label>
              <input
                type="file"
                accept="image/png,image/x-icon,image/svg+xml"
                onChange={e => setFaviconFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
              />
              <p className="text-xs text-gray-400 mt-1">PNG or ICO. 32×32 px recommended. Shown in the browser tab.</p>
            </div>

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
