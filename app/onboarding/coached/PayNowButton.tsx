'use client'

import { useEffect } from 'react'
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

  useEffect(() => {
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
    window.open(paymentLink, '_blank', 'noopener,noreferrer')
  }

  return (
    <button
      onClick={handleClick}
      className="block w-full text-center py-2.5 rounded-xl text-sm font-semibold text-gray-900 transition-colors"
      style={{ backgroundColor: '#FFD885' }}
    >
      Pay now →
    </button>
  )
}
