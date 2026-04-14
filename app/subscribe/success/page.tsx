import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getStripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

const PLAN_KEY_TO_TIER: Record<string, string> = {
  individual_tier_1: 'individual_free',
  individual_tier_2: 'individual_optimiser',
  individual_tier_3: 'individual_elite',
  coach_starter:     'coach_solo',
  coach_growth:      'coach_pro',
  coach_business:    'coach_business',
}

const PLAN_KEY_TO_USER_TYPE: Record<string, string> = {
  individual_tier_1: 'individual',
  individual_tier_2: 'individual',
  individual_tier_3: 'individual',
  coach_starter: 'coach',
  coach_growth: 'coach',
}

export default async function SubscribeSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const { session_id } = await searchParams

  if (session_id) {
    try {
      const stripe = getStripe()
      const session = await stripe.checkout.sessions.retrieve(session_id)
      const { userId, planKey, userType } = session.metadata ?? {}

      // If webhook already ran with a userId, skip. Otherwise use the logged-in user.
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
          stripe_subscription_id: session.subscription as string,
        }, { onConflict: 'id' })
      }
    } catch (err) {
      console.error('Success page sync error:', err)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border p-10 max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: '#FFF5D0' }}>
          <svg className="w-8 h-8" fill="none" stroke="#FFD885" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">You&apos;re all set!</h1>
          <p className="text-gray-500 mt-2 text-sm">
            Your subscription is now active. Welcome to Prokol — let&apos;s get you started.
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/dashboard"
            className="block w-full py-3 rounded-xl text-sm font-semibold text-center text-gray-900 transition-colors"
            style={{ backgroundColor: '#FFD885' }}
          >
            Go to dashboard →
          </Link>
          <Link
            href="/onboarding"
            className="block w-full py-3 rounded-xl text-sm font-semibold text-center border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Complete onboarding first
          </Link>
        </div>
      </div>
    </div>
  )
}
