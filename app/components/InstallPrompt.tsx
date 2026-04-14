'use client'

import { useState, useEffect } from 'react'

type Platform = 'ios' | 'android' | null

export default function InstallPrompt() {
  const [platform, setPlatform] = useState<Platform>(null)
  const [deferredPrompt, setDeferredPrompt] = useState<Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> } | null>(null)
  const [dismissed, setDismissed] = useState(true) // start hidden, reveal after check

  useEffect(() => {
    // Already installed (running in standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) return
    // Already dismissed this session
    if (sessionStorage.getItem('pwa-dismissed')) return

    const ua = navigator.userAgent
    const isIOS = /iphone|ipad|ipod/i.test(ua)
    const isAndroid = /android/i.test(ua)
    const isMobile = isIOS || isAndroid

    if (!isMobile) return

    if (isIOS) {
      setPlatform('ios')
      setDismissed(false)
    }

    // Android — wait for the browser's beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> })
      setPlatform('android')
      setDismissed(false)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    sessionStorage.setItem('pwa-dismissed', '1')
    setDismissed(true)
  }

  async function install() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setDismissed(true)
    setDeferredPrompt(null)
  }

  if (dismissed || !platform) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-safe-bottom">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-4 mb-4 flex items-start gap-3">
        {/* App icon */}
        <img src="/icons/icon-192.png" alt="Prokol" className="w-12 h-12 rounded-2xl flex-shrink-0" />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900">Add Prokol to your home screen</p>

          {platform === 'ios' ? (
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Tap the <strong>Share</strong> button{' '}
              <svg className="inline w-3.5 h-3.5 text-blue-500 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>{' '}
              then <strong>Add to Home Screen</strong> for the full app experience.
            </p>
          ) : (
            <p className="text-xs text-gray-500 mt-1">Install for faster access, offline support, and no browser bar.</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <button onClick={dismiss} className="text-gray-300 hover:text-gray-500 p-0.5">
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
    </div>
  )
}
