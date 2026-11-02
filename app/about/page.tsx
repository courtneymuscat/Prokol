import type { Metadata } from 'next'
import { DM_Sans } from 'next/font/google'
import Link from 'next/link'
import { PersonalNav, PersonalFooter } from '@/app/components/PersonalSiteShell'

export const metadata: Metadata = {
  title: 'About Courtney Muscat — Prokol Health',
  description:
    'Nutrition coach, women’s health educator, and the founder of Prokol — the coaching platform built from real coaching practice.',
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

const WHAT_I_DO = [
  { icon: '🥗', label: 'Nutrition Coaching', desc: '1:1 coaching for people who want a sustainable, data-informed approach to food.' },
  { icon: '🏋️', label: 'Gym Partnerships', desc: 'In-house nutrition support for gyms and studios who want to offer more than training.' },
  { icon: '🌸', label: "Women's Health Seminars", desc: 'Talks and workshops on training and eating around the female cycle.' },
  { icon: '🌱', label: 'Mentoring Coaches', desc: 'Helping other coaches build a practice that actually holds up under real client load.' },
]

export default function AboutPage() {
  return (
    <div className={`${dmSans.variable} min-h-screen flex flex-col`} style={{ background: '#F6F3EF', fontFamily: 'var(--font-dm-sans,DM Sans,sans-serif)', color: INK }}>
      <PersonalNav active="about" />

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="px-6 pt-16 pb-20">
        <div className="max-w-5xl mx-auto grid md:grid-cols-[280px_1fr] gap-12 items-center">
          {/* Photo placeholder — swap for a real headshot (square or portrait, ~800px) */}
          <div
            className="w-56 h-56 md:w-72 md:h-72 rounded-full mx-auto md:mx-0 flex items-center justify-center flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${BERRY} 0%, ${BERRY_DEEP} 100%)` }}
          >
            <span style={{ fontFamily: 'var(--font-sans, Geist, system-ui, sans-serif)', fontWeight: 800, fontSize: '3.5rem', color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.02em' }}>
              CM
            </span>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: BERRY }}>About Me</p>
            <h1 style={{ fontFamily: 'var(--font-sans, Geist, system-ui, sans-serif)', fontWeight: 800, fontSize: 'clamp(2rem,4.5vw,3rem)', lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 20 }}>
              I&apos;m Courtney Muscat.
            </h1>
            <p className="text-lg leading-relaxed mb-5" style={{ color: INK_SOFT, fontWeight: 300 }}>
              I&apos;m a nutrition coach who got tired of watching good coaching get buried under bad tools — so I built my own. Today I split my time between coaching clients directly, teaching on women&apos;s health, mentoring other coaches, and running Prokol, the platform behind all of it.
            </p>
            <p className="text-lg leading-relaxed mb-8" style={{ color: INK_SOFT, fontWeight: 300 }}>
              If you&apos;re here because you want to work with me directly — as a client, a gym, or a studio — that&apos;s this way too.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/work-with-me" className="px-6 py-3 rounded-full text-sm font-bold text-white hover:opacity-90 transition-opacity" style={{ background: BERRY }}>
                See how we can work together →
              </Link>
              <a href="mailto:info@prokol.io" className="px-6 py-3 rounded-full text-sm font-semibold hover:bg-black/5 transition-colors" style={{ border: `1px solid rgba(33,26,23,0.15)`, color: INK }}>
                Email me
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Philosophy band ─────────────────────────────────────────────── */}
      <section className="px-6 py-20" style={{ background: BERRY_DEEP }}>
        <div className="max-w-3xl mx-auto text-center">
          <p style={{ fontFamily: 'var(--font-sans, Geist, system-ui, sans-serif)', fontWeight: 700, fontSize: 'clamp(1.4rem,3vw,2rem)', lineHeight: 1.45, color: '#fff' }}>
            &ldquo;Good coaching isn&apos;t more restriction. It&apos;s better information, used consistently, by someone who&apos;s actually paying attention.&rdquo;
          </p>
          <p className="mt-6 text-sm font-semibold tracking-wide" style={{ color: 'rgba(255,255,255,0.55)' }}>— the principle behind every client plan I write, and every line of Prokol</p>
        </div>
      </section>

      {/* ── What I do ───────────────────────────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 style={{ fontFamily: 'var(--font-sans, Geist, system-ui, sans-serif)', fontWeight: 800, fontSize: 'clamp(1.6rem,3.5vw,2.2rem)', marginBottom: 12 }}>
              What I actually spend my time on
            </h2>
            <p style={{ color: INK_SOFT, fontWeight: 300, maxWidth: 520, margin: '0 auto' }}>
              Four things, all connected — coaching informs the seminars, the seminars inform the mentoring, and all of it runs through the same system.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            {WHAT_I_DO.map((item) => (
              <div key={item.label} className="rounded-2xl p-6 bg-white" style={{ border: '1px solid rgba(33,26,23,0.08)' }}>
                <span className="text-2xl">{item.icon}</span>
                <p className="font-bold mt-3 mb-1.5" style={{ fontFamily: 'var(--font-sans, Geist, system-ui, sans-serif)' }}>{item.label}</p>
                <p className="text-sm leading-relaxed" style={{ color: INK_SOFT }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Prokol exists ───────────────────────────────────────────── */}
      <section className="px-6 py-20" style={{ background: '#EFEAE2' }}>
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--nc-primary)' }}>Why Prokol Exists</p>
          <h2 style={{ fontFamily: 'var(--font-sans, Geist, system-ui, sans-serif)', fontWeight: 800, fontSize: 'clamp(1.5rem,3.5vw,2.1rem)', marginBottom: 16 }}>
            I built the system I needed as a coach — then opened it up.
          </h2>
          <p className="leading-relaxed mb-8" style={{ color: INK_SOFT, fontWeight: 300 }}>
            Every piece of Prokol exists because I needed it in my own practice first: a way to track a client&apos;s nutrition, training, and cycle in one place, automate the admin, and still coach like a human instead of a spreadsheet. It&apos;s now the same system I bring with me into every gym partnership.
          </p>
          <Link href="/" className="inline-block px-6 py-3 rounded-full text-sm font-bold hover:opacity-90 transition-opacity" style={{ background: 'var(--nc-primary)', color: '#fff' }}>
            See the Prokol platform →
          </Link>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="px-6 py-20 flex-1 flex items-center">
        <div className="max-w-3xl mx-auto text-center w-full">
          <h2 style={{ fontFamily: 'var(--font-sans, Geist, system-ui, sans-serif)', fontWeight: 800, fontSize: 'clamp(1.5rem,3.5vw,2.1rem)', marginBottom: 16 }}>
            Want to work together?
          </h2>
          <p className="leading-relaxed mb-8" style={{ color: INK_SOFT, fontWeight: 300 }}>
            Whether that&apos;s 1:1 coaching, bringing me into your gym as your in-house nutritionist, booking a seminar, or something else entirely — I&apos;d like to hear about it.
          </p>
          <a href="mailto:info@prokol.io" className="inline-block px-8 py-4 rounded-full text-base font-bold text-white hover:opacity-90 transition-opacity" style={{ background: BERRY }}>
            Email me — info@prokol.io
          </a>
        </div>
      </section>

      <PersonalFooter />
    </div>
  )
}
