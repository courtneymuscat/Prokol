'use client'

import { useState, useEffect, useLayoutEffect, useCallback } from 'react'

const PAD = 10

export type TourStepContent = {
  emoji: string
  title: string
  body: string
  cta: string
  tooltipSide?: 'above' | 'below' | 'auto'
}

type Rect = { top: number; left: number; width: number; height: number }

function getRect(id: string): Rect | null {
  const el = document.getElementById(id)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

/**
 * One spotlight+tooltip step, reusable across pages — DashboardTour drives
 * several of these in sequence on one page; ResourcesTourStep and
 * ProgressTourStep each drive a single one on their own page, picking up
 * where DashboardTour left off (see the shared 'prokol_tour_next'
 * localStorage handoff) so the tour feels continuous across navigation
 * without needing a single component mounted for the whole app.
 */
export default function TourStepOverlay({
  targetId,
  step,
  stepIndex,
  totalSteps,
  onAdvance,
  onDismiss,
  // Target element may not exist yet right after a fresh page navigation
  // (server render + hydration still in flight) — unlike same-page steps,
  // this has to poll rather than measure once after a fixed delay.
  waitForTarget = false,
}: {
  targetId: string | null
  step: TourStepContent
  stepIndex: number
  totalSteps: number
  onAdvance: () => void
  onDismiss: () => void
  waitForTarget?: boolean
}) {
  const [rect, setRect] = useState<Rect | null>(null)
  const [vh, setVh] = useState(0)
  const [vw, setVw] = useState(0)

  useEffect(() => {
    function onResize() { setVh(window.innerHeight); setVw(window.innerWidth) }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const measure = useCallback(() => {
    if (!targetId) { setRect(null); return }
    const el = document.getElementById(targetId)
    if (!el) { setRect(null); return false }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => setRect(getRect(targetId)), 400)
    return true
  }, [targetId])

  useEffect(() => {
    if (!targetId) { setRect(null); return }
    if (!waitForTarget) { measure(); return }
    let cancelled = false
    let tries = 0
    const poll = () => {
      if (cancelled) return
      if (measure() || tries++ > 20) return
      setTimeout(poll, 100)
    }
    poll()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, waitForTarget])

  useLayoutEffect(() => {
    if (!targetId) return
    function update() { setRect(getRect(targetId!)) }
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [targetId])

  const hasTarget = !!targetId && !!rect
  const sp = hasTarget && rect ? {
    top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2,
  } : null

  let tooltipStyle: React.CSSProperties = {}
  let arrowStyle: React.CSSProperties = {}
  let arrowClass = ''
  const TOOLTIP_W = Math.min(320, vw - 32)
  const TOOLTIP_MARGIN = 12

  if (!hasTarget || !sp) {
    tooltipStyle = { position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', width: TOOLTIP_W }
  } else {
    const spaceBelow = vh - (sp.top + sp.height)
    const preferredSide = step.tooltipSide === 'above' ? 'above' : step.tooltipSide === 'below' ? 'below' : spaceBelow >= 200 ? 'below' : 'above'
    const centreX = sp.left + sp.width / 2
    const tooltipLeft = Math.max(16, Math.min(centreX - TOOLTIP_W / 2, vw - TOOLTIP_W - 16))
    const arrowLeft = Math.max(20, Math.min(centreX - tooltipLeft - 10, TOOLTIP_W - 30))

    if (preferredSide === 'below') {
      tooltipStyle = { position: 'fixed', top: sp.top + sp.height + TOOLTIP_MARGIN, left: tooltipLeft, width: TOOLTIP_W }
      arrowStyle = { left: arrowLeft, top: -8, borderWidth: '0 8px 8px 8px', borderColor: 'transparent transparent white transparent' }
      arrowClass = 'absolute border-solid'
    } else {
      tooltipStyle = { position: 'fixed', bottom: vh - sp.top + TOOLTIP_MARGIN, left: tooltipLeft, width: TOOLTIP_W }
      arrowStyle = { left: arrowLeft, bottom: -8, borderWidth: '8px 8px 0 8px', borderColor: 'white transparent transparent transparent' }
      arrowClass = 'absolute border-solid'
    }
  }

  return (
    <>
      {sp ? (
        <>
          <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 49, bottom: vh - sp.top, backgroundColor: 'rgba(0,0,0,0.55)' }} />
          <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 49, top: sp.top + sp.height, backgroundColor: 'rgba(0,0,0,0.55)' }} />
          <div className="fixed pointer-events-none" style={{ zIndex: 49, top: sp.top, left: 0, width: sp.left, height: sp.height, backgroundColor: 'rgba(0,0,0,0.55)' }} />
          <div className="fixed pointer-events-none" style={{ zIndex: 49, top: sp.top, left: sp.left + sp.width, right: 0, height: sp.height, backgroundColor: 'rgba(0,0,0,0.55)' }} />
          <div className="fixed pointer-events-none" style={{ zIndex: 50, top: sp.top, left: sp.left, width: sp.width, height: sp.height, borderRadius: 16, boxShadow: '0 0 0 3px #1D9E75', transition: 'all 0.35s ease' }} />
        </>
      ) : (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" style={{ zIndex: 49 }} onClick={onDismiss} />
      )}

      <div style={{ ...tooltipStyle, zIndex: 51 }} className="pointer-events-auto">
        {arrowClass && <div className={arrowClass} style={{ ...arrowStyle, width: 0, height: 0 }} />}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex gap-1.5 justify-center pt-4 pb-0.5">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div key={i} className="h-1.5 rounded-full transition-all duration-300" style={{
                width: i === stepIndex ? '18px' : '6px',
                backgroundColor: i <= stepIndex ? 'var(--nc-primary)' : '#e5e7eb',
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
              <button onClick={onDismiss} className="flex-1 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
                Skip
              </button>
              <button
                onClick={onAdvance}
                className="flex-[2] py-2 rounded-xl text-sm font-bold text-gray-900 transition-colors"
                style={{ backgroundColor: 'var(--nc-primary)' }}
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
