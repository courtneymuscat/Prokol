import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getStripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import type Stripe from 'stripe'

const PLAN_KEY_TO_TIER: Record<string, string> = {
  individual_tier_1: 'individual_free',
  individual_tier_2: 'individual_optimiser',
  individual_tier_3: 'individual_elite',
  individual_optimiser: 'individual_optimiser',
  individual_elite: 'individual_elite',
  coach_starter:     'coach_solo',
  coach_solo:        'coach_solo',
  coach_pro:         'coach_pro',
  coach_growth:      'coach_pro',
  coach_business:    'coach_business',
}

const PLAN_KEY_TO_USER_TYPE: Record<string, string> = {
  individual_tier_1: 'individual',
  individual_tier_2: 'individual',
  individual_tier_3: 'individual',
  individual_optimiser: 'individual',
  individual_elite: 'individual',
  coach_starter: 'coach',
  coach_solo:    'coach',
  coach_growth:  'coach',
  coach_pro:     'coach',
  coach_business: 'coach',
}

function fmt(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function SubscribeSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const { session_id } = await searchParams
  if (!session_id) redirect('/dashboard')

  const stripe = getStripe()
  let trialEnd: number | null = null
  let planName = 'your plan'

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['subscription'],
    })
    const { userId, planKey, userType } = session.metadata ?? {}

    let resolvedUserId = userId || ''
    if (!resolvedUserId) {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      resolvedUserId = user?.id ?? ''
    }

    if (resolvedUserId && planKey) {
      const tier = PLAN_KEY_TO_TIER[planKey] ?? 'individual_optimiser'
      const resolvedUserType = userType ?? PLAN_KEY_TO_USER_TYPE[planKey] ?? 'individual'
      const service = createServiceClient()
      await service.from('profiles').upsert({
        id: resolvedUserId,
        subscription_tier: tier,
        user_type: resolvedUserType,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription
          ? (typeof session.subscription === 'string' ? session.subscription : (session.subscription as Stripe.Subscription).id)
          : null,
      }, { onConflict: 'id' })
    }

    // Extract trial end from the expanded subscription
    const sub = session.subscription as Stripe.Subscription | null
    if (sub?.trial_end) trialEnd = sub.trial_end

    // Friendly plan name
    const tierKey = planKey ? (PLAN_KEY_TO_TIER[planKey] ?? planKey) : ''
    const TIER_NAMES: Record<string, string> = {
      individual_optimiser: 'Optimiser',
      individual_elite: 'Elite',
      coach_solo: 'Coach Solo',
      coach_pt_solo: 'Coach Solo',
      coach_nutritionist_solo: 'Coach Solo',
      coach_pro: 'Coach Pro',
      coach_business: 'Coach Business',
    }
    planName = TIER_NAMES[tierKey] ?? 'your plan'
  } catch (err) {
    console.error('Success page sync error:', err)
  }

  const trialEndDate = trialEnd ? fmt(trialEnd) : null

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border p-10 max-w-md w-full text-center space-y-6">
        {/* Check icon */}
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: 'rgba(29,158,117,0.08)' }}>
          <svg className="w-8 h-8" fill="none" stroke="#1D9E75" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {trialEndDate ? 'Your free trial has started!' : "You're all set!"}
          </h1>
          <p className="text-gray-500 mt-2 text-sm">
            {trialEndDate
              ? `Welcome to Prokol ${planName}. Enjoy full access — no charge until your trial ends.`
              : `Your ${planName} subscription is now active. Welcome to Prokol.`}
          </p>
        </div>

        {/* Trial detail card */}
        {trialEndDate && (
          <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4 space-y-3 text-left">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Trial ends</span>
              <span className="font-semibold text-gray-900">{trialEndDate}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">First payment</span>
              <span className="font-semibold text-gray-900">{trialEndDate}</span>
            </div>
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-400 leading-relaxed">
                You won&apos;t be charged until <strong className="text-gray-600">{trialEndDate}</strong>. Cancel any time before then in Settings → Billing and you&apos;ll never pay a cent.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Link
            href="/dashboard"
            className="block w-full py-3 rounded-xl text-sm font-semibold text-center text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#1D9E75' }}
          >
            Go to dashboard →
          </Link>
          <Link
            href="/settings"
            className="block w-full py-3 rounded-xl text-sm font-semibold text-center border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            View billing & subscription
          </Link>
        </div>
      </div>
    </div>
  )
}
