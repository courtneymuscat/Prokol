'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import TourStepOverlay, { type TourStepContent } from '@/app/components/TourStepOverlay'

export const TOUR_KEY = 'prokol_tour_done'
export const TOUR_NEXT_KEY = 'prokol_tour_next'
export const TOUR_TOTAL_STEPS = 9 // 7 here + Resources + Progress Photos

type Step = TourStepContent & { targetId: string | null }

const STEPS: Step[] = [
  {
    targetId: null,
    emoji: '👋',
    title: "Welcome to Prokol!",
    body: "Let me show you exactly where everything lives. Tap the highlighted areas as I point them out.",
    cta: 'Start tour →',
  },
  {
    targetId: 'tour-targets',
    emoji: '🎯',
    title: 'Your daily targets',
    body: 'These are your personalised calorie and macro targets — tap this card to see the breakdown.',
    cta: 'Got it →',
    tooltipSide: 'below',
  },
  {
    targetId: 'tour-weight',
    emoji: '⚖️',
    title: 'Weight tracking',
    body: 'Log your weight here daily. Day-to-day changes are normal — watch the trend over weeks, not days.',
    cta: 'Got it →',
    tooltipSide: 'above',
  },
  {
    targetId: 'tour-food-log',
    emoji: '🍽️',
    title: 'Food log',
    body: 'Tap here to log everything you eat. Search foods or scan barcodes to add them in seconds.',
    cta: 'Got it →',
    tooltipSide: 'above',
  },
  {
    targetId: 'daily-checkin',
    emoji: '📋',
    title: 'Daily check-in',
    body: 'Rate your sleep, energy, stress and hunger daily. Your coach uses this to track how you\'re really doing.',
    cta: 'Got it →',
    tooltipSide: 'above',
  },
  {
    targetId: 'tour-calendar',
    emoji: '📅',
    title: 'Your calendar',
    body: 'View your training programs here — see every session your coach has scheduled. You can also add your own activities or events.',
    cta: 'Got it →',
    tooltipSide: 'above',
  },
  {
    targetId: 'tour-settings',
    emoji: '⚙️',
    title: 'Settings up here',
    body: 'Tap Settings to update your profile, timezone and progress photos.',
    cta: 'Next: Resources →',
    tooltipSide: 'below',
  },
]

export default function DashboardTour() {
  const router = useRouter()
  const [stepIndex, setStepIndex] = useState<number | null>(null)

  useEffect(() => {
    if (!localStorage.getItem(TOUR_KEY)) setStepIndex(0)
  }, [])

  const step = stepIndex !== null ? STEPS[stepIndex] : null

  function advance() {
    if (stepIndex === null) return
    if (stepIndex >= STEPS.length - 1) {
      // Hand off to the Resources page rather than finishing here — see
      // ResourcesTourStep, which picks this flag up on mount.
      localStorage.setItem(TOUR_NEXT_KEY, 'resources')
      setStepIndex(null)
      router.push('/resources')
      return
    }
    let next = stepIndex + 1
    while (next < STEPS.length - 1 && STEPS[next].targetId && !document.getElementById(STEPS[next].targetId!)) {
      next++
    }
    setStepIndex(next)
  }

  function dismiss() {
    localStorage.setItem(TOUR_KEY, '1')
    localStorage.removeItem(TOUR_NEXT_KEY)
    setStepIndex(null)
  }

  if (stepIndex === null || !step) return null

  return (
    <TourStepOverlay
      targetId={step.targetId}
      step={step}
      stepIndex={stepIndex}
      totalSteps={TOUR_TOTAL_STEPS}
      onAdvance={advance}
      onDismiss={dismiss}
    />
  )
}
