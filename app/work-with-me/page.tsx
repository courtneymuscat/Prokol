import type { Metadata } from 'next'
import { DM_Sans } from 'next/font/google'
import Link from 'next/link'
import { PersonalNav, PersonalFooter } from '@/app/components/PersonalSiteShell'

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

const COACHING_TIERS = [
  {
    tag: 'Low-commitment entry point',
    title: 'Nutrition Consultations',
    price: 'from $230',
    desc: 'A single Initial Consultation for a specific question, or the Reset Series (consult + 2 follow-ups) for a defined block of support — no ongoing commitment.',
    points: ['Full goals, training & health history review', 'Bloodwork & biofeedback interpreted through a nutrition lens', 'Bespoke plan delivered via Loom walkthrough'],
  },
  {
    tag: 'Highest level of support',
    title: 'Premium Nutrition Coaching',
    price: '$550 / month',
    desc: 'My flagship offer — for people navigating performance, hormones, and physique all at once, and want the most hands-on, data-informed coaching I offer.',
    points: ['Weekly 1:1 calls or Loom check-ins', 'Priority 1:1 messaging between calls', 'Ongoing blood marker & biofeedback tracking', 'Cycle-informed fuelling & recovery protocols'],
    highlight: true,
  },
  {
    tag: 'Monthly recalibration',
    title: 'Specialised Nutrition Coaching',
    price: '$215 / month',
    desc: 'For people who know how to execute and want professional oversight without weekly calls or daily messaging.',
    points: ['One 1:1 check-in per month', 'Strategy reviewed & recalibrated monthly', 'Cycle & hormone considerations integrated'],
  },
  {
    tag: 'Add-on, once you’re dialled in',
    title: 'Accountability Continuation',
    price: '$180 / month',
    desc: 'For clients who’ve already done the groundwork and want to stay accountable without paying for a full strategy rebuild every month.',
    points: ['Weekly async check-in — no live call', 'Light-touch review of adherence & symptoms', 'Available after a consult or coaching program'],
  },
]

const HOW_IT_WORKS = [
  { n: '01', t: 'Discovery call', d: 'A conversation about your goals, training, and lifestyle — and where you actually fit, consultation or ongoing coaching.' },
  { n: '02', t: 'Your personalised plan', d: 'Built from a full intake and a 45-minute consult, delivered 2–3 business days later via a proper Loom walkthrough — never rushed out live on the call.' },
  { n: '03', t: 'Ongoing support, your way', d: 'Weekly, monthly, or async — whatever level of contact matches the tier you’re on.' },
]

