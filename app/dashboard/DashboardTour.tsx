'use client'

import { useState, useEffect } from 'react'

const TOUR_KEY = 'nutricoach_tour_done'

const STEPS = [
  {
    emoji: '👋',
    title: 'Welcome to your dashboard!',
    body: "Let's take a quick tour so you know where everything is. It only takes 30 seconds.",
    cta: 'Show me around →',
  },
  {
    emoji: '🎯',
    title: 'Daily targets',
    body: 'Your personalised calorie and macro targets sit here. These are calculated from your stats and goal — protein first, always.',
    cta: 'Next →',
  },
  {
    emoji: '🍽️',
    title: 'Food log',
    body: 'Log everything you eat throughout the day. Search foods, scan barcodes, or build a meal from scratch. Your totals update in real time.',
    cta: 'Next →',
  },
  {
    emoji: '⚖️',
    title: 'Weight tracking',
    body: 'Log your weight each day and watch your trend over time. Day-to-day fluctuations are normal — the trend over weeks is what matters.',
    cta: 'Next →',
  },
  {
    emoji: '📋',
    title: 'Daily check-in',
    body: 'Rate your sleep, energy, stress, and hunger each day. This data helps your coach (or you) spot patterns that affect your progress.',
    cta: 'Next →',
  },
  {
    emoji: '⚙️',
    title: 'Settings',
    body: 'Find your profile, timezone, progress photos, and account settings in the top-right corner.',
    cta: "Let's go! →",
  },
]

export default function DashboardTour() {
  const [tourStep, setTourStep] = useState<number | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!localStorage.getItem(TOUR_KEY)) {
      setTourStep(0)
    }
  }, [])

  function advance() {
    if (tourStep === null) return
    if (tourStep >= STEPS.length - 1) {
      localStorage.setItem(TOUR_KEY, '1')
      setTourStep(null)
    } else {
      setTourStep(tourStep + 1)
    }
  }

  function dismiss() {
    localStorage.setItem(TOUR_KEY, '1')
    setTourStep(null)
  }

  if (tourStep === null) return null

  const step = STEPS[tourStep]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={dismiss}
      />

      {/* Card */}
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Progress dots */}
        <div className="flex gap-1.5 justify-center pt-5 pb-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === tourStep ? '20px' : '6px',
                backgroundColor: i <= tourStep ? '#FFD885' : '#e5e7eb',
              }}
            />
          ))}
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl" style={{ backgroundColor: '#FFF9E6' }}>
            {step.emoji}
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <p className="text-base font-bold text-gray-900">{step.title}</p>
            <p className="text-sm text-gray-500 leading-relaxed">{step.body}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={dismiss}
              className="flex-1 py-2.5 rounded-2xl text-sm font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Skip tour
            </button>
            <button
              onClick={advance}
              className="flex-[2] py-2.5 rounded-2xl text-sm font-bold text-gray-900 transition-colors"
              style={{ backgroundColor: '#FFD885' }}
            >
              {step.cta}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
