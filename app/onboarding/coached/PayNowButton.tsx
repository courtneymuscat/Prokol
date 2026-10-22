'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const STORAGE_KEY = 'payment_initiated'

export default function PayNowButton({
  paymentLink,
  afterPayUrl,
}: {
  paymentLink: string
  afterPayUrl: string
}) {
  const router = useRouter()
  const [initiated, setInitiated] = useState(false)

  useEffect(() => {
    // If the user already kicked off payment in a previous render (page
    // refresh, navigation back), restore the waiting state from sessionStorage
    // so they still see the "come back here" prompt.
    if (sessionStorage.getItem(STORAGE_KEY)) {
      setInitiated(true)
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && sessionStorage.getItem(STORAGE_KEY)) {
        sessionStorage.removeItem(STORAGE_KEY)
        router.push(afterPayUrl)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [afterPayUrl, router])

  function handleClick() {
    sessionStorage.setItem(STORAGE_KEY, '1')
    setInitiated(true)
    window.open(paymentLink, '_blank', 'noopener,noreferrer')
  }

  function reopenCheckout() {
    window.open(paymentLink, '_blank', 'noopener,noreferrer')
  }

  if (initiated) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-900 space-y-1">
          <p className="font-semibold">Checkout opened in a new tab</p>
          <p className="text-xs text-green-800 leading-relaxed">
            Complete your payment there, then <strong>come back to this tab</strong>.
            We&apos;ll finish your signup automatically as soon as you return.
          </p>
        </div>
        <button
          onClick={reopenCheckout}
          className="block w-full text-center py-2 rounded-xl text-xs font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          Re-open checkout if you closed it
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleClick}
      className="block w-full text-center py-2.5 rounded-xl text-sm font-semibold text-gray-900 transition-colors"
      style={{ backgroundColor: 'var(--nc-primary)' }}
    >
      Pay now →
    </button>
  )
}
