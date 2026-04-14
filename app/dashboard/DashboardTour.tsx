'use client'

import { useState, useEffect, useCallback, useLayoutEffect } from 'react'

const TOUR_KEY = 'prokol_tour_done'
const PAD = 10 // spotlight padding around target

type Step = {
  targetId: string | null
  emoji: string
  title: string
  body: string
  cta: string
  tooltipSide?: 'above' | 'below' | 'auto'
}

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
    body: 'Tap here to log everything you eat. Search foods, scan barcodes, or use AI to photograph a meal.',
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
    targetId: 'tour-settings',
    emoji: '⚙️',
    title: 'Settings up here',
    body: 'Tap Settings to update your profile, timezone and progress photos.',
    cta: "Let's go! →",
    tooltipSide: 'below',
  },
]

type Rect = { top: number; left: number; width: number; height: number }

function getRect(id: string): Rect | null {
  const el = document.getElementById(id)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

export default function DashboardTour() {
  const [stepIndex, setStepIndex] = useState<number | null>(null)
  const [rect, setRect] = useState<Rect | null>(null)
  const [vh, setVh] = useState(0)
  const [vw, setVw] = useState(0)

  // Check localStorage on mount
  useEffect(() => {
    if (!localStorage.getItem(TOUR_KEY)) setStepIndex(0)
  }, [])

  // Update viewport size
  useEffect(() => {
    function onResize() { setVh(window.innerHeight); setVw(window.innerWidth) }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const step = stepIndex !== null ? STEPS[stepIndex] : null

  // Scroll target into view, then measure its rect
  const measureTarget = useCallback((targetId: string | null) => {
    if (!targetId) { setRect(null); return }
    const el = document.getElementById(targetId)
    if (!el) { setRect(null); return }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // Wait for scroll to settle before measuring
    setTimeout(() => {
      const r = getRect(targetId)
      setRect(r)
    }, 400)
  }, [])

  useEffect(() => {
    if (step) measureTarget(step.targetId)
    else setRect(null)
  }, [step, measureTarget])

  // Re-measure on scroll / resize
  useLayoutEffect(() => {
    if (!step?.targetId) return
    function update() {
      const r = getRect(step!.targetId!)
      setRect(r)
    }
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [step])

  function advance() {
    if (stepIndex === null) return
    if (stepIndex >= STEPS.length - 1) {
      localStorage.setItem(TOUR_KEY, '1')
      setStepIndex(null)
    } else {
      setStepIndex(stepIndex + 1)
    }
  }

  function dismiss() {
    localStorage.setItem(TOUR_KEY, '1')
    setStepIndex(null)
  }

  if (stepIndex === null || !step) return null

  // ── Spotlight geometry ──────────────────────────────────────────────────
  const hasTarget = !!step.targetId && !!rect
  const sp = hasTarget && rect ? {
    top:    rect.top    - PAD,
    left:   rect.left   - PAD,
    width:  rect.width  + PAD * 2,
    height: rect.height + PAD * 2,
  } : null

  // ── Tooltip positioning ─────────────────────────────────────────────────
  let tooltipStyle: React.CSSProperties = {}
  let arrowStyle: React.CSSProperties = {}
  let arrowClass = ''

  const TOOLTIP_W = Math.min(320, vw - 32)
  const TOOLTIP_MARGIN = 12

  if (!hasTarget || !sp) {
    // Centred on screen
    tooltipStyle = {
      position: 'fixed',
      bottom: 24,
      left: '50%',
      transform: 'translateX(-50%)',
      width: TOOLTIP_W,
    }
  } else {
    // Determine side
    const spaceBelow = vh - (sp.top + sp.height)
    const spaceAbove = sp.top
    const preferredSide = step.tooltipSide === 'above' ? 'above'
      : step.tooltipSide === 'below' ? 'below'
      : spaceBelow >= 200 ? 'below' : 'above'

    const centreX = sp.left + sp.width / 2
    const tooltipLeft = Math.max(16, Math.min(centreX - TOOLTIP_W / 2, vw - TOOLTIP_W - 16))
    const arrowLeft = Math.max(20, Math.min(centreX - tooltipLeft - 10, TOOLTIP_W - 30))

    if (preferredSide === 'below') {
      tooltipStyle = {
        position: 'fixed',
        top: sp.top + sp.height + TOOLTIP_MARGIN,
        left: tooltipLeft,
        width: TOOLTIP_W,
      }
      arrowStyle = { left: arrowLeft, top: -8, borderWidth: '0 8px 8px 8px', borderColor: 'transparent transparent white transparent' }
      arrowClass = 'absolute border-solid'
    } else {
      tooltipStyle = {
        position: 'fixed',
        bottom: vh - sp.top + TOOLTIP_MARGIN,
        left: tooltipLeft,
        width: TOOLTIP_W,
      }
      arrowStyle = { left: arrowLeft, bottom: -8, borderWidth: '8px 8px 0 8px', borderColor: 'white transparent transparent transparent' }
      arrowClass = 'absolute border-solid'
    }
  }

  return (
    <>
      {/* Dark overlay — rendered as 4 rects around the spotlight so the target stays tappable */}
      {sp ? (
        <>
          {/* Top */}
          <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 49, bottom: vh - sp.top, backgroundColor: 'rgba(0,0,0,0.55)' }} />
          {/* Bottom */}
          <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 49, top: sp.top + sp.height, backgroundColor: 'rgba(0,0,0,0.55)' }} />
          {/* Left */}
          <div className="fixed pointer-events-none" style={{ zIndex: 49, top: sp.top, left: 0, width: sp.left, height: sp.height, backgroundColor: 'rgba(0,0,0,0.55)' }} />
          {/* Right */}
          <div className="fixed pointer-events-none" style={{ zIndex: 49, top: sp.top, left: sp.left + sp.width, right: 0, height: sp.height, backgroundColor: 'rgba(0,0,0,0.55)' }} />
          {/* Spotlight ring */}
          <div className="fixed pointer-events-none" style={{ zIndex: 50, top: sp.top, left: sp.left, width: sp.width, height: sp.height, borderRadius: 16, boxShadow: '0 0 0 3px #FFD885', transition: 'all 0.35s ease' }} />
        </>
      ) : (
        // Full backdrop for intro/outro step
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" style={{ zIndex: 49 }} onClick={dismiss} />
      )}

      {/* Tooltip card */}
      <div style={{ ...tooltipStyle, zIndex: 51 }} className="pointer-events-auto">
        {/* Arrow */}
        {arrowClass && <div className={arrowClass} style={{ ...arrowStyle, width: 0, height: 0 }} />}

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Progress dots */}
          <div className="flex gap-1.5 justify-center pt-4 pb-0.5">
            {STEPS.map((_, i) => (
              <div key={i} className="h-1.5 rounded-full transition-all duration-300" style={{
                width: i === stepIndex ? '18px' : '6px',
                backgroundColor: i <= stepIndex ? '#FFD885' : '#e5e7eb',
              }} />
            ))}
          </div>

          <div className="px-5 py-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ backgroundColor: '#FFF9E6' }}>
                {step.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">{step.title}</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{step.body}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={dismiss} className="flex-1 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
                Skip
              </button>
              <button
                onClick={advance}
                className="flex-[2] py-2 rounded-xl text-sm font-bold text-gray-900 transition-colors"
                style={{ backgroundColor: '#FFD885' }}
              >
                {step.cta}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
