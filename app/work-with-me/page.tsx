import type { Metadata } from 'next'
import { DM_Sans } from 'next/font/google'
import Link from 'next/link'
import { PersonalNav, PersonalFooter } from '@/app/components/PersonalSiteShell'

export const metadata: Metadata = {
  title: 'Work With Me — Courtney Muscat',
  description:
    'Nutrition coaching, in-house gym nutritionist partnerships, women’s health seminars, coach mentoring, and meal prep — work with Courtney Muscat.',
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

const SERVICES = [
  {
    icon: '🏋️',
    title: 'Your Gym or Studio’s In-House Nutritionist',
    desc: 'I work inside gyms and studios as their embedded nutrition coach — running member consults, building group nutrition offerings, and giving your trainers a nutrition specialist to lean on without hiring one full-time.',
    highlight: true,
  },
  {
    icon: '🥗',
    title: '1:1 Nutrition Coaching',
    desc: 'Direct coaching for individuals who want a structured, sustainable approach to food — built around their training, their schedule, and their actual life.',
  },
  {
    icon: '🌸',
    title: "Women's Health Seminars",
    desc: 'Talks and workshops for gyms, studios, and teams on training and eating around the female cycle — practical, not theoretical.',
  },
  {
    icon: '🌱',
    title: 'Coach Mentoring',
    desc: 'I mentor other coaches and nutritionists on building a practice that scales without burning out — systems, client load, and the business side nobody teaches.',
  },
  {
    icon: '🍱',
    title: 'Meal Prep Service',
    desc: 'A meal prep offering built around the same nutrition principles I coach with — currently in build, more details coming soon.',
  },
]

export default function WorkWithMePage() {
  return (
    <div className={`${dmSans.variable} min-h-screen flex flex-col`} style={{ background: '#F6F3EF', fontFamily: 'var(--font-dm-sans,DM Sans,sans-serif)', color: INK }}>
      <PersonalNav active="work" />

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="px-6 pt-16 pb-16">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: BERRY }}>Work With Me</p>
          <h1 style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 'clamp(2rem,5vw,3.2rem)', lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 20 }}>
            Hire me to coach your people — or your whole gym.
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: INK_SOFT, fontWeight: 300 }}>
            I work with individuals, gyms, and studios who want real nutrition expertise behind their training — not a generic meal plan PDF. Here&apos;s what that looks like.
          </p>
        </div>
      </section>

      {/* ── Services ────────────────────────────────────────────────────── */}
      <section className="px-6 pb-20">
        <div className="max-w-4xl mx-auto grid gap-5">
          {SERVICES.map((s) => (
            <div
              key={s.title}
              className="rounded-2xl p-7 flex gap-5"
              style={s.highlight
                ? { background: BERRY_DEEP, color: '#fff' }
                : { background: '#fff', border: '1px solid rgba(33,26,23,0.08)' }}
            >
              <span className="text-3xl flex-shrink-0">{s.icon}</span>
              <div>
                <p className="font-bold text-lg mb-1.5" style={{ fontFamily: HEAD }}>{s.title}</p>
                <p className="text-sm leading-relaxed" style={{ color: s.highlight ? 'rgba(255,255,255,0.8)' : INK_SOFT }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How a gym partnership works ─────────────────────────────────── */}
      <section className="px-6 py-20" style={{ background: '#EFEAE2' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 'clamp(1.6rem,3.5vw,2.2rem)', marginBottom: 12 }}>
              How a gym partnership actually works
            </h2>
            <p style={{ color: INK_SOFT, fontWeight: 300, maxWidth: 560, margin: '0 auto' }}>
              I don&apos;t show up with a clipboard and disappear. I bring the same system I coach with every day.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: '01', t: 'We scope it together', d: 'Member consults, group programs, a seminar series — we figure out what fits your members and your trainers.' },
              { n: '02', t: 'I run it on Prokol', d: 'Every client gets onboarded, tracked, and automated through Prokol — the coaching platform I built and run myself. Check-ins, nutrition targets, and programs stay organised without extra admin for your team.' },
              { n: '03', t: 'Your gym gets the system too', d: 'Partnering with me is also the easiest way to bring Autoflow — Prokol’s automation layer — into your own coaching, if that’s something your trainers want long-term.' },
            ].map((step) => (
              <div key={step.n}>
                <p className="text-xs font-bold tracking-widest mb-2" style={{ color: BERRY }}>{step.n}</p>
                <p className="font-bold mb-2" style={{ fontFamily: HEAD }}>{step.t}</p>
                <p className="text-sm leading-relaxed" style={{ color: INK_SOFT }}>{step.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── About link ──────────────────────────────────────────────────── */}
      <section className="px-6 py-16">
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
