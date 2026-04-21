'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

const STALE_MS = 30 * 1000       // refresh if hidden for 30+ seconds
const POLL_MS  = 90 * 1000       // refresh every 90s while visible

export default function AppRefresh() {
  const router = useRouter()
  const hiddenAt = useRef<number | null>(null)

  useEffect(() => {
    // Visibility-change refresh (handles lock screen / app switch)
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now()
      } else if (document.visibilityState === 'visible' && hiddenAt.current) {
        if (Date.now() - hiddenAt.current > STALE_MS) router.refresh()
        hiddenAt.current = null
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    // Periodic background poll — keeps data live while the app is open
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, POLL_MS)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      clearInterval(interval)
    }
  }, [router])

  return null
}
