'use client'

import { useState, useEffect } from 'react'

const TEMPLATE_TOS_URL = '/prokol-tos-template.html'
const STORAGE_KEY = 'payment_initiated'

type Service = {
  name: string
  payment_link: string | null
  price_label: string | null
  description: string | null
  tos_url: string | null
}

export default function InviteFlow({
  token,
  email,
  displayName,
  coachName,
  logoUrl,
  brandColour,
  service,
}: {
  token: string
  email: string
  displayName: string
  coachName: string
  logoUrl: string | null
  brandColour: string | null
  service: Service | null
}) {
  const hasService = !!service
  const hasPayment = !!service?.payment_link
  const [step, setStep] = useState<'terms_pay' | 'choose_account'>(
    hasService ? 'terms_pay' : 'choose_account'
  )
  const [accepted, setAccepted] = useState(false)

  const effectiveTosUrl = service?.tos_url ?? TEMPLATE_TOS_URL
  const isTemplate = !service?.tos_url

  // When returning from the Stripe payment tab, advance to account creation
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && sessionStorage.getItem(STORAGE_KEY)) {
        sessionStorage.removeItem(STORAGE_KEY)
        setStep('choose_account')
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  function handlePayNow() {
    sessionStorage.setItem(STORAGE_KEY, '1')
    window.open(service!.payment_link!, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Brand header */}
      <div className="mb-8 flex items-center gap-2">
        {logoUrl ? (
          <img src={logoUrl} alt={displayName} className="h-8 object-contain" />
        ) : (
          <span className="text-xl font-bold text-gray-900">{displayName}</span>
        )}
      </div>

      <div className="w-full max-w-md space-y-4">
        {/* Welcome card */}
        <div className="bg-white rounded-2xl border p-6 text-center space-y-3">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto text-2xl"
            style={{ backgroundColor: brandColour ? `${brandColour}22` : '#eff6ff' }}
          >
            ✨
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            {step === 'terms_pay'
              ? `Welcome to ${displayName}'s program`
              : `Join ${displayName}`}
          </h1>
          <p className="text-sm text-gray-500">
            {step === 'terms_pay'
              ? "You're almost in. Here's what you're signing up for."
              : 'Create your account to get started.'}
          </p>
        </div>

        {step === 'terms_pay' && service && (
          <>
            {/* Service details */}
            <div
              className="bg-white rounded-2xl border-2 p-5 space-y-3"
              style={{ borderColor: brandColour ?? '#e5e7eb' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 flex-1 min-w-0">
                  <p className="text-base font-bold text-gray-900">{service.name}</p>
                  {service.description && (
                    <p className="text-sm text-gray-500 leading-relaxed">{service.description}</p>
                  )}
                </div>
                {service.price_label && (
                  <span
                    className="flex-shrink-0 text-sm font-bold px-3 py-1 rounded-full"
                    style={{
                      backgroundColor: brandColour ? `${brandColour}18` : '#f0fdf4',
                      color: brandColour ?? '#15803d',
                    }}
                  >
                    {service.price_label}
                  </span>
                )}
              </div>
            </div>

            {/* TOS acceptance */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Terms of Service</p>
              {isTemplate && (
                <div className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
                  A coach-specific terms of service has not been uploaded. A standard Prokol Health template applies.
                </div>
              )}
              <a
                href={effectiveTosUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {isTemplate ? 'Prokol Template Terms of Service' : 'Read Terms of Service'} ↗
              </a>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                />
                <span className="text-sm text-gray-700 leading-snug group-hover:text-gray-900 transition-colors">
                  I have read and agree to the{' '}
                  <a href={effectiveTosUrl} target="_blank" rel="noopener noreferrer" className="underline font-medium">
                    Terms of Service
                  </a>
                  {' '}for this coaching program.
                </span>
              </label>
            </div>

            {/* Pay now or accept-only CTA */}
            {hasPayment ? (
              <div className={`bg-white rounded-2xl border border-gray-200 p-5 space-y-3 transition-opacity ${accepted ? '' : 'opacity-60'}`}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Next step</p>
                <p className="text-sm font-semibold text-gray-900">Complete payment to continue</p>
                {!accepted && (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
                    Please accept the Terms of Service above before proceeding to payment.
                  </p>
                )}
                <div className={accepted ? '' : 'pointer-events-none'}>
                  <button
                    onClick={handlePayNow}
                    className="w-full text-center py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: brandColour ?? '#1D9E75' }}
                  >
                    Pay now →
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <button
                  onClick={() => setStep('choose_account')}
                  disabled={!accepted}
                  className="w-full text-center py-3 rounded-2xl text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: brandColour ?? '#111827' }}
                >
                  Accept & create account →
                </button>
                {!accepted && (
                  <p className="text-xs text-center text-amber-600 mt-2">Accept the Terms of Service to continue.</p>
                )}
              </div>
            )}
          </>
        )}

        {step === 'choose_account' && (
          <div className="space-y-3">
            <a
              href={`/signup?invite=${token}`}
              className="block w-full text-center bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              Create an account
            </a>
            <a
              href={`/login?invite=${token}`}
              className="block w-full text-center border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              I already have an account
            </a>
          </div>
        )}

        <p className="text-xs text-center text-gray-400">
          This invite was sent to {email}.{' '}
          {step === 'choose_account' && `Questions? Contact ${coachName} directly.`}
        </p>
      </div>
    </div>
  )
}
