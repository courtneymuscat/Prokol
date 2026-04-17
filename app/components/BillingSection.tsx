'use client'

import { useState, useEffect } from 'react'

type BillingInfo = {
  subscription_tier: string
  next_billing_date: string | null
  has_stripe_customer: boolean
}

const PLAN_DISPLAY: Record<string, { name: string; price: string }> = {
  individual_free:      { name: 'Tracker',                price: 'Free' },
  individual_optimiser: { name: 'Optimiser',              price: '$19.99 AUD/mo' },
  individual_elite:     { name: 'Elite',                  price: '$34.99 AUD/mo' },
  coached:              { name: 'Coached',                price: '' },
  coach_solo:           { name: 'Coach Solo',             price: '$29 AUD/mo' },
  coach_pro:            { name: 'Coach Pro',              price: '$69 AUD/mo' },
  coach_business:       { name: 'Coach Business',         price: '$199 AUD/mo' },
  wl_starter:           { name: 'Web White-label',        price: '$299 AUD/mo' },
  wl_pro:               { name: 'App Store White-label',  price: '$499 AUD/mo' },
}

export default function BillingSection({ returnPath = '/settings' }: { returnPath?: string }) {
  const [info, setInfo] = useState<BillingInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [redirecting, setRedirecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/billing/info')
      .then((r) => r.json())
      .then((d) => { setInfo(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleManage() {
    setRedirecting(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnPath }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error ?? 'Something went wrong')
        setRedirecting(false)
      }
    } catch {
      setError('Something went wrong')
      setRedirecting(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border p-5">
        <p className="text-sm font-semibold text-gray-900 mb-2">Billing & subscription</p>
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    )
  }

  const tier = info?.subscription_tier ?? 'individual_free'
  const plan = PLAN_DISPLAY[tier] ?? { name: tier, price: '' }
  const nextDate = info?.next_billing_date
    ? new Date(info.next_billing_date).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  return (
    <div className="bg-white rounded-2xl border p-5 space-y-4">
      <p className="text-sm font-semibold text-gray-900">Billing & subscription</p>

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-900">{plan.name}</p>
          {plan.price && <p className="text-xs text-gray-400 mt-0.5">{plan.price}</p>}
          {nextDate && (
            <p className="text-xs text-gray-400 mt-1">Next billing: {nextDate}</p>
          )}
        </div>
        <span className="flex-shrink-0 text-xs font-medium bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
          Current plan
        </span>
      </div>

      {tier === 'coached' ? (
        <p className="text-xs text-gray-500 italic">Your subscription is managed by your coach.</p>
      ) : tier === 'individual_free' ? (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">You are on the free plan.</p>
          <a
            href="/pricing"
            className="inline-block text-xs font-semibold px-4 py-2 rounded-xl text-gray-900"
            style={{ backgroundColor: '#FFD885' }}
          >
            Upgrade plan →
          </a>
        </div>
      ) : info?.has_stripe_customer ? (
        <div>
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          <button
            onClick={handleManage}
            disabled={redirecting}
            className="text-xs font-semibold px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:border-gray-400 transition-colors disabled:opacity-50"
          >
            {redirecting ? 'Redirecting…' : 'Manage subscription'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
