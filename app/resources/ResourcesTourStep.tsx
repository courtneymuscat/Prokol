'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import TourStepOverlay from '@/app/components/TourStepOverlay'
import { TOUR_NEXT_KEY, TOUR_KEY, TOUR_TOTAL_STEPS } from '@/app/dashboard/DashboardTour'

// Continues the dashboard tour onto this page — see DashboardTour's
// advance() for the handoff. Only shows if the client is mid-tour and
// actually has resources assigned (no point spotlighting an empty list).
export default function ResourcesTourStep({ hasResources }: { hasResources: boolean }) {
  const router = useRouter()
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (hasResources && localStorage.getItem(TOUR_NEXT_KEY) === 'resources') setActive(true)
  }, [hasResources])

  if (!active) return null

  return (
    <TourStepOverlay
      targetId="tour-resources-search"
      waitForTarget
      step={{
        emoji: '📚',
        title: 'Your resources',
        body: 'Every guide, video and PDF your coach shares lives here. Search by name or filter by type to find anything fast.',
        cta: 'Next: Progress Photos →',
        tooltipSide: 'below',
      }}
      stepIndex={7}
      totalSteps={TOUR_TOTAL_STEPS}
      onAdvance={() => {
        localStorage.setItem(TOUR_NEXT_KEY, 'progress')
        setActive(false)
        router.push('/progress')
      }}
      onDismiss={() => {
        localStorage.setItem(TOUR_KEY, '1')
        localStorage.removeItem(TOUR_NEXT_KEY)
        setActive(false)
      }}
    />
  )
}
