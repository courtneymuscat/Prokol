'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

const T = {
  bg:           '#F4F7F5',
  white:        '#FFFFFF',
  dark:         '#060E10',
  teal:         '#1D9E75',
  tealLight:    '#5DCAA5',
  tealDeep:     '#0F6E56',
  tealDim:      'rgba(29,158,117,0.08)',
  tealBorder:   'rgba(29,158,117,0.18)',
  textPrimary:  '#0A1A14',
  textSec:      'rgba(10,26,20,0.55)',
  textFaint:    'rgba(10,26,20,0.35)',
  amber:        '#E8A020',
  amberDim:     'rgba(232,160,32,0.08)',
}

// Heading font: Geist (clean geometric sans — matches Prokol brand)
const HEAD = 'var(--font-sans, Geist, system-ui, sans-serif)'

// ── Hooks ─────────────────────────────────────────────────────────────────────
function useFadeUp() {
  const ref = useRef<HTMLDivElement>(null)
  const [vis, setVis] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); o.disconnect() } }, { threshold: 0.12 })
    o.observe(el); return () => o.disconnect()
  }, [])
  return { ref, vis }
}

// ── Shared primitives ─────────────────────────────────────────────────────────
function Check() {
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0 mt-0.5" style={{ background: T.teal }}>
      <svg width="10" height="8" fill="none" viewBox="0 0 10 8"><path d="M1 4l2.5 2.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </span>
  )
}
function Cross() {
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0 mt-0.5 bg-gray-100">
      <svg width="8" height="8" fill="none" viewBox="0 0 8 8"><path d="M1.5 1.5l5 5M6.5 1.5l-5 5" stroke="#9ca3af" strokeWidth="1.4" strokeLinecap="round"/></svg>
    </span>
  )
}

function Placeholder({ file, dims, desc, className = '' }: { file: string; dims: string; desc: string; className?: string }) {
  const src = file.replace(/^\/public/, '')
  return (
    <img
      src={src}
      alt={desc}
      className={`rounded-2xl w-full object-cover shadow-lg ${className}`}
      style={{ display: 'block' }}
    />
  )
}

function PhoneFrame({ src, alt, maxWidth = 220 }: { src: string; alt: string; maxWidth?: number }) {
  return (
    <div style={{
      position: 'relative',
      width: maxWidth,
      flexShrink: 0,
      borderRadius: 44,
      background: '#111',
      padding: '10px 8px 14px',
      boxShadow: '0 0 0 1.5px #2a2a2a, 0 0 0 3px #0a0a0a, 0 28px 64px rgba(0,0,0,0.45)',
    }}>
      {/* Side buttons */}
      <div style={{ position: 'absolute', left: -3, top: 90, width: 3, height: 32, background: '#2a2a2a', borderRadius: '3px 0 0 3px' }} />
      <div style={{ position: 'absolute', left: -3, top: 134, width: 3, height: 56, background: '#2a2a2a', borderRadius: '3px 0 0 3px' }} />
      <div style={{ position: 'absolute', left: -3, top: 200, width: 3, height: 56, background: '#2a2a2a', borderRadius: '3px 0 0 3px' }} />
      <div style={{ position: 'absolute', right: -3, top: 150, width: 3, height: 72, background: '#2a2a2a', borderRadius: '0 3px 3px 0' }} />
      {/* Screen bezel */}
      <div style={{ borderRadius: 36, overflow: 'hidden', background: '#000', position: 'relative' }}>
        {/* Dynamic Island */}
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          width: '35%', height: 28, background: '#000', borderRadius: 16, zIndex: 10,
          boxShadow: '0 0 0 1px #1a1a1a',
        }} />
        <img src={src} alt={alt} style={{ width: '100%', display: 'block', aspectRatio: '390/844', objectFit: 'cover' }} />
      </div>
    </div>
  )
}

function BrowserFrame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.22)', background: '#e8eaed' }}>
      <div style={{ background: '#f1f3f4', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['#ff5f57','#febc2e','#28c840'].map(c => <div key={c} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />)}
        </div>
        <div style={{ flex: 1, background: '#fff', borderRadius: 6, padding: '4px 12px', fontSize: 12, color: '#5f6368', textAlign: 'center', maxWidth: 360, margin: '0 auto' }}>
          🔒 app.prokol.io
        </div>
      </div>
      {children}
    </div>
  )
}

// ── Showcase section component ────────────────────────────────────────────────
function ScreenshotArea({ screenshots, screenshotCols }: {
  screenshots: { file: string; dims: string; desc: string }[]
  screenshotCols?: 2
}) {
  const portraits  = screenshots.filter(s => s.dims.includes('portrait'))
  const landscapes = screenshots.filter(s => !s.dims.includes('portrait'))
  const phoneWidth = portraits.length >= 3 ? 160 : portraits.length === 2 ? 200 : 260

  // All portrait — row of phones
  if (landscapes.length === 0) {
    return (
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {portraits.map(s => (
          <PhoneFrame key={s.file} src={s.file.replace(/^\/public/, '')} alt={s.desc} maxWidth={phoneWidth} />
        ))}
      </div>
    )
  }

  // All landscape (including 2-col)
  if (portraits.length === 0) {
    return (
      <div className={screenshotCols === 2 ? 'grid grid-cols-2 gap-3' : 'space-y-4'}>
        {landscapes.map(s => (
          <Placeholder key={s.file} file={s.file} dims={s.dims} desc={s.desc} className="w-full" />
        ))}
      </div>
    )
  }

  // Mixed — landscape on top full-width, phones row below
  return (
    <div className="space-y-6">
      {landscapes.map(s => (
        <Placeholder key={s.file} file={s.file} dims={s.dims} desc={s.desc} className="w-full" />
      ))}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {portraits.map(s => (
          <PhoneFrame key={s.file} src={s.file.replace(/^\/public/, '')} alt={s.desc} maxWidth={phoneWidth} />
        ))}
      </div>
    </div>
  )
}

function Showcase({ label, h3, body, bullets, screenshots, flip, extra, screenshotCols }: {
  label: string; h3: string; body: string; bullets: string[]
  screenshots: { file: string; dims: string; desc: string }[]
  flip?: boolean; extra?: React.ReactNode; screenshotCols?: 2
}) {
  const { ref, vis } = useFadeUp()
  return (
    <div ref={ref} className={`flex flex-col ${flip ? 'lg:flex-row-reverse' : 'lg:flex-row'} gap-12 lg:gap-16 items-center mb-24`}
      style={{ opacity: vis ? 1 : 0, transform: vis ? 'none' : 'translateY(24px)', transition: 'opacity 0.6s ease, transform 0.6s ease' }}>
      {/* Text */}
      <div className={screenshots.length > 0 ? 'flex-1 min-w-0' : 'w-full max-w-2xl'}>
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: T.teal }}>{label}</p>
        <h3 style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 'clamp(1.4rem,3vw,2rem)', color: T.textPrimary, marginBottom: 16, lineHeight: 1.2 }}>{h3}</h3>
        <p style={{ fontSize: '0.95rem', color: T.textSec, lineHeight: 1.75, marginBottom: 24, fontWeight: 300 }}>{body}</p>
        <ul className={screenshots.length > 0 ? 'space-y-3' : 'grid sm:grid-cols-2 gap-3'}>
          {bullets.map(b => (
            <li key={b} className="flex items-start gap-3">
              <Check />
              <span style={{ fontSize: '0.88rem', color: T.textPrimary, lineHeight: 1.5 }}>{b}</span>
            </li>
          ))}
        </ul>
        {extra}
      </div>
      {/* Screenshot(s) */}
      {screenshots.length > 0 && (
        <div className="flex-1 min-w-0 w-full">
          <ScreenshotArea screenshots={screenshots} screenshotCols={screenshotCols} />
        </div>
      )}
    </div>
  )
}

