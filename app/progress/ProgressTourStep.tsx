'use client'

import { useState, useEffect } from 'react'
import TourStepOverlay from '@/app/components/TourStepOverlay'
import { TOUR_NEXT_KEY, TOUR_KEY, TOUR_TOTAL_STEPS } from '@/app/dashboard/DashboardTour'

// Final leg of the tour, continued from ResourcesTourStep's handoff.
export default function ProgressTourStep() {
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(TOUR_NEXT_KEY) === 'progress') setActive(true)
  }, [])

  function finish() {
    localStorage.setItem(TOUR_KEY, '1')
    localStorage.removeItem(TOUR_NEXT_KEY)
    setActive(false)
  }

  if (!active) return null

  return (
    <TourStepOverlay
      targetId="tour-progress-photos"
      waitForTarget
      step={{
        emoji: '📸',
        title: 'Progress photos',
        body: "Upload photos weekly to see visual changes the scale can't show — your coach can see these too. That's everything — you're all set!",
        cta: "Let's go! →",
        tooltipSide: 'above',
      }}
      stepIndex={8}
      totalSteps={TOUR_TOTAL_STEPS}
      onAdvance={finish}
      onDismiss={finish}
    />
  )
}
