'use client'

import { useState } from 'react'

type TierOption = {
  planKey: string
  tier: string
  name: string
  price: string
  includedClients: number | null
  overageRate: number | null
  blurb: string
}

const COACH_OPTIONS: TierOption[] = [
  {
    planKey: 'coach_pt_solo',
    tier: 'coach_pt_solo',
    name: 'Solo — Personal Trainer',
    price: '$49 AUD/mo',
    includedClients: 5,
    overageRate: 4,
    blurb: 'For personal trainers with up to 5 clients. Workouts, programs, check-ins.',
  },
  {
    planKey: 'coach_nutritionist_solo',
    tier: 'coach_nutritionist_solo',
    name: 'Solo — Nutritionist',
    price: '$49 AUD/mo',
    includedClients: 5,
    overageRate: 4,
    blurb: 'For nutritionists with up to 5 clients. Meal plans, macros, serve guide.',
  },
  {
    planKey: 'coach_pro',
    tier: 'coach_pro',
    name: 'Coach Pro',
    price: '$99 AUD/mo',
    includedClients: 15,
    overageRate: 3,
    blurb: 'Full nutrition + training, up to 15 clients. The most popular plan.',
  },
  {
    planKey: 'coach_business',
    tier: 'coach_business',
    name: 'Coach Business',
    price: '$249 AUD/mo',
    includedClients: 75,
    overageRate: 3,
    blurb: 'Teams up to 75 clients. Adds organisation features and team coaches.',
  },
  {
    planKey: 'wl_starter',
    tier: 'wl_starter',
    name: 'Web White-label',
    price: '$299 AUD/mo',
    includedClients: 200,
    overageRate: 1.5,
    blurb: 'Everything in Business, fully white-labelled — your name, your branding, zero Prokol references.',
  },
]

const INDIVIDUAL_OPTIONS: TierOption[] = [
  {
    planKey: 'individual_tier_2',
    tier: 'individual_optimiser',
    name: 'Optimiser',
    price: '$19.99 AUD/mo',
    includedClients: null,
    overageRate: null,
    blurb: 'Weight trend chart, meal builder, saved meals, full daily check-in.',
  },
  {
    planKey: 'individual_tier_3',
    tier: 'individual_elite',
    name: 'Elite',
    price: '$34.99 AUD/mo',
    includedClients: null,
    overageRate: null,
    blurb: 'Everything in Optimiser plus AI meal scanner and advanced analytics.',
  },
]

export default function ChangePlanModal({
  open,
  currentTier,
  onClose,
  onSwitched,
}: {
  open: boolean
  currentTier: string
  onClose: () => void
  onSwitched: () => void
}) {
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmingPlanKey, setConfirmingPlanKey] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  if (!open) return null

  // wl_starter/wl_pro are white-label's own tiers, layered on top of
  // Business — this used to only recognise the plain coach_* tiers, so a
  // white-labelled coach opening "Change plan" fell through to the
  // individual tracker tiers (Optimiser/Elite) instead of their own
  // coach/business/white-label options.
  const isCoach =
    currentTier === 'coach_solo' ||
    currentTier === 'coach_pt_solo' ||
    currentTier === 'coach_nutritionist_solo' ||
    currentTier === 'coach_pro' ||
    currentTier === 'coach_business' ||
    currentTier === 'wl_starter' ||
    currentTier === 'wl_pro'

  const options = isCoach ? COACH_OPTIONS : INDIVIDUAL_OPTIONS
  const optionsLabel = isCoach ? 'Coach' : 'Individual'
  const confirming = options.find((o) => o.planKey === confirmingPlanKey) ?? null

  async function handleSwitch(planKey: string) {
    setSubmitting(planKey)
    setError(null)
    try {
      const res = await fetch('/api/stripe/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message ?? data.error ?? 'Could not change plan')
        setSubmitting(null)
        return
      }
      // Brief success state so the user sees confirmation before the page
      // reloads — otherwise the modal vanishes instantly and it's not
      // obvious anything happened.
      setSuccess(planKey)
      setTimeout(() => onSwitched(), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
      setSubmitting(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full my-8">
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900">Change your plan</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Prorated automatically — you&apos;ll be charged or credited the difference on your next invoice.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-1"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</div>
          )}

          {success && (
            <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5 flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>
                Plan switched. Stripe is processing the prorated charge and an email confirmation is on its way. <strong>Refreshing the page now…</strong>
              </span>
            </div>
          )}

          <div className="text-[11px] text-gray-400 bg-gray-50 rounded-xl px-3 py-2.5 leading-relaxed">
            On switch, your card is charged the prorated difference automatically (Stripe uses the card you signed up with) and the page will refresh once the change is confirmed.
          </div>

          <div className="space-y-3">
            {options.map((opt) => {
              const isCurrent = opt.tier === currentTier
              const isSubmittingThis = submitting === opt.planKey
              return (
                <div
                  key={opt.planKey}
                  className={`rounded-xl border p-4 ${isCurrent ? 'border-emerald-300 bg-emerald-50/40' : 'border-gray-200'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{opt.name}</p>
                        <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                          {optionsLabel}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{opt.price}</p>
                      <p className="text-xs text-gray-500 mt-1">{opt.blurb}</p>
                      {opt.includedClients !== null && (
                        <p className="text-[11px] text-gray-400 mt-1">
                          {opt.includedClients} clients included
                          {opt.overageRate !== null && ` · +A$${opt.overageRate}/client/mo over the limit`}
                        </p>
                      )}
                    </div>
                    {!isCurrent && (
                      <button
                        onClick={() => setConfirmingPlanKey(opt.planKey)}
                        disabled={!!submitting}
                        className="flex-shrink-0 text-xs font-semibold px-3 py-2 rounded-xl text-gray-900 disabled:opacity-50"
                        style={{ backgroundColor: '#1D9E75' }}
                      >
                        {isSubmittingThis ? 'Switching…' : 'Switch'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <p className="text-[11px] text-gray-400 text-center pt-1">
            Need to cancel instead?{' '}
            <button
              onClick={onClose}
              className="underline hover:text-gray-600"
            >
              Use Manage subscription
            </button>
          </p>
        </div>
      </div>

      {/* Confirm switch — second step so accidental clicks don't fire a charge */}
      {confirming && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <h4 className="text-base font-bold text-gray-900">Switch to {confirming.name}?</h4>
            <p className="text-sm text-gray-600">
              Your subscription will change to <strong>{confirming.name}</strong> ({confirming.price}) immediately. Stripe will prorate the difference and apply it to your next invoice.
            </p>
            {confirming.includedClients !== null && (
              <p className="text-xs text-gray-500">
                Your current clients are not affected. If you go over {confirming.includedClients} active clients, the extras are billed at A${confirming.overageRate}/mo each.
              </p>
            )}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmingPlanKey(null)}
                disabled={!!submitting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-300 text-gray-700 hover:border-gray-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSwitch(confirming.planKey)}
                disabled={!!submitting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-900 disabled:opacity-50"
                style={{ backgroundColor: '#1D9E75' }}
              >
                {submitting === confirming.planKey ? 'Switching…' : 'Confirm switch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