// ── Checkout links ────────────────────────────────────────────────────────────
const CKO = {
  free:      '/signup',
  opt:       '/signup?plan=individual_tier_2&billing=monthly&type=individual',
  elite:     '/signup?plan=individual_tier_3&billing=monthly&type=individual',
  pt:        '/signup?plan=coach_pt_solo&billing=monthly&type=coach',
  nutr:      '/signup?plan=coach_nutritionist_solo&billing=monthly&type=coach',
  pro:       '/signup?plan=coach_pro&billing=monthly&type=coach',
  biz:       '/signup?plan=coach_business&billing=monthly&type=coach',
  wlWeb:     '/org/white-label',
  wlApp:     '/org/white-label',
}

// ─────────────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [scrolled, setScrolled]     = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [tab, setTab]               = useState<'solo'|'pro'|'wl'|'individual'>('solo')

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const navLinks = [
    { label: 'Platform', href: '#features' },
    { label: 'Client Experience', href: '#client-experience' },
    { label: 'Why Switch', href: '#why-switch' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Guides', href: '/guides' },
    { label: 'White-Label', href: '#pricing' },
  ]

  return (
    <div style={{ fontFamily: 'var(--font-dm-sans,DM Sans,sans-serif)', background: T.bg, color: T.textPrimary }}>

      {/* ══ NAV ══════════════════════════════════════════════════════════════ */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: scrolled ? 'rgba(244,247,245,0.92)' : T.bg,
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        boxShadow: scrolled ? '0 1px 20px rgba(0,0,0,0.08)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(29,158,117,0.1)' : '1px solid transparent',
        transition: 'all 0.3s',
      }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Icon mark */}
            <svg width="34" height="34" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="navGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#25c18a"/>
                  <stop offset="100%" stopColor="#1D9E75"/>
                </linearGradient>
              </defs>
              <rect width="512" height="512" rx="108" fill="url(#navGrad)"/>
              <path fill="white" fillRule="evenodd" d="M138,108 L138,404 L214,404 L214,306 L283,306 Q382,306 382,207 Q382,108 283,108 Z M214,178 L277,178 Q310,178 310,207 Q310,236 277,236 L214,236 Z"/>
            </svg>
            {/* Wordmark */}
            <span style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 22, color: T.textPrimary, letterSpacing: '-0.5px' }}>
              Prokol<span style={{ color: T.teal }}>.</span>
            </span>
          </a>
          <div className="hidden lg:flex items-center gap-7">
            {navLinks.map(l => (
              <a key={l.label} href={l.href} style={{ fontSize: '0.875rem', fontWeight: 500, color: T.textSec, textDecoration: 'none' }}>{l.label}</a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden sm:block text-sm font-medium" style={{ color: T.textSec }}>Log in</Link>
            <Link href="/signup" className="text-sm font-bold px-5 py-2.5 rounded-xl text-white hover:opacity-90 transition-opacity" style={{ background: T.teal }}>
              Start Free
            </Link>
            <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2" style={{ color: T.textPrimary }}>
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="19" y2="6"/><line x1="3" y1="12" x2="19" y2="12"/><line x1="3" y1="18" x2="19" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setMobileOpen(false)} />
          <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 300, background: T.white, padding: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="flex items-center justify-between mb-6">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="28" height="28" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="512" height="512" rx="108" fill="#1D9E75"/>
                  <path fill="white" fillRule="evenodd" d="M138,108 L138,404 L214,404 L214,306 L283,306 Q382,306 382,207 Q382,108 283,108 Z M214,178 L277,178 Q310,178 310,207 Q310,236 277,236 L214,236 Z"/>
                </svg>
                <span style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 18, color: T.textPrimary }}>Prokol<span style={{ color: T.teal }}>.</span></span>
              </div>
              <button onClick={() => setMobileOpen(false)}><svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="4" x2="20" y2="20"/><line x1="20" y1="4" x2="4" y2="20"/></svg></button>
            </div>
            {navLinks.map(l => (
              <a key={l.label} href={l.href} onClick={() => setMobileOpen(false)} className="py-3 px-4 rounded-xl text-sm font-medium" style={{ color: T.textPrimary, textDecoration: 'none' }}>{l.label}</a>
            ))}
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(10,26,20,0.08)' }}>
              <Link href="/signup" onClick={() => setMobileOpen(false)} className="block text-center py-3 rounded-xl text-sm font-bold text-white" style={{ background: T.teal }}>
                Start Free
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ══ HERO ═════════════════════════════════════════════════════════════ */}
      <section style={{ paddingTop: 80, paddingBottom: 80, paddingLeft: 24, paddingRight: 24, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -200, left: '50%', transform: 'translateX(-50%)', width: 800, height: 600, background: 'radial-gradient(ellipse at 50% 0%,rgba(29,158,117,0.12) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <div className="max-w-5xl mx-auto text-center" style={{ position: 'relative' }}>
          <div className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide mb-8"
            style={{ border: `1px solid ${T.tealBorder}`, background: T.tealDim, color: T.tealDeep }}>
            Health · Data · Performance · System
          </div>
          <h1 style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 'clamp(2.2rem,5.5vw,3.8rem)', lineHeight: 1.1, color: T.textPrimary, marginBottom: 28, letterSpacing: '-0.02em' }}>
            The coaching platform for coaches and practitioners who deliver results.
          </h1>
          <p style={{ fontWeight: 300, fontSize: 'clamp(1rem,2.2vw,1.15rem)', color: T.textSec, maxWidth: 660, margin: '0 auto 40px', lineHeight: 1.75 }}>
            Prokol is built for nutritionists, personal trainers, dietitians, and clinical coaches who want one system for nutrition, training, female cycle tracking, health data, check-ins, and client management — without the nickel-and-diming.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <a href="#pricing" className="px-8 py-4 rounded-2xl text-base font-bold text-white hover:opacity-90 transition-all hover:scale-[1.02]"
              style={{ background: T.teal, boxShadow: '0 8px 32px rgba(29,158,117,0.3)' }}>
              Start 14-Day Free Trial
            </a>
            <a href="#features" className="px-8 py-4 rounded-2xl text-base font-semibold hover:opacity-80"
              style={{ background: T.white, border: '1px solid rgba(10,26,20,0.12)', color: T.textPrimary, textDecoration: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              See the platform
            </a>
          </div>
          <div style={{ transform: 'perspective(1200px) rotateX(3deg)', transformOrigin: '50% 0%' }}>
            <BrowserFrame>
              <Placeholder file="/public/screenshots/client-overview.png" dims="1280×800px"
                desc="Client file overview — goals, progress photos, weight, check-in history, and client activity visible" className="rounded-none" />
            </BrowserFrame>
          </div>
        </div>
      </section>

      {/* ══ STATS BAR ════════════════════════════════════════════════════════ */}
      <section style={{ background: T.dark, padding: '56px 24px' }}>
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-0">
            {[
              { v: '$49',  l: 'Coach solo / month' },
              { v: '13',   l: 'Client profile tabs' },
              { v: '10+',  l: 'Tools in one platform' },
              { v: '$0',   l: 'To get started today' },
            ].map((s, i) => (
              <div key={s.l} className="text-center py-8" style={{ borderRight: i < 3 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                <p style={{ fontFamily: HEAD, fontWeight: 800, fontSize: '2.4rem', color: T.tealLight, lineHeight: 1 }}>{s.v}</p>
                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', marginTop: 8, fontWeight: 300 }}>{s.l}</p>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: '0.95rem', marginTop: 32, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            Built for premium coaches. Not mass market. Not watered down.
          </p>
        </div>
      </section>

      {/* ══ CALLOUT STRIP ════════════════════════════════════════════════════ */}
      <section style={{ padding: '32px 24px', background: T.amberDim, borderTop: '1px solid rgba(232,160,32,0.2)', borderBottom: '1px solid rgba(232,160,32,0.2)' }}>
        <div className="max-w-4xl mx-auto text-center">
          <p style={{ fontWeight: 500, fontSize: '1rem', color: T.textPrimary, lineHeight: 1.75 }}>
            <span style={{ fontWeight: 700, color: T.amber }}>Other platforms charge $120+/month</span> and still lock automation, nutrition, and billing behind add-ons. Prokol includes everything — meal plans, autoflows, cycle tracking, serve guides, supplement management — from $49/month. <span style={{ fontWeight: 700 }}>No add-ons. No surprises.</span>
          </p>
        </div>
      </section>

      {/* ══ FEATURE SHOWCASES ════════════════════════════════════════════════ */}
      <section id="features" style={{ padding: '96px 24px', background: T.bg }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: T.teal }}>The Platform</p>
            <h2 style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 'clamp(1.8rem,4vw,2.8rem)', color: T.textPrimary, marginBottom: 16 }}>
              Every tool you need. One place to find them.
            </h2>
            <p style={{ fontSize: '1.05rem', color: T.textSec, fontWeight: 300, maxWidth: 560, margin: '0 auto' }}>
              Built by a coach and practitioner. Designed around how real coaching actually works.
            </p>
          </div>

          {/* 1 — Coach Dashboard */}
          <Showcase
            label="Coach Dashboard"
            h3="Every client. Every metric. Always up to date."
            body="Your coach dashboard updates automatically as clients log food, complete check-ins, submit forms, and finish workouts. Lapsed clients surface to the top. Unread submissions are flagged. You see everything without chasing anyone."
            bullets={[
              'Automatic client activity feed — updated in real time as clients engage',
              'Lapsed client alerts — nobody falls through the cracks',
              'Unread check-ins and form submissions flagged immediately',
              '13-tab client profile: overview, nutrition, training, meal plan, check-ins, habits, notes, files, autoflows, resources, calendar, app preview, serve guide',
              'App preview tab — see your client\'s exact dashboard before making changes',
            ]}
            screenshots={[{ file: '/public/screenshots/coach-dashboard.png', dims: '1280×800px', desc: 'Coach dashboard — client overview, activity feed, and invite form visible' }]}
          />

          {/* 2 — Client Onboarding */}
          <Showcase
            flip
            label="Client Onboarding"
            h3="Send a link. They do the rest."
            body="Send your client an invite link. They create their account, complete payment, and land directly on a personalised onboarding form — which saves automatically into their client file. Files they upload during onboarding are stored instantly. No chasing, no manual setup, no data entry on your end."
            bullets={[
              'Invite via link or email — client handles signup and payment in one flow',
              'Onboarding form saves directly to client file automatically',
              'Files uploaded during onboarding stored in client file instantly',
              'Inbuilt TDEE calculator using MET-based activity levels to get the most accurate breakdown',
              'Choose to set these targets or build a meal plan to override these targets',
            ]}
            screenshots={[{ file: '/public/screenshots/onboarding.png', dims: '1280×800px', desc: 'Client-facing onboarding — service card, payment step, welcome screen' }]}
          />

          {/* 3 — Nutrition */}
          <Showcase
            label="Nutrition"
            h3="Coach nutrition your way — meal plans, portions, or both."
            body="Not every client tracks macros. Prokol gives you multiple ways to coach nutrition depending on what your client actually needs. Build a structured meal plan with food-level detail and food swaps. Or use the built-in food cheat sheet to set visual serve targets — so clients understand portions using cups, tablespoons, and hand guides rather than weighing every gram. Both approaches work side by side."
            bullets={[
              'Full food-level meal plan editor — build and assign reusable templates',
              'Multi-plan support — assign more than one active plan simultaneously',
              'Clients can suggest food swaps inline — you see every change',
              'Client-visible notes and hidden coach-only notes kept separate',
              'Clone templates across different clients in one click',
              'Save a client\'s edited plan back as a new template',
              'Built-in food cheat sheet — set visual serve targets per client (protein, carbs, fat, fruit)',
              'Household measures included for every food (cups, tbsp, palms) — no scales needed',
              'Add a note and product URL to any meal item — clients know exactly what you are referring to',
              'Barcode scanner built in — scan or upload a photo of any product to get the most accurate nutritional data',
              'Choose to hide calories and macros from client meal plans — provide clean food guides without the overwhelm',
              'AI meal scanner — clients photograph their plate, macros populate automatically (50 scans per client/month)',
              'Client food photo uploads + meal notes — coach portion sizes without requiring gram tracking',
            ]}
            screenshots={[
              { file: '/public/screenshots/meal-plan-builder.png', dims: '1280×800px', desc: 'Coach meal plan editor — meals, food items, macros, assign button visible' },
              { file: '/public/screenshots/client-meal-plan.png', dims: '390×844px (portrait)', desc: 'Client app view — meal plan with food items, swap button, and coach notes visible' },
              { file: '/public/screenshots/cheat-sheet-client.png', dims: '390×844px (portrait)', desc: 'Client app cheat sheet — serve targets panel (rose/teal/green bars), food list with household measures visible' },
            ]}
          />

          {/* 4 — Check-ins & Automation */}
          <Showcase
            flip
            label="Check-ins & Automation"
            h3="Personalised check-ins. Zero admin."
            body="No two clients are the same — so their check-in questions shouldn't be identical either. Start from a template, then add, remove, or change questions per individual client without rebuilding the form from scratch. Schedule check-ins, automate reminders, and let Prokol handle the follow-up while you focus on coaching."
            bullets={[
              'Edit check-in questions per individual client — no remake required',
              'Scheduled automated check-ins with push notification reminders',
              'Autoflow sequences — automated multi-step task and form delivery',
              'Coach feedback written and sent back to clients on each submission',
              'Central check-in feed — all clients in one view, colour-coded by status',
              'Clients can upload training videos for form assessment and review',
              'Form builder with pre-built templates + JotForm import',
            ]}
            screenshots={[
              { file: '/public/screenshots/client-checkin-due..png', dims: '390×844px (portrait)', desc: 'Client app home screen — check-in due card showing form title, schedule, and Fill in button' },
            ]}
          />

          {/* 5 — Training */}
          <Showcase
            label="Training"
            h3="Programs that train the client, not the coach."
            body="Build multi-week training programs from your exercise library and assign them directly to clients. Clients log their workouts session by session, tracking sets, reps, and weight. They can upload form-check videos so you can review technique. You see their full workout history inside their client file."
            bullets={[
              'Multi-week training program builder with exercises, sets, reps, and rest timers',
              'Assign programs to clients directly from their client file',
              'Clients log workouts from their program — sets, reps, weight, and rest timer built in',
              'Exercise video upload — clients record their form, you review it in the app',
              'Full exercise history per movement — track progression over time',
              'Custom exercise library — add your own exercises with video demonstrations',
            ]}
            screenshots={[
              { file: '/public/screenshots/client-workout.png', dims: '390×844px (portrait)', desc: 'Client app — active workout session showing current exercise, sets/reps input, rest timer, and progress' },
            ]}
          />

          {/* 6 — Supplements & Protocol */}
          <Showcase
            flip
            label="Supplements & Protocol"
            h3="The clinical layer other platforms don't have."
            body="Prokol goes beyond food and training. Assign supplement stacks with dosage, benefits, and brand links. Write structured coaching protocols that clients read in their app. Set daily habits, weekly mini-goals, and grand goals — everything a high-touch practice needs to deliver a clinical-grade experience."
            bullets={[
              'Supplement management — assign name, dosage, benefits, brand URL, and private coach notes',
              'Protocol builder — structured written protocols clients see in their app',
              'Daily habits — set trackable habits per client with targets and units',
              'Weekly mini-goals and grand goals — visible to the client in their dashboard',
            ]}
            screenshots={[
              { file: '/public/screenshots/client-file-supplements.png', dims: '1280×800px', desc: 'Client file — Supplements tab showing assigned supplement stack with dosage, benefits, and brand links' },
              { file: '/public/screenshots/client-file-protocol.png', dims: '1280×800px', desc: 'Client file — Protocol tab showing structured coaching protocol sections visible to the client' },
            ]}
          />

          {/* 7 — Weekly Changes */}
          <Showcase
            label="Weekly Changes"
            h3="Plan every phase. Every week. In advance."
            body="Most coaches plan phases in their head or a spreadsheet. Prokol gives you a proper phase and periodisation builder — right inside the client file. Map out a full protocol of deficit, surplus, diet breaks, reverse diet, or peak week phases. Set calorie targets, macros, and notes per individual week. Share the plan with your client so they always know what phase they're in and what's coming."
            bullets={[
              'Drag-and-drop phase builder — deficit, surplus, maintenance, diet break, reverse diet, recomp, peak week, or custom',
              'Set calorie targets per week — absolute kcal or % from TDEE adjustment',
              'Set macros per week — protein, carbs, and fat targets with one-click calculator',
              'Timeline bar with current week highlighted — coach and client always know where they are',
              'Per-week notes visible to client + private coach-only notes on every week',
              'Copy any week\'s settings to following weeks or the whole phase in one click',
              'Apply a week\'s targets to the client\'s live dashboard instantly',
              'Share the plan with the client — they see their weekly schedule in the app',
              'Save plans as reusable templates — apply your go-to protocols to new clients instantly',
              'TDEE calculator built in — calculate and push targets to any week without switching tabs',
            ]}
            screenshots={[
              { file: '/public/screenshots/weekly-changes.png', dims: '1280×800px', desc: 'Weekly Changes tab in client file — phase timeline, phase cards, and weekly schedule with dates, phase labels, and calorie targets' },
            ]}
          />

          {/* 8 — Cycle Tracking */}
          <Showcase
            label="Cycle Tracking"
            h3="The tool that turns hormonal health into coaching intel."
            body="For female clients, the menstrual cycle is one of the most powerful data points a coach can track — and almost no platform touches it. Prokol includes full cycle phase tracking built into the client app. Coaches with nutritionist access can view the data directly inside the client file, giving them context that changes how they program, plan, and coach."
            bullets={[
              'Full cycle phase tracking — menstrual, follicular, ovulation, and luteal',
              'Symptom logging — cramps, headaches, fatigue, acne, breast tenderness, and more',
              'Basal body temperature (BBT), cervical mucus, libido, digestion, and sleep tracking',
              'Mood and energy tracking tied to cycle phase',
              'Cycle intelligence — predicted period, ovulation window, and fertile window',
              'Personalised insights based on the client\'s logged history',
              'Coaches with nutritionist access can view all cycle data inside the client file',
            ]}
            screenshots={[
              { file: '/public/screenshots/cycle-coach-view.png', dims: '1280×800px', desc: 'Cycle tab inside client file (coach view) — monthly calendar with period days, predictions, hover tooltip showing mood/symptoms/BBT for a specific date' },
              { file: '/public/screenshots/cycle-logging-client.png', dims: '390×844px (portrait)', desc: 'Client app — cycle logging modal open for a specific day, showing symptom chips selected (e.g. cramps, fatigue), mood picker, energy selector, BBT input, and cervical mucus options' },
              { file: '/public/screenshots/cycle-intelligence-client.png', dims: '390×844px (portrait)', desc: 'Client app — cycle intelligence view showing the prediction strip (next period in Xd, ovulation est., avg cycle length), the phase bar at the top, and personalised insight text below' },
            ]}
          />

          {/* 8 — Client Notes + Note Templates */}
          <Showcase
            flip
            label="Client Notes & Note Templates"
            h3="Every insight captured. Ready to use again."
            body="Great coaching requires context. Prokol gives you a private notes system per client — write observations, track progress, flag concerns, and reference past sessions. Build note templates for things you write repeatedly — onboarding notes, program review summaries, check-in responses — and apply them in one click."
            bullets={[
              'Private per-client notes — visible only to the coach, never to the client',
              'Rich text notes with timestamps — build a full coaching history per client',
              'Note templates — create reusable templates for common note types',
              'Apply a template to any client in one click and customise from there',
              'Notes visible inside the client file alongside check-ins, goals, and data',
            ]}
            screenshots={[
              { file: '/public/screenshots/client-notes.png', dims: '1280×800px', desc: 'Notes tab inside a client file — showing a list of dated coach notes with text content and a "New note" button' },
              { file: '/public/screenshots/note-templates.png', dims: '1280×800px', desc: 'Note templates page — list of saved templates with names, preview text, and apply/edit options' },
            ]}
          />

          {/* 9 — Client Calendar */}
          <Showcase
            label="Client Calendar & Life Events"
            h3="Coach the whole person. Not just the workout."
            body="Clients can add events — social dinners, holidays, travel, extra workouts — directly in their app. You see their calendar inside the client file and can help them prepare for occasions rather than react to them. This is what separates clinical coaching from generic programming."
            bullets={[
              'Client calendar with events, travel, social occasions, and extra activity',
              'Coaches see the full client calendar inside their client file',
              'Pre-plan meals and training around upcoming life events',
              'Adjust targets or plans around holidays and occasions proactively',
              'Clients add events, social occasions, and extra activity so you can pre-plan with them in advance',
            ]}
            screenshots={[
              { file: '/public/screenshots/client-calendar.png', dims: '1280×800px', desc: 'Calendar tab in client file — events, travel dates, and social occasions on calendar grid' },
            ]}
          />
        </div>
      </section>

      {/* ══ CLIENT & COACH EXPERIENCE ════════════════════════════════════════ */}
      <section id="client-experience" style={{ background: T.white, padding: '80px 24px' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: T.teal }}>Client & Coach Experience</p>
            <h2 style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 'clamp(1.6rem,3.5vw,2.4rem)', color: T.textPrimary, marginBottom: 16 }}>
              Access everything — on any screen, anywhere.
            </h2>
            <p style={{ fontSize: '1rem', color: T.textSec, fontWeight: 300, maxWidth: 560, margin: '0 auto', lineHeight: 1.75 }}>
              Prokol works on desktop, tablet, and mobile — both for coaches managing their practice and clients tracking their progress. No app to download. Just open a browser and go.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-10">
            {/* Desktop */}
            <div style={{ background: T.bg, borderRadius: 20, padding: '28px 32px' }}>
              <p style={{ fontSize: '1.6rem', marginBottom: 14 }}>🖥️</p>
              <p style={{ fontFamily: HEAD, fontWeight: 700, fontSize: '1rem', color: T.textPrimary, marginBottom: 8 }}>On desktop</p>
              <p style={{ fontSize: '0.88rem', color: T.textSec, lineHeight: 1.7, fontWeight: 300 }}>
                Coaches use Prokol on desktop to manage client files, build meal plans and programs, review check-ins, write notes, and track everything across their entire roster. Clients use it on desktop to log food, complete check-ins, and view their plan.
              </p>
            </div>
            {/* Mobile */}
            <div style={{ background: T.bg, borderRadius: 20, padding: '28px 32px' }}>
              <p style={{ fontSize: '1.6rem', marginBottom: 14 }}>📱</p>
              <p style={{ fontFamily: HEAD, fontWeight: 700, fontSize: '1rem', color: T.textPrimary, marginBottom: 8 }}>Save to your phone — no app store needed</p>
              <p style={{ fontSize: '0.88rem', color: T.textSec, lineHeight: 1.7, fontWeight: 300 }}>
                Open prokol.io in your phone&apos;s browser and save it to your home screen — it works exactly like a native app. Clients use it daily to log food, track workouts, complete check-ins, and view their plan on the go.
              </p>
            </div>
          </div>

          <div style={{ background: T.tealDim, border: `1px solid ${T.tealBorder}`, borderRadius: 16, padding: '20px 28px' }}>
            <p style={{ fontWeight: 700, fontSize: '0.88rem', color: T.tealDeep, marginBottom: 10 }}>
              How to save to your home screen
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p style={{ fontSize: '0.8rem', fontWeight: 600, color: T.textPrimary, marginBottom: 6 }}>iPhone (Safari)</p>
                <p style={{ fontSize: '0.8rem', color: T.textSec, lineHeight: 1.65, fontWeight: 300 }}>
                  Open prokol.io → tap the Share button → tap &ldquo;Add to Home Screen&rdquo; → tap Add. Done.
                </p>
              </div>
              <div>
                <p style={{ fontSize: '0.8rem', fontWeight: 600, color: T.textPrimary, marginBottom: 6 }}>Android (Chrome)</p>
                <p style={{ fontSize: '0.8rem', color: T.textSec, lineHeight: 1.65, fontWeight: 300 }}>
                  Open prokol.io → tap the three-dot menu → tap &ldquo;Add to Home screen&rdquo; → tap Add. Done.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ WHY SWITCH ═══════════════════════════════════════════════════════ */}
      <section id="why-switch" style={{ background: T.dark, padding: '96px 24px' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: T.tealLight }}>Why coaches switch</p>
            <h2 style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 'clamp(1.8rem,4vw,2.8rem)', color: '#fff', marginBottom: 16 }}>
              Built for what other platforms charge extra for.
            </h2>
            <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.5)', fontWeight: 300, maxWidth: 540, margin: '0 auto' }}>
              The two dominant platforms in this space charge a base rate — then add automations, nutrition features, and billing separately. Prokol includes everything. One price. No add-ons.
            </p>
          </div>

          {/* App consolidation callout */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16, marginBottom: 32 }}>
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '28px 28px 24px' }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>The old way</p>
              <p style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', lineHeight: 1.5, marginBottom: 12 }}>
                3–5 tabs open during every check-in
              </p>
              <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>
                Most coaches piece together a food log, a training app, a separate check-in form, cycle data, notes, and billing across different platforms — switching between all of them just to prep for one client call.
              </p>
            </div>
            <div style={{ background: 'rgba(29,158,117,0.08)', border: '1px solid rgba(29,158,117,0.2)', borderRadius: 16, padding: '28px 28px 24px' }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.tealLight, marginBottom: 12 }}>The Prokol way</p>
              <p style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', lineHeight: 1.5, marginBottom: 12 }}>
                Everything in one place. One login.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['Food tracking & AI meal scanner','Training plans & protocol builder','Check-in forms (per-client questions)','Cycle tracking & intelligence','Coach notes & client timeline','Autoflows, billing & calendar'].map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.teal, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.7)' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                  {['Feature','Other platforms','Prokol Health'].map((h, i) => (
                    <th key={h} style={{ padding: '16px 20px', textAlign: i === 0 ? 'left' : 'center', fontSize: '0.75rem', fontWeight: 700, color: i === 2 ? T.tealLight : 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Meal plan builder','Premium tier ($120+/mo)','From $49/mo'],
                  ['Automation / Autoflows','Paid add-on','Every coach plan'],
                  ['Billing & payment links','Paid add-on','Every coach plan'],
                  ['Supplement management','Not available','Every coach plan'],
                  ['Protocol builder','Not available','Every coach plan'],
                  ['Serve guide / food cheat sheet','Not available','Every coach plan'],
                  ['Cycle tracking + intelligence','Not available','Full cycle intelligence built in'],
                  ['Personalised check-in questions per client','One template for all','Edit per client, no remake'],
                  ['AI meal photo scanner','Separate app or unavailable','Native — Elite & coached clients'],
                  ['Food photo + note food diary','Not available','Built in'],
                  ['Client event calendar','Not available','Built in'],
                  ['PWA — save to home screen','Not available','Both coaches and clients'],
                  ['White-label for gyms','Enterprise pricing','From $299/mo'],
                  ['Wearable integrations (Oura, Whoop, Garmin, Apple Health)','Separate apps only','Coming soon'],
                  ['Row-level database security','Not disclosed','Every table, every row'],
                ].map(([feat, other, prokol], i) => (
                  <tr key={feat} style={{ background: i % 2 ? 'rgba(255,255,255,0.02)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '13px 20px', fontSize: '0.84rem', color: 'rgba(255,255,255,0.8)' }}>{feat}</td>
                    <td style={{ padding: '13px 20px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>{other}</td>
                    <td style={{ padding: '13px 20px', fontSize: '0.8rem', textAlign: 'center', fontWeight: 600, color: prokol === 'Coming soon' ? 'rgba(255,255,255,0.35)' : T.tealLight }}>
                      {prokol === 'Coming soon' ? '🔜 Coming soon' : `✓ ${prokol}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ background: T.amberDim, border: '1px solid rgba(232,160,32,0.2)', borderRadius: 16, padding: '24px 28px', marginTop: 32, textAlign: 'center' }}>
            <p style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff', lineHeight: 1.7 }}>
              This is not a platform for coaches who want to manage 500 clients with one template. This is the platform for premium coaches and practitioners who want to charge more, deliver more, and build a clinical-grade coaching business.
            </p>
          </div>
        </div>
      </section>

      {/* ══ PRICING ══════════════════════════════════════════════════════════ */}
      <section id="pricing" style={{ background: T.white, padding: '96px 24px' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: T.teal }}>Pricing</p>
            <h2 style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 'clamp(1.8rem,4vw,2.8rem)', color: T.textPrimary, marginBottom: 12 }}>
              Simple, honest pricing. No hidden add-ons.
            </h2>
            <p style={{ fontSize: '1rem', color: T.textSec, fontWeight: 300, maxWidth: 500, margin: '0 auto' }}>
              Every feature listed is included in the plan it says it&apos;s in. No surprises on your invoice.
            </p>
          </div>

          {/* Tabs — coach-first */}
          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {([
              { id: 'solo',       label: 'Coach Solo' },
              { id: 'pro',        label: 'Pro + Business' },
              { id: 'wl',         label: 'White-Label' },
              { id: 'individual', label: 'Individual (self-use)' },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: tab === t.id ? T.teal : T.bg, color: tab === t.id ? '#fff' : T.textSec, border: tab === t.id ? 'none' : '1px solid rgba(10,26,20,0.1)' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── COACH SOLO ── */}
          {tab === 'solo' && (
            <>
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                {[
                  {
                    title: 'Solo — Personal Trainer', price: '$49', badge: '', link: CKO.pt, cta: 'Start as PT →',
                    inc: ['13-tab client profiles','Training program builder','Exercise library + custom exercises','Client workout logging + history','View client nutrition + cycle data','Client messaging + check-in feed','Custom form builder + pre-built templates','JotForm import','Autoflow automation sequences','Push notification reminders','Supplement management','Protocol builder','Serve guide / food cheat sheet','Resource library + file uploads','Service offerings + payment links','Client calendar visibility','Private coach notes + note templates','Check-in feedback to clients','App preview tab'],
                    blk: ['Meal plan builder','Custom branding'],
                  },
                  {
                    title: 'Solo — Nutritionist', price: '$49', badge: 'Most Popular', link: CKO.nutr, cta: 'Start as Nutritionist →',
                    inc: ['13-tab client profiles','Meal plan template builder','Assign + manage meal plans per client','Multi-plan support','Food log oversight','View client workout + cycle data','Client messaging + check-in feed','Custom form builder + pre-built templates','JotForm import','Autoflow automation sequences','Push notification reminders','Supplement management','Protocol builder','Serve guide / food cheat sheet','Resource library + file uploads','Service offerings + payment links','Client calendar visibility','Private coach notes + note templates','Check-in feedback to clients','App preview tab'],
                    blk: ['Training program builder','Custom branding'],
                  },
                ].map(p => (
                  <div key={p.title} style={{ border: p.badge ? `2px solid ${T.teal}` : '1px solid rgba(10,26,20,0.1)', borderRadius: 20, padding: 28, background: T.white, position: 'relative' }}>
                    {p.badge && <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: T.teal, color: '#fff', fontSize: '0.7rem', fontWeight: 700, padding: '4px 14px', borderRadius: 99 }}>{p.badge}</div>}
                    <p style={{ fontFamily: HEAD, fontWeight: 800, fontSize: '1.2rem', color: T.textPrimary, marginBottom: 4 }}>{p.title}</p>
                    <p style={{ fontSize: '2rem', fontWeight: 800, color: T.textPrimary }}>{p.price} <span style={{ fontSize: '0.9rem', fontWeight: 400, color: T.textSec }}>/mo</span></p>
                    <p style={{ fontSize: '0.78rem', color: T.textSec, marginBottom: 6 }}>5 clients included · +$4/mo per additional client</p>
                    <p style={{ fontSize: '0.75rem', color: T.tealDeep, marginBottom: 20, fontStyle: 'italic' }}>Includes full Elite-level individual access for the coach.</p>
                    <ul className="space-y-2 mb-6">
                      {p.inc.map(f => <li key={f} className="flex items-start gap-2"><Check /><span style={{ fontSize: '0.8rem', color: T.textPrimary }}>{f}</span></li>)}
                      {p.blk.map(f => <li key={f} className="flex items-start gap-2"><Cross /><span style={{ fontSize: '0.8rem', color: T.textFaint }}>{f}</span></li>)}
                    </ul>
                    <Link href={p.link} className="block text-center py-3 rounded-xl text-sm font-bold text-white hover:opacity-90" style={{ background: T.teal }}>{p.cta}</Link>
                  </div>
                ))}
              </div>
              <p style={{ textAlign: 'center', fontSize: '0.82rem', color: T.textSec, fontStyle: 'italic', fontWeight: 300 }}>
                All coach plans also include full Elite-level individual access (food log, workouts, cycle tracking, analytics) for the coach personally.
              </p>
            </>
          )}

          {/* ── PRO + BUSINESS ── */}
          {tab === 'pro' && (
            <div className="grid md:grid-cols-2 gap-6">
              {[
                {
                  title: 'Pro', price: '$99', badge: 'Best Value', limit: '15 clients · +$3/mo per extra', link: CKO.pro, cta: 'Go Pro →',
                  inc: ['Everything in both Solo plans (PT + Nutritionist combined)','Training program builder + meal plan builder both unlocked','Custom branding — logo + brand colour shown to clients','All autoflow + form + resource tools','Supplement + protocol + serve guide','Service offerings + payment links','App preview tab'],
                  blk: ['Multi-coach team','Org dashboard','White-label domain'],
                },
                {
                  title: 'Business', price: '$249', badge: '', limit: '75 clients + 3 coaches · +$3/client · +$19/coach', link: CKO.biz, cta: 'Start Business →',
                  inc: ['Everything in Pro','Multi-coach team management','Org dashboard — aggregate view across all coaches','Shared template library (forms, programs, meal plans)','Role-based permissions per coach','Client reassignment between coaches','Coach invite links and management'],
                  blk: ['Custom domain','White-label branding'],
                },
              ].map(p => (
                <div key={p.title} style={{ border: p.badge ? `2px solid ${T.teal}` : '1px solid rgba(10,26,20,0.1)', borderRadius: 20, padding: 28, background: T.white, position: 'relative' }}>
                  {p.badge && <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: T.teal, color: '#fff', fontSize: '0.7rem', fontWeight: 700, padding: '4px 14px', borderRadius: 99 }}>{p.badge}</div>}
                  <p style={{ fontFamily: HEAD, fontWeight: 800, fontSize: '1.2rem', color: T.textPrimary, marginBottom: 4 }}>{p.title}</p>
                  <p style={{ fontSize: '2rem', fontWeight: 800, color: T.textPrimary }}>{p.price} <span style={{ fontSize: '0.9rem', fontWeight: 400, color: T.textSec }}>/mo</span></p>
                  <p style={{ fontSize: '0.78rem', color: T.textSec, marginBottom: 20 }}>{p.limit}</p>
                  <ul className="space-y-2 mb-6">
                    {p.inc.map(f => <li key={f} className="flex items-start gap-2"><Check /><span style={{ fontSize: '0.8rem', color: T.textPrimary }}>{f}</span></li>)}
                    {p.blk.map(f => <li key={f} className="flex items-start gap-2"><Cross /><span style={{ fontSize: '0.8rem', color: T.textFaint }}>{f}</span></li>)}
                  </ul>
                  <Link href={p.link} className="block text-center py-3 rounded-xl text-sm font-bold text-white hover:opacity-90" style={{ background: T.teal }}>{p.cta}</Link>
                </div>
              ))}
            </div>
          )}

          {/* ── WHITE-LABEL ── */}
          {tab === 'wl' && (
            <div className="grid md:grid-cols-2 gap-6">
              {[
                {
                  title: 'Web White-Label', price: '$299', setup: 'No setup fee', limit: '200 clients · 5 coaches', link: CKO.wlWeb, cta: 'Apply for Web White-Label →',
                  inc: ['Everything in Business','Custom domain (e.g. app.yourstudio.com)','Zero Prokol branding anywhere','Custom logo, colours, favicon','Branded emails sent from your address','DNS setup assistance included','Coaches and clients install via your branded domain as a web app'],
                  blk: ['Native iOS/Android app'],
                },
                {
                  title: 'App Store White-Label', price: '$499', setup: '$2,500 one-time setup', limit: '500 clients · 10 coaches', link: CKO.wlApp, cta: 'Apply for App White-Label →',
                  inc: ['Everything in Web White-Label','Native iOS app under your brand name','Native Android app under your brand name','Listed in App Store + Google Play under your developer account','Push notifications sent under your brand','Custom app icon + splash screen'],
                  blk: [],
                },
              ].map(p => (
                <div key={p.title} style={{ border: '1px solid rgba(10,26,20,0.1)', borderRadius: 20, padding: 28, background: T.white }}>
                  <p style={{ fontFamily: HEAD, fontWeight: 800, fontSize: '1.2rem', color: T.textPrimary, marginBottom: 4 }}>{p.title}</p>
                  <p style={{ fontSize: '2rem', fontWeight: 800, color: T.textPrimary }}>{p.price} <span style={{ fontSize: '0.9rem', fontWeight: 400, color: T.textSec }}>/mo</span></p>
                  <p style={{ fontSize: '0.78rem', color: T.amber, fontWeight: 600, marginBottom: 4 }}>{p.setup}</p>
                  <p style={{ fontSize: '0.78rem', color: T.textSec, marginBottom: 20 }}>{p.limit}</p>
                  <ul className="space-y-2 mb-6">
                    {p.inc.map(f => <li key={f} className="flex items-start gap-2"><Check /><span style={{ fontSize: '0.8rem', color: T.textPrimary }}>{f}</span></li>)}
                    {p.blk.map(f => <li key={f} className="flex items-start gap-2"><Cross /><span style={{ fontSize: '0.8rem', color: T.textFaint }}>{f}</span></li>)}
                  </ul>
                  <Link href={p.link} className="block text-center py-3 rounded-xl text-sm font-bold text-white hover:opacity-90" style={{ background: T.teal }}>{p.cta}</Link>
                </div>
              ))}
            </div>
          )}

          {/* ── INDIVIDUAL (upsell) ── */}
          {tab === 'individual' && (
            <>
              <div style={{ background: T.tealDim, border: `1px solid ${T.tealBorder}`, borderRadius: 16, padding: '16px 24px', marginBottom: 24, textAlign: 'center' }}>
                <p style={{ fontSize: '0.88rem', color: T.tealDeep, fontWeight: 500 }}>
                  <strong>For individuals who don&apos;t have a coach.</strong> Track nutrition, training, weight, cycle, and health data — all in one place, on your own terms.
                  <br /><br />
                  If you&apos;re currently working with a coach on Prokol, you don&apos;t need one of these plans — your coach gives you full Elite-level access automatically.
                  <br /><br />
                  <span style={{ color: T.tealDeep }}>Once you stop working with a coach, your account moves to the Free tier automatically — all your data is saved and your history stays intact. You can subscribe to Optimiser or Elite at any time to continue tracking at the level you&apos;re used to.</span>
                </p>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                {[
                  {
                    title: 'Free', price: '$0', sub: 'forever', link: CKO.free, cta: 'Get Started Free', badge: '',
                    inc: ['Food logging + macros','TDEE + personalised targets','Meal photos + notes','Basic weight entry','Basic workout logging','Basic daily check-in','Cycle phase bar'],
                    blk: ['Progress photos','Weight chart','AI meal scanner'],
                  },
                  {
                    title: 'Optimiser', price: '$19.99', sub: '/mo · $17.99 annual', link: CKO.opt, cta: 'Start Optimiser', badge: 'Most Popular',
                    inc: ['Everything in Free','Progress photos + before/after comparison','Meal builder + saved meals','Structured workout sessions + exercise history','Weight chart + full history','Full check-in (HRV, RHR, energy, notes)','Advanced cycle tracking (symptoms, BBT, moods, libido, digestion)'],
                    blk: ['AI meal scanner','Advanced analytics','Cycle intelligence'],
                  },
                  {
                    title: 'Elite', price: '$34.99', sub: '/mo · $31.49 annual', link: CKO.elite, cta: 'Start Elite', badge: '',
                    inc: ['Everything in Optimiser','AI meal scanner — 50 scans/month (photo to macros)','Advanced analytics dashboard','Cycle intelligence + predictions','Personalised cycle insights','Exercise video uploads'],
                    blk: [],
                  },
                ].map(p => (
                  <div key={p.title} style={{ border: p.badge ? `2px solid ${T.teal}` : '1px solid rgba(10,26,20,0.1)', borderRadius: 20, padding: 28, background: T.white, position: 'relative' }}>
                    {p.badge && <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: T.teal, color: '#fff', fontSize: '0.7rem', fontWeight: 700, padding: '4px 14px', borderRadius: 99 }}>{p.badge}</div>}
                    <p style={{ fontFamily: HEAD, fontWeight: 800, fontSize: '1.2rem', color: T.textPrimary, marginBottom: 4 }}>{p.title}</p>
                    <p style={{ fontSize: '1.8rem', fontWeight: 800, color: T.textPrimary }}>{p.price} <span style={{ fontSize: '0.85rem', fontWeight: 400, color: T.textSec }}>{p.sub}</span></p>
                    <div style={{ height: 16 }} />
                    <ul className="space-y-2 mb-6">
                      {p.inc.map(f => <li key={f} className="flex items-start gap-2"><Check /><span style={{ fontSize: '0.8rem', color: T.textPrimary }}>{f}</span></li>)}
                      {p.blk.map(f => <li key={f} className="flex items-start gap-2"><Cross /><span style={{ fontSize: '0.8rem', color: T.textFaint }}>{f}</span></li>)}
                    </ul>
                    <Link href={p.link} className="block text-center py-3 rounded-xl text-sm font-bold hover:opacity-90 transition-all"
                      style={p.badge ? { background: T.teal, color: '#fff' } : { border: `1px solid ${T.tealBorder}`, color: T.teal }}>
                      {p.cta}
                    </Link>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ══ SECURITY ═════════════════════════════════════════════════════════ */}
      <section style={{ background: T.tealDim, padding: '80px 24px', borderTop: `1px solid ${T.tealBorder}` }}>
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: T.teal }}>Data security</p>
          <h2 style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 'clamp(1.6rem,3.5vw,2.4rem)', color: T.textPrimary, marginBottom: 16 }}>
            Client health data you can defend.
          </h2>
          <p style={{ fontSize: '0.95rem', color: T.textSec, fontWeight: 300, maxWidth: 640, margin: '0 auto 48px', lineHeight: 1.75 }}>
            When you start signing contracts with gyms, clinics, and wellness businesses, they will ask about data security. Prokol is built with row-level security on every Supabase table — client data is isolated at the database level. Service roles are never exposed to the client. Session verification runs on every admin route.
          </p>
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {[
              { icon: '🔐', title: 'Row-Level Security on every table', desc: 'Client data isolated at the database level, not just the app' },
              { icon: '✅', title: 'Session verification on every admin route', desc: 'No route is accessible without a verified session' },
              { icon: '🛡️', title: 'Service role never client-exposed', desc: 'Backend credentials never reach the browser' },
            ].map(t => (
              <div key={t.title} style={{ background: T.white, borderRadius: 16, padding: '28px 24px', border: `1px solid ${T.tealBorder}` }}>
                <p style={{ fontSize: '1.8rem', marginBottom: 12 }}>{t.icon}</p>
                <p style={{ fontWeight: 700, fontSize: '0.9rem', color: T.textPrimary, marginBottom: 8 }}>{t.title}</p>
                <p style={{ fontSize: '0.8rem', color: T.textSec, lineHeight: 1.6, fontWeight: 300 }}>{t.desc}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '0.82rem', color: T.textSec, fontStyle: 'italic' }}>
            Legally defensible data architecture. Matters the moment you sign your first gym or clinic contract.
          </p>
        </div>
      </section>

      {/* ══ GUIDES ═══════════════════════════════════════════════════════════ */}
      <section id="guides" style={{ background: T.dark, padding: '96px 24px' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: T.tealLight }}>Learning Centre</p>
            <h2 style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 'clamp(1.8rem,4vw,2.8rem)', color: '#fff', marginBottom: 12 }}>
              Up and running in under an hour.
            </h2>
            <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.5)', fontWeight: 300, maxWidth: 480, margin: '0 auto' }}>
              Guides and walkthroughs for coaches and clients — so your first client is onboarded on day one.
            </p>
          </div>
          <div style={{ marginBottom: 56 }}>
            <div style={{ position: 'relative', paddingBottom: '56.25%', borderRadius: 16, overflow: 'hidden', border: `2px solid ${T.tealBorder}`, boxShadow: '0 0 60px rgba(29,158,117,0.15)' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(29,158,117,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: T.teal, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" fill="white" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem', textAlign: 'center', maxWidth: 380 }}>
                  VIDEO EMBED PLACEHOLDER — replace src with Loom embed URL:<br/>
                  <code style={{ color: T.tealLight, fontSize: '0.73rem' }}>https://www.loom.com/embed/YOUR-VIDEO-ID</code>
                </p>
              </div>
            </div>
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem', marginTop: 12 }}>
              Full platform walkthrough — coach dashboard, client onboarding, meal plan builder, check-in flow, and client app in one 8-minute video.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: '💪', title: 'Getting started as a PT', desc: 'Set up your profile, build your first program, invite your first client. Under 20 minutes.', href: '/guides#getting-started' },
              { icon: '🥗', title: 'Getting started as a Nutritionist', desc: 'Build your first meal plan template, set client macro targets, send your first check-in.', href: '/guides#meal-plans' },
              { icon: '🤖', title: 'Setting up Autoflows', desc: 'Build automation that sends check-in reminders, collects responses, and notifies you — automatically.', href: '/guides#autoflows' },
              { icon: '📱', title: 'Client onboarding guide', desc: 'Share this guide with new clients — covers signup, food logging, calendar, and installing the app.', href: '/guides#client-getting-started' },
            ].map(g => (
              <div key={g.title} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '24px 24px 20px' }}>
                <p style={{ fontSize: '1.5rem', marginBottom: 10 }}>{g.icon}</p>
                <p style={{ fontWeight: 700, fontSize: '0.92rem', color: '#fff', marginBottom: 6 }}>{g.title}</p>
                <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, fontWeight: 300, marginBottom: 14 }}>{g.desc}</p>
                <a href={g.href} style={{ fontSize: '0.8rem', fontWeight: 600, color: T.tealLight, textDecoration: 'none' }}>Read guide →</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ TESTIMONIAL ══════════════════════════════════════════════════════ */}
      <section style={{ background: T.white, padding: '96px 24px', textAlign: 'center' }}>
        <div className="max-w-3xl mx-auto">
          <p style={{ fontFamily: HEAD, fontSize: '5rem', color: T.teal, lineHeight: 0.8, marginBottom: 32 }}>&ldquo;</p>
          <blockquote style={{ fontFamily: HEAD, fontWeight: 700, fontSize: 'clamp(1.1rem,2.5vw,1.45rem)', color: T.textPrimary, lineHeight: 1.55, marginBottom: 28 }}>
            I was paying over $120 a month for a platform that didn&apos;t even do nutrition properly. Prokol does meal plans, protocols, supplements, check-ins, and training — for less than a third of the price. My clients actually use it.
          </blockquote>
          <cite style={{ fontSize: '0.88rem', color: T.textSec, fontStyle: 'normal', fontWeight: 500 }}>
            — Online performance nutritionist, 40+ active clients
          </cite>
        </div>
      </section>

      {/* ══ FINAL CTA ════════════════════════════════════════════════════════ */}
      <section style={{ background: T.teal, padding: '96px 24px', textAlign: 'center' }}>
        <div className="max-w-2xl mx-auto">
          <h2 style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 'clamp(1.8rem,4vw,2.8rem)', color: '#fff', marginBottom: 16 }}>
            Stop paying more for less.
          </h2>
          <p style={{ fontSize: '1.05rem', color: 'rgba(255,255,255,0.7)', fontWeight: 300, marginBottom: 40 }}>
            Start free today. Your first client is free to onboard. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup" className="px-10 py-4 rounded-2xl text-base font-bold hover:opacity-90 transition-all hover:scale-[1.02]" style={{ background: T.white, color: T.teal }}>
              Start Free
            </Link>
            <a href="mailto:info@prokol.io" className="px-10 py-4 rounded-2xl text-base font-semibold hover:opacity-80" style={{ border: '2px solid rgba(255,255,255,0.4)', color: '#fff', textDecoration: 'none' }}>
              Talk to us
            </a>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ═══════════════════════════════════════════════════════════ */}
      <footer style={{ background: T.dark, padding: '48px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center md:items-start justify-between gap-8">
          <div>
            <p style={{ fontFamily: HEAD, fontWeight: 800, fontSize: '1.2rem', color: '#fff', marginBottom: 8 }}>
              Prokol<span style={{ color: T.teal }}>.</span>
            </p>
            <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', maxWidth: 260, lineHeight: 1.6, fontWeight: 300 }}>
              The coaching platform for coaches and practitioners who deliver results.
            </p>
          </div>
          <div className="flex items-center gap-6 flex-wrap justify-center">
            {[{l:'Privacy Policy',h:'/privacy'},{l:'Terms of Service',h:'/terms'},{l:'Health Data',h:'/health-data'},{l:'DPA',h:'/dpa'},{l:'Guides',h:'/guides'},{l:'Contact',h:'mailto:info@prokol.io'}].map(x => (
              <a key={x.l} href={x.h} style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.45)', textDecoration: 'none', fontWeight: 400 }}>{x.l}</a>
            ))}
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>© 2025 Prokol Health</p>
            <a href="mailto:info@prokol.io" style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>info@prokol.io</a>
          </div>
        </div>
      </footer>

    </div>
  )
}
