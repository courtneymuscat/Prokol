'use client'

import { useState, useEffect } from 'react'

const DISMISS_KEY = 'pwa-prompt-dismissed-at'
const COOLDOWN_DAYS = 3

type Platform = 'ios' | 'android' | null

export default function InstallPrompt() {
  const [platform, setPlatform] = useState<Platform>(null)
  const [deferredPrompt, setDeferredPrompt] = useState<Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> } | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Already running as installed PWA — never show
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (isStandalone) return

    // Check cooldown — don't re-prompt within COOLDOWN_DAYS of last dismiss
    const lastDismissed = localStorage.getItem(DISMISS_KEY)
    if (lastDismissed) {
      const daysSince = (Date.now() - Number(lastDismissed)) / (1000 * 60 * 60 * 24)
      if (daysSince < COOLDOWN_DAYS) return
    }

    const ua = navigator.userAgent
    const isIOS = /iphone|ipad|ipod/i.test(ua)
    const isAndroid = /android/i.test(ua)

    if (isIOS) {
      setPlatform('ios')
      // Small delay so it doesn't jar on first load
      setTimeout(() => setVisible(true), 2500)
      return
    }

    if (isAndroid) {
      const handler = (e: Event) => {
        e.preventDefault()
        setDeferredPrompt(e as Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> })
        setPlatform('android')
        setTimeout(() => setVisible(true), 2500)
      }
      window.addEventListener('beforeinstallprompt', handler)
      return () => window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setVisible(false)
  }

  async function install() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
      setVisible(false)
    }
    setDeferredPrompt(null)
  }

  if (!visible || !platform) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 animate-in slide-in-from-bottom duration-300">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 flex items-start gap-3">
        <img src="/icons/icon-192.png" alt="Prokol" className="w-12 h-12 rounded-2xl flex-shrink-0" />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900">Add Prokol to your Home Screen</p>

          {platform === 'ios' ? (
            <div className="mt-1.5 space-y-1">
              <p className="text-xs text-gray-500 leading-relaxed">
                Get the full app experience — no browser bar, faster access, works offline.
              </p>
              <div className="flex items-center gap-1.5 text-xs text-gray-600 mt-2">
                <span className="flex items-center gap-1">
                  <span>1. Tap</span>
                  {/* iOS share icon — box with arrow pointing up */}
                  <svg className="w-4 h-4 text-blue-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v13M7 7l5-5 5 5" />
                    <path d="M20 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5" />
                  </svg>
                  <span>below</span>
                </span>
                <span className="text-gray-300">·</span>
                <span>2. <strong>Add to Home Screen</strong></span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Install for faster access, offline support, and no browser bar.
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <button onClick={dismiss} className="text-gray-300 hover:text-gray-500 p-0.5" aria-label="Dismiss">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {platform === 'android' && (
            <button
              onClick={install}
              className="text-xs font-bold bg-gray-900 text-white px-3 py-1.5 rounded-xl hover:bg-gray-700 transition-colors"
            >
              Install
            </button>
          )}
        </div>
      </div>

      {/* Upward arrow pointing to the Safari share button at the bottom of the screen on iOS */}
      {platform === 'ios' && (
        <div className="flex justify-center mt-2">
          <svg className="w-6 h-6 text-gray-400 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      )}
    </div>
  )
}