const OTHER_WAYS = [
  {
    icon: '🌱',
    title: 'Accessible Education Program',
    badge: 'Building now',
    desc: 'The same education-first framework behind my 1:1 coaching, built at a price point designed for access, not exclusivity. This is what I’ll offer individual clients directly — and the exact same framework I bring into gym and studio partnerships, so a whole gym community gets this education, not just the members who can afford premium coaching.',
  },
  {
    icon: '🏋️',
    title: 'Gym & Studio Partnerships',
    desc: 'I work inside gyms and studios as an Accredited Sports Nutritionist and coach — member consults, group nutrition offerings, and a nutrition specialist your trainers can lean on without a full-time hire. At Bambu Fitness I coach classes of 200+ across six modalities with nutrition support built in — I know what this looks like at real scale.',
  },
  {
    icon: '🎤',
    title: 'Seminars, Workshops & Webinars',
    desc: 'In-person talks for gyms, studios, and teams, or virtual workshops and webinars for anyone who can’t get me in the room. Practical female-health education — the same material I coach 1:1 with, just delivered to a room or a screen full of people at once.',
  },
  {
    icon: '🍱',
    title: 'Nutrition Consulting for Food Businesses',
    desc: 'I consult with food businesses — meal prep services, cafés, health-food brands — on nutrition input, recipe development, and macro-balanced menu design. I’ve done this from the inside: I built Fuel by Bambu’s entire nutrition framework from scratch, working directly with chefs to turn recipes into balanced macros.',
  },
]

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

      {/* ── 1:1 Nutrition Coaching ──────────────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-4">
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: BERRY }}>Ways To Work With Me</p>
            <h2 style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 'clamp(1.7rem,4vw,2.4rem)', marginBottom: 12 }}>
              1:1 Nutrition Coaching
            </h2>
            <p style={{ color: INK_SOFT, fontWeight: 300, maxWidth: 580, margin: '0 auto' }}>
              Four levels of support, from one clear answer to full ongoing coaching — built around your goals and your calendar, not the other way around.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5 mt-14">
            {COACHING_TIERS.map((t) => (
              <div
                key={t.title}
                className="rounded-2xl p-7"
                style={t.highlight ? { background: BERRY_DEEP, color: '#fff' } : { background: '#fff', border: '1px solid rgba(33,26,23,0.08)' }}
              >
                <span
                  className="inline-block text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full mb-4"
                  style={t.highlight ? { background: 'rgba(255,255,255,0.15)', color: '#fff' } : { background: 'rgba(140,59,82,0.1)', color: BERRY }}
                >
                  {t.tag}
                </span>
                <div className="flex items-baseline justify-between gap-3 mb-2">
                  <p className="font-bold text-lg" style={{ fontFamily: HEAD }}>{t.title}</p>
                  <p className="font-bold text-sm flex-shrink-0" style={{ color: t.highlight ? '#fff' : BERRY }}>{t.price}</p>
                </div>
                <p className="text-sm leading-relaxed mb-4" style={{ color: t.highlight ? 'rgba(255,255,255,0.8)' : INK_SOFT }}>{t.desc}</p>
                <ul className="space-y-1.5">
                  {t.points.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-xs" style={{ color: t.highlight ? 'rgba(255,255,255,0.75)' : INK_SOFT }}>
                      <span className="mt-1 w-1 h-1 rounded-full flex-shrink-0" style={{ background: t.highlight ? 'rgba(255,255,255,0.6)' : BERRY }} />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* How it works */}
          <div className="grid md:grid-cols-3 gap-6 mt-16 pt-16" style={{ borderTop: '1px solid rgba(33,26,23,0.08)' }}>
            {HOW_IT_WORKS.map((step) => (
              <div key={step.n}>
                <p className="text-xs font-bold tracking-widest mb-2" style={{ color: BERRY }}>{step.n}</p>
                <p className="font-bold mb-2" style={{ fontFamily: HEAD }}>{step.t}</p>
                <p className="text-sm leading-relaxed" style={{ color: INK_SOFT }}>{step.d}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-14">
            <p className="text-sm mb-4" style={{ color: INK_SOFT }}>Not sure which fits? Every journey starts with a conversation, not a sign-up form.</p>
            <a href="mailto:info@prokol.io" className="inline-block px-7 py-3.5 rounded-full text-sm font-bold text-white hover:opacity-90 transition-opacity" style={{ background: BERRY }}>
              Book a discovery call
            </a>
          </div>
        </div>
      </section>

      {/* ── Other ways to work with me ──────────────────────────────────── */}
      <section className="px-6 py-20" style={{ background: '#EFEAE2' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 'clamp(1.6rem,3.5vw,2.2rem)', marginBottom: 12 }}>
              Beyond 1:1 coaching
            </h2>
            <p style={{ color: INK_SOFT, fontWeight: 300, maxWidth: 560, margin: '0 auto' }}>
              The same education and standards, built for however you actually need them.
            </p>
          </div>
          <div className="grid gap-5">
            {OTHER_WAYS.map((s) => (
              <div key={s.title} className="rounded-2xl p-7 flex gap-5 bg-white" style={{ border: '1px solid rgba(33,26,23,0.08)' }}>
                <span className="text-3xl flex-shrink-0">{s.icon}</span>
                <div>
                  <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                    <p className="font-bold text-lg" style={{ fontFamily: HEAD }}>{s.title}</p>
                    {s.badge && (
                      <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full" style={{ background: 'rgba(29,158,117,0.1)', color: 'var(--nc-primary)' }}>
                        {s.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: INK_SOFT }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How a gym partnership works ─────────────────────────────────── */}
      <section className="px-6 py-20">
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
              { n: '01', t: 'We scope it together', d: 'Member consults, group programs, a seminar series, the accessible education program — we figure out what fits your members and your trainers.' },
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
