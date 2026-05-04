'use client'

import { useState } from 'react'

// Stripe's default dunning window — retries over ~7 days before cancelling
const GRACE_DAYS = 7

export default function PaymentFailedBanner({ paymentFailedAt }: { paymentFailedAt: string }) {
  const [redirecting, setRedirecting] = useState(false)

  const failedDate = new Date(paymentFailedAt)
  const deadline = new Date(failedDate.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000)
  const now = new Date()
  const daysLeft = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))

  const deadlineStr = deadline.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  async function handleUpdate() {
    setRedirecting(true)
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnPath: '/dashboard' }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
        return
      }
    } catch { /* fall through */ }
    window.location.href = '/settings'
    setRedirecting(false)
  }

  return (
    <div className="w-full bg-red-600 text-white px-4 py-3">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <div>
            <p className="text-sm font-semibold">Payment failed</p>
            <p className="text-xs text-red-100 mt-0.5">
              {daysLeft > 0
                ? `Your account will be downgraded to the free plan on ${deadlineStr} (${daysLeft} day${daysLeft !== 1 ? 's' : ''} away) if payment is not resolved.`
                : `Your account is due to be downgraded today. Update your payment method immediately to keep access.`}
            </p>
          </div>
        </div>
        <button
          onClick={handleUpdate}
          disabled={redirecting}
          className="flex-shrink-0 text-xs font-bold px-4 py-2 rounded-xl bg-white text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60 whitespace-nowrap"
        >
          {redirecting ? 'Opening…' : 'Update payment method →'}
        </button>
      </div>
    </div>
  )
}
