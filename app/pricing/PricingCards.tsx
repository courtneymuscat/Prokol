'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { INDIVIDUAL_PLANS, COACH_SOLO_PLANS, COACH_PLANS, type PricingPlan } from '@/lib/features'

function CheckIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="#1D9E75" strokeWidth={2.5} viewBox="0 0 24 24">
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
  // Coach plans are always monthly
  const effectiveBilling = plan.isMonthlyOnly ? 'monthly' : billing
  const displayPrice = effectiveBilling === 'annual' ? plan.priceAnnualMonthly : plan.priceMonthly

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
        body: JSON.stringify({ planKey: plan.planKey, billing: effectiveBilling, userType }),
      })
      if (res.status === 401 || res.status === 403) {
        router.push(`/signup?plan=${plan.planKey}&billing=${effectiveBilling}&type=${userType}`)
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
      plan.highlighted ? 'border-[#1D9E75] shadow-lg' : 'border-gray-200'
    }`}>
      {plan.highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="text-xs font-semibold px-3 py-1 rounded-full text-gray-900" style={{ backgroundColor: '#1D9E75' }}>
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
      </div>

      <div className="mb-4">
        {isFree ? (
          <p className="text-4xl font-bold text-gray-900">Free</p>
        ) : (
          <div>
            <div className="flex items-end gap-1">
              <span className="text-4xl font-bold text-gray-900">${displayPrice}</span>
              <span className="text-gray-400 text-sm mb-1">AUD/mo</span>
            </div>
            {effectiveBilling === 'annual' && (
              <p className="text-xs text-gray-400 mt-0.5">Billed annually — save 10%</p>
            )}
            {plan.isMonthlyOnly && (
              <p className="text-xs text-gray-400 mt-0.5">Billed monthly</p>
            )}
          </div>
        )}
      </div>

      {/* Overage pricing callout */}
      {(plan.clientOveragePrice || plan.coachOveragePrice) && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 space-y-0.5">
          <p className="text-xs font-semibold text-amber-800">Additional usage</p>
          {plan.clientOveragePrice && plan.includedClients && (
            <p className="text-xs text-amber-700">
              Over {plan.includedClients} clients: +${plan.clientOveragePrice}/client/mo — billed automatically
            </p>
          )}
          {plan.coachOveragePrice && plan.includedCoaches && (
            <p className="text-xs text-amber-700">
              Over {plan.includedCoaches} coaches: +${plan.coachOveragePrice}/coach/mo — billed automatically
            </p>
          )}
        </div>
      )}

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
          style={plan.highlighted ? { backgroundColor: '#1D9E75' } : undefined}
        >
          {loading ? 'Loading…' : isFree ? 'Get started free' : `Get ${plan.name.split(' — ')[0]}`}
        </button>
      )}
    </div>
  )
}

// Solo specialisation picker — shown before PT/Nutritionist cards
function SoloSection({
  billing,
  currentTier,
}: {
  billing: 'monthly' | 'annual'
  currentTier: string | null
}) {
  const [expanded, setExpanded] = useState(false)

  const isCurrent = currentTier === 'coach_pt_solo' || currentTier === 'coach_nutritionist_solo' || currentTier === 'coach_solo'

  if (!expanded) {
    return (
      <div
        className={`relative rounded-2xl border-2 border-dashed p-6 cursor-pointer hover:border-gray-400 transition-colors ${
          isCurrent ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white hover:bg-gray-50'
        }`}
        onClick={() => setExpanded(true)}
      >
        {isCurrent && (
          <div className="absolute -top-3 right-4">
            <span className="bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
              Current plan
            </span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Solo — $49 AUD/mo</h3>
            <p className="text-xs text-gray-400 mt-0.5">5 clients included · +$4/mo per extra client</p>
            <p className="text-xs text-gray-500 mt-2">Choose your specialisation: Personal Trainer or Nutritionist</p>
          </div>
          <span className="text-2xl">→</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Solo — choose your specialisation</h3>
        <button
          onClick={() => setExpanded(false)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          ← Back
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {COACH_SOLO_PLANS.map((plan) => (
          <PlanCard
            key={plan.planKey}
            plan={plan}
            billing={billing}
            userType="coach"
            current={currentTier === plan.id}
          />
        ))}
      </div>
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

  // Switch to monthly when moving to coach tab (coach plans are monthly only)
  function handleTabChange(t: 'individual' | 'coach') {
    setTab(t)
    if (t === 'coach') setBilling('monthly')
  }

  return (
    <div className="space-y-10">
      {/* Billing toggle — individual only */}
      {tab === 'individual' && (
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
            <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: 'rgba(29,158,117,0.08)', color: '#B08000' }}>
              Save 10%
            </span>
          </button>
        </div>
      )}

      {tab === 'coach' && (
        <div className="flex justify-center">
          <p className="text-xs text-gray-400 bg-gray-50 px-4 py-2 rounded-full">
            Coach plans are billed monthly
          </p>
        </div>
      )}

      {/* Individual / Coach tab */}
      <div className="flex justify-center gap-2">
        {(['individual', 'coach'] as const).map((t) => (
          <button
            key={t}
            onClick={() => handleTabChange(t)}
            className={`px-5 py-2 rounded-xl text-sm font-medium transition-colors border ${
              tab === t ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-500 hover:border-gray-400'
            }`}
          >
            {t === 'individual' ? 'For Individuals' : 'For Coaches'}
          </button>
        ))}
      </div>

      {/* Plan cards */}
      {tab === 'individual' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {INDIVIDUAL_PLANS.map((plan) => (
            <PlanCard
              key={plan.planKey}
              plan={plan}
              billing={billing}
              userType="individual"
              current={currentUserType === 'individual' && currentTier === plan.id}
            />
          ))}
        </div>
      ) : (
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Solo specialisation picker */}
          <SoloSection
            billing={billing}
            currentTier={currentTier}
          />

          {/* Pro + Business + WL */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {COACH_PLANS.slice(0, 2).map((plan) => (
              <PlanCard
                key={plan.planKey}
                plan={plan}
                billing={billing}
                userType="coach"
                current={currentTier === plan.id}
              />
            ))}
          </div>

          {/* White-label */}
          <div className="border-t pt-6 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">White-label</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {COACH_PLANS.slice(2).map((plan) => (
                <PlanCard
                  key={plan.planKey}
                  plan={plan}
                  billing={billing}
                  userType="coach"
                  current={currentTier === plan.id}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Downgrade notice */}
      <p className="text-center text-xs text-gray-400 max-w-lg mx-auto">
        You can change or cancel your plan at any time. Cancelling moves your account to the free Tracker plan.
        {' '}Coaches: your clients will also move to the free Tracker plan, but all their data is saved.
      </p>
    </div>
  )
}
