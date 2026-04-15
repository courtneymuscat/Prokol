'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { INDIVIDUAL_PLANS, COACH_PLANS, type PricingPlan } from '@/lib/features'

function CheckIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="#FFD885" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function PlanCard({
  plan,
  billing,
  current,
  userType,
}: {
  plan: PricingPlan
  billing: 'monthly' | 'annual'
  current: boolean
  userType: 'individual' | 'coach'
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isFree = plan.priceMonthly === 0
  const displayPrice = billing === 'annual' ? plan.priceAnnualMonthly : plan.priceMonthly

  async function handleSelect() {
    if (isFree) {
      router.push(`/signup?plan=${plan.planKey}&type=${userType}`)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey: plan.planKey, billing, userType }),
      })
      if (res.status === 401 || res.status === 403) {
        router.push(`/signup?plan=${plan.planKey}&billing=${billing}&type=${userType}`)
        return
      }
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error ?? 'Something went wrong')
        setLoading(false)
      }
    } catch {
      setError('Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className={`relative flex flex-col rounded-2xl border p-6 bg-white ${
      plan.highlighted ? 'border-[#FFD885] shadow-lg' : 'border-gray-200'
    }`}>
      {plan.highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="text-xs font-semibold px-3 py-1 rounded-full text-gray-900" style={{ backgroundColor: '#FFD885' }}>
            {plan.tagline}
          </span>
        </div>
      )}
      {current && (
        <div className="absolute -top-3 right-4">
          <span className="bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
            Current plan
          </span>
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
        {!plan.highlighted && plan.tagline && (
          <p className="text-xs text-gray-400 mt-0.5">{plan.tagline}</p>
        )}
        {plan.clientLimit && (
          <p className="text-xs text-gray-400 mt-0.5">Up to {plan.clientLimit} clients</p>
        )}
      </div>

      <div className="mb-6">
        {isFree ? (
          <p className="text-4xl font-bold text-gray-900">Free</p>
        ) : (
          <div>
            <div className="flex items-end gap-1">
              <span className="text-4xl font-bold text-gray-900">${displayPrice}</span>
              <span className="text-gray-400 text-sm mb-1">AUD/mo</span>
            </div>
            {billing === 'annual' && (
              <p className="text-xs text-gray-400 mt-0.5">
                Billed annually — save 10%
              </p>
            )}
          </div>
        )}
      </div>

      <ul className="space-y-2.5 mb-8 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
            <CheckIcon />
            {f}
          </li>
        ))}
      </ul>

      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

      {current ? (
        <button disabled className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-400 cursor-not-allowed">
          Current plan
        </button>
      ) : (
        <button
          onClick={handleSelect}
          disabled={loading}
          className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
            plan.highlighted
              ? 'text-gray-900 hover:opacity-90'
              : 'bg-gray-900 text-white hover:bg-gray-800'
          }`}
          style={plan.highlighted ? { backgroundColor: '#FFD885' } : undefined}
        >
          {loading ? 'Loading…' : isFree ? 'Get started free' : `Get ${plan.name}`}
        </button>
      )}
    </div>
  )
}

export default function PricingCards({
  currentTier,
  currentUserType,
}: {
  currentTier: string | null
  currentUserType: 'individual' | 'coach' | null
}) {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')
  const [tab, setTab] = useState<'individual' | 'coach'>('individual')

  return (
    <div className="space-y-10">
      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setBilling('monthly')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            billing === 'monthly' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setBilling('annual')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
            billing === 'annual' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          Annual
          <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#FFF5D0', color: '#B08000' }}>
            Save 10%
          </span>
        </button>
      </div>

      {/* Individual / Coach tab */}
      <div className="flex justify-center gap-2">
        {(['individual', 'coach'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl text-sm font-medium transition-colors border ${
              tab === t ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-500 hover:border-gray-400'
            }`}
          >
            {t === 'individual' ? 'For Individuals' : 'For Coaches'}
          </button>
        ))}
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {(tab === 'individual' ? INDIVIDUAL_PLANS : COACH_PLANS).map((plan) => (
          <PlanCard
            key={plan.planKey}
            plan={plan}
            billing={billing}
            userType={tab}
            current={
              currentUserType === tab &&
              currentTier === plan.id
            }
          />
        ))}
        {tab === 'coach' && (
          <div className="flex flex-col rounded-2xl border border-dashed border-gray-200 p-6 items-center justify-center text-center gap-3">
            <span className="text-2xl">🚀</span>
            <h3 className="font-bold text-gray-900">Pro</h3>
            <p className="text-sm text-gray-400">Run a coaching business with multiple coaches, challenges, and education hubs.</p>
            <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">Coming soon</span>
          </div>
        )}
      </div>
    </div>
  )
}
