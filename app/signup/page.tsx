'use client'

import { useActionState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signup } from '@/app/actions/auth'
import { useBranding } from '@/app/components/BrandingProvider'

const PLAN_LABELS: Record<string, string> = {
  individual_tier_2:    'Optimiser — $19.99 AUD/mo',
  individual_tier_3:    'Elite — $34.99 AUD/mo',
  individual_optimiser: 'Optimiser — $19.99 AUD/mo',
  individual_elite:     'Elite — $34.99 AUD/mo',
  coach_solo:           'Coach Solo — $49 AUD/mo',
  coach_pro:            'Coach Pro — $99 AUD/mo',
  coach_business:       'Coach Business — $199 AUD/mo',
}

function SignupForm() {
  const branding = useBranding()
  const [state, action, pending] = useActionState(signup, null)
  const searchParams = useSearchParams()
  const invite = searchParams.get('invite')
  const planKey = searchParams.get('plan') ?? ''
  const billing = searchParams.get('billing') ?? 'monthly'
  const type = searchParams.get('type') ?? 'individual'
  const isCoach = type === 'coach'
  const planLabel = PLAN_LABELS[planKey]

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-8 space-y-6">
        <div>
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.appName} className="h-8 object-contain" />
          ) : (
            <Link href="/" className="text-xl font-bold text-gray-900">{branding.appName}</Link>
          )}
          <h1 className="text-2xl font-bold mt-4 text-gray-900">
            {invite ? 'Accept your invite' : isCoach ? 'Start coaching' : 'Create your account'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {invite
              ? 'Create an account to accept your coaching invite.'
              : planLabel
              ? `You selected: ${planLabel}`
              : 'Start tracking your nutrition, workouts, and cycle for free.'}
          </p>
        </div>

        {planLabel && (
          <div className="flex items-center gap-2 text-sm rounded-xl px-4 py-3 border" style={{ backgroundColor: '#FFFBF0', borderColor: '#FFE9A8' }}>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="#B08000" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-yellow-800">After signing up you&apos;ll be taken to checkout to complete your subscription.</span>
          </div>
        )}

        <form action={action} className="space-y-4">
          {invite && <input type="hidden" name="invite" value={invite} />}
          {planKey && <input type="hidden" name="planKey" value={planKey} />}
          {billing && <input type="hidden" name="billing" value={billing} />}
          {type && <input type="hidden" name="userType" value={type} />}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              placeholder="Min. 6 characters"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>

          {state?.error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
              {state.error === 'EMAIL_ALREADY_EXISTS' ? (
                <>
                  An account with this email already exists.{' '}
                  <Link href="/login?redirect=/pricing" className="underline font-medium">
                    Log in instead.
                  </Link>
                </>
              ) : (
                state.error
              )}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full py-3 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-colors"
            style={{ backgroundColor: 'var(--brand-primary)', color: 'var(--brand-text)' }}
          >
            {pending ? 'Creating account…' : planLabel ? 'Create account & continue to checkout' : 'Create free account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link href={invite ? `/login?invite=${invite}` : '/login'} className="text-gray-900 font-medium hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}
