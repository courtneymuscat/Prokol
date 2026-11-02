import type { Metadata } from 'next'
import { DM_Sans } from 'next/font/google'
import Link from 'next/link'
import { PersonalNav, PersonalFooter } from '@/app/components/PersonalSiteShell'
import WaysToWorkWithMe from './WaysToWorkWithMe'

export const metadata: Metadata = {
  title: 'Work With Me — Courtney Muscat',
  description:
    'Nutrition coaching, gym & studio partnerships, seminars and workshops, food business consulting, and education built around understanding your body — Courtney Muscat, Accredited Sports Nutritionist.',
}

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  display: 'swap',
})

const INK = '#211A17'
const INK_SOFT = 'rgba(33,26,23,0.62)'
const BERRY = '#8C3B52'
const BERRY_DEEP = '#5E2537'
const HEAD = 'var(--font-sans, Geist, system-ui, sans-serif)'

export default function WorkWithMePage() {
  return (
    <div className={`${dmSans.variable} min-h-screen flex flex-col`} style={{ background: '#F6F3EF', fontFamily: 'var(--font-dm-sans,DM Sans,sans-serif)', color: INK }}>
      <PersonalNav active="work" />

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="px-6 pt-16 pb-14">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: BERRY }}>Work With Me</p>
          <h1 style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 'clamp(2rem,5vw,3rem)', lineHeight: 1.15, letterSpacing: '-0.02em', marginBottom: 20 }}>
            Understanding your body shouldn&apos;t be optional.
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: INK_SOFT, fontWeight: 300 }}>
            I coach, consult, and teach so people — especially young women — stop pushing through symptoms they&apos;ve been told are normal, and start understanding what their body is actually telling them.
          </p>
        </div>
      </section>

      {/* ── Why this matters to me ──────────────────────────────────────── */}
      <section className="px-6 py-20" style={{ background: BERRY_DEEP }}>
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest mb-6 text-center" style={{ color: 'rgba(255,255,255,0.55)' }}>Why This Matters To Me</p>
          <p style={{ fontFamily: HEAD, fontWeight: 700, fontSize: 'clamp(1.25rem,2.6vw,1.6rem)', lineHeight: 1.6, color: '#fff', marginBottom: 24 }}>
            I see too many young people — especially young women — who don&apos;t understand what their period symptoms are actually telling them. They&apos;re taught to push through pain, obsess over how they look instead of how they feel, and chase things that don&apos;t actually matter for their health. Nobody ever sat them down and explained what&apos;s happening in their body, or why it matters.
          </p>
          <p className="leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 300, fontSize: '1.05rem' }}>
            That&apos;s the gap every service on this page exists to close. Not more rules. Not more restriction. Real education and understanding — so people can live a whole life: symptomless periods, knowing what&apos;s actually happening in your body, food freedom instead of fear, and fuelling properly for how you want to perform. Long-term, I want to take this education into schools, so the next generation gets it before they spend years without it.
          </p>
        </div>
      </section>

      {/* ── Ways to work with me — interactive bubbles ──────────────────── */}
      <WaysToWorkWithMe />

      {/* ── Quiet mentoring note ─────────────────────────────────────────── */}
      <section className="px-6 pb-16">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-sm leading-relaxed" style={{ color: INK_SOFT }}>
            One more thing — if you&apos;re a coach or nutritionist building your own practice and any of this feels familiar, I&apos;ve been through it. Feel free to reach out; happy to help where I can.
          </p>
        </div>
      </section>

      {/* ── About link ──────────────────────────────────────────────────── */}
      <section className="px-6 pb-16">
        <div className="max-w-3xl mx-auto text-center">
          <p style={{ color: INK_SOFT, fontWeight: 300 }}>
            Want the longer version of who I am and why I do this?
          </p>
          <Link href="/about" className="inline-block mt-4 text-sm font-bold" style={{ color: BERRY }}>
            Read my story →
          </Link>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="px-6 py-20 flex-1 flex items-center" style={{ background: BERRY_DEEP }}>
        <div className="max-w-3xl mx-auto text-center w-full">
          <h2 style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 'clamp(1.6rem,3.5vw,2.2rem)', color: '#fff', marginBottom: 16 }}>
            Let&apos;s talk about your gym, your team, or you.
          </h2>
          <p className="leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 300 }}>
            Tell me a bit about what you&apos;re after and I&apos;ll get back to you directly.
          </p>
          <a href="mailto:info@prokol.io" className="inline-block px-8 py-4 rounded-full text-base font-bold hover:opacity-90 transition-opacity" style={{ background: '#fff', color: BERRY_DEEP }}>
            Email me — info@prokol.io
          </a>
        </div>
      </section>

      <PersonalFooter />
    </div>
  )
}
