'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const arr = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i)
  return arr.buffer
}

/**
 * Silently registers a push subscription for the current user once they've
 * granted notification permission. Shows a prompt banner if permission is
 * 'default' (not yet asked). Does nothing if VAPID key is not configured.
 */
export default function PushSetup() {
  const pathname = usePathname()
  const isCoach = pathname?.startsWith('/coach')
  const [permission, setPermission] = useState<NotificationPermission | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!VAPID_PUBLIC_KEY || typeof window === 'undefined' || !('Notification' in window)) return
    setPermission(Notification.permission)

    // If already granted, register subscription silently
    if (Notification.permission === 'granted') {
      registerSubscription().catch(() => {/* silent */})
    }
  }, [])

  async function registerSubscription() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint, keys: { p256dh: sub.toJSON().keys?.p256dh, auth: sub.toJSON().keys?.auth } }),
    })
  }

  async function handleEnable() {
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result === 'granted') {
      await registerSubscription().catch(() => {/* silent */})
    }
    setDismissed(true)
  }

  // Don't render anything if:
  // - VAPID not configured
  // - Push not supported
  // - Already granted or denied
  // - User dismissed the banner
  if (
    !VAPID_PUBLIC_KEY ||
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    permission !== 'default' ||
    dismissed
  ) {
    return null
  }

  return (
    <div className={`fixed ${isCoach ? 'bottom-20 md:bottom-4' : 'bottom-20'} left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm`}>
      <div className="bg-gray-900 text-white rounded-2xl px-4 py-3 shadow-xl flex items-center gap-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold">Enable notifications</p>
          <p className="text-xs text-gray-400 leading-tight mt-0.5">
            {isCoach ? 'Get notified when clients check in or message you' : 'Get notified about new messages from your coach'}
          </p>
        </div>
        <div className="flex flex-col gap-1 flex-shrink-0">
          <button
            onClick={handleEnable}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg text-gray-900"
            style={{ backgroundColor: '#1D9E75' }}
          >
            Enable
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="text-xs text-gray-500 hover:text-gray-300 text-center"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
