import type { Metadata } from 'next'
import { DM_Sans } from 'next/font/google'
import Image from 'next/image'
import Link from 'next/link'
import { PersonalNav, PersonalFooter } from '@/app/components/PersonalSiteShell'

export const metadata: Metadata = {
  title: 'About Courtney Muscat — Coach, Nutritionist & Founder',
  description:
    'Accredited Sports Nutritionist, coach, competitor, and founder of Prokol. Two years coaching at Bambu Fitness, Bali, and nutrition coaching and educating clients directly.',
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
const HEAD = 'var(--font-sans, Geist, system-ui, sans-serif)'

const STATS = [
  { v: '200+', l: 'People led per class' },
  { v: '6+', l: 'Years coaching' },
  { v: '0→1', l: 'Meal prep business, from scratch' },
  { v: "'24", l: 'FMG Bikini Athletic Pro' },
]

const CURRENT_ROLES = [
  {
    tag: 'Founder & Builder',
    title: 'Prokol',
    href: '/',
    desc: 'After years coaching across gyms, group classes, and my own clients, I brought everything I’d learned into Prokol — the coaching platform I built and now run, used by coaches and their clients for nutrition, training, and cycle tracking in one place.',
  },
  {
    tag: 'Ongoing',
    title: 'Nutrition Coaching & Educating',
    href: '/work-with-me',
    desc: 'Everything that isn’t behind a screen — 1:1 clients, group classes, seminars, workshops, and nutrition consulting, wherever it’s needed. Personalised programs built around hormonal health and blood panel review, and education that actually sticks, not just another plan to follow for a few weeks.',
  },
]

const JOURNEY = [
  {
    year: '2018 – 2024',
    title: 'Where it started: Greater Western Allied Health',
    href: 'https://greaterwesternhealth.com.au/',
    desc: 'I spent six years as Receptionist & Practice Manager at Greater Western Allied Health, a multi-disciplinary clinic — working alongside podiatrists, chiropractors, and physiotherapists, and running the operations behind their client care. It’s where I learned how a real health practice is actually run, long before I was coaching one myself.',
  },
  {
    year: '2021 – 2024',
    title: 'Into coaching, at Women’s Fitness Collective',
    desc: 'I moved into group fitness coaching at Women’s Fitness Collective, an all-women’s gym — running strength & conditioning classes including pre and post-natal clients, alongside the social content and gym administration for the space.',
  },
  {
    year: '2022',
    title: 'Why I started competing',
    desc: 'I dove into competing — bikini and physique — to get a real, lived understanding of nutrition, not just a theoretical one. I wanted to know what it actually feels like to be on the receiving end of coaching before I asked anyone else to trust me with it.',
  },
  {
    year: '2023 onward',
    title: 'Coaching on every front, at once',
    desc: 'While still coaching on the gym floor, I started taking on my own nutrition clients at the same time. Program design, technique coaching, and nutrition coaching, side by side rather than one after the other.',
  },
  {
    year: '2024 – 2026',
    title: 'Two years at Bambu Fitness, Bali',
    href: 'https://www.bambufitnessbali.com/',
    desc: 'Coaching full-time across six modalities for classes of 200+, with 1:1 nutrition support alongside it. I held webinars on women’s health and women in training, and was a guest speaker at retreats across sport performance, body recomposition, healthy periods, and pre and post-menopause.',
  },
  {
    year: 'Jul 2024 – Apr 2026',
    title: 'Built Fuel by Bambu, a meal prep business',
    href: 'https://www.bambufitnessbali.com/fuel-by-bambu',
    desc: 'Alongside coaching, I helped build Fuel by Bambu from the ground up — a macro-balanced meal prep business based in Bali. I established the operational systems, worked directly with the chefs to turn recipes into balanced macros, ran the trials, and onboarded the first members. It’s still running today.',
  },
  {
    year: 'Now',
    title: 'Everything, together',
    desc: 'After Bambu, I brought every piece of it — coaching, nutrition, competing, and the systems I’d built — into Prokol, the platform I build and run today, alongside my own nutrition coaching and educating, and whatever comes next.',
  },
]

export default function AboutPage() {
  return (
    <div className={`${dmSans.variable} min-h-screen flex flex-col`} style={{ background: '#F6F3EF', fontFamily: 'var(--font-dm-sans,DM Sans,sans-serif)', color: INK }}>
      <PersonalNav active="about" />

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="px-6 pt-16 pb-16">
        <div className="max-w-5xl mx-auto grid md:grid-cols-[320px_1fr] gap-12 items-center">
          <div className="relative w-full max-w-xs mx-auto md:max-w-none rounded-3xl overflow-hidden shadow-xl" style={{ aspectRatio: '2 / 3' }}>
            <Image
              src="/about/courtney-muscat.jpg"
              alt="Courtney Muscat"
              fill
              sizes="(min-width: 768px) 320px, 280px"
              className="object-cover"
              priority
            />
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: BERRY }}>About Me</p>
            <h1 style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 'clamp(2rem,4.5vw,3rem)', lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 20 }}>
              Court: helping as many people as I can understand their body.
            </h1>
            <p className="text-lg leading-relaxed mb-5" style={{ color: INK_SOFT, fontWeight: 300 }}>
              That&apos;s genuinely it. Nutrition and training get made way more complicated than they need to be, and most people end up with more noise in their head than actual understanding of their own body. So I&apos;ve built things to fix that — I coach and educate people directly, and if I can&apos;t reach someone myself, I&apos;ve got programs, seminars, and Prokol — the platform other coaches use to help their own clients just as simply.
            </p>
            <p className="text-lg leading-relaxed mb-8" style={{ color: INK_SOFT, fontWeight: 300 }}>
              On paper: I&apos;m an Accredited Sports Nutritionist, qualified Personal Trainer, and Pilates instructor. I coach nutrition and training directly, spent two years coaching full-time at Bambu Fitness in Bali — where I also helped build Fuel by Bambu, a meal prep business, from the ground up — and I built Prokol, the platform behind basically everything else here.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/work-with-me" className="px-6 py-3 rounded-full text-sm font-bold text-white hover:opacity-90 transition-opacity" style={{ background: BERRY }}>
                See how we can work together →
              </Link>
              <a href="mailto:info@prokol.io" className="px-6 py-3 rounded-full text-sm font-semibold hover:bg-black/5 transition-colors" style={{ border: '1px solid rgba(33,26,23,0.15)', color: INK }}>
                Email me
              </a>
              <a href="https://instagram.com/courtneymuscat" target="_blank" rel="noopener noreferrer" className="text-sm font-semibold" style={{ color: INK_SOFT }}>
                @courtneymuscat
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stat strip ──────────────────────────────────────────────────── */}
      <section className="px-6 py-14" style={{ background: INK }}>
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-0">
          {STATS.map((s, i) => (
            <div key={s.l} className="text-center py-4" style={{ borderRight: i < STATS.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <p style={{ fontFamily: HEAD, fontWeight: 800, fontSize: '2.2rem', color: '#fff', lineHeight: 1 }}>{s.v}</p>
              <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.5)' }}>{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── What I do today ─────────────────────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 'clamp(1.6rem,3.5vw,2.2rem)', marginBottom: 12 }}>
              What I do today
            </h2>
            <p style={{ color: INK_SOFT, fontWeight: 300, maxWidth: 560, margin: '0 auto' }}>
              Two things running at once, each feeding the other.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {CURRENT_ROLES.map((r) => (
              <Link
                key={r.title}
                href={r.href}
                className="block rounded-2xl p-7 bg-white hover:shadow-lg transition-shadow"
                style={{ border: '1px solid rgba(33,26,23,0.08)' }}
              >
                <span className="inline-block text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full mb-4" style={{ background: 'rgba(140,59,82,0.1)', color: BERRY }}>
                  {r.tag}
                </span>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="font-bold text-lg" style={{ fontFamily: HEAD }}>{r.title}</p>
                  <span
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(140,59,82,0.1)', color: BERRY }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: INK_SOFT }}>{r.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── The journey so far ──────────────────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <h2 style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 'clamp(1.6rem,3.5vw,2.2rem)', marginBottom: 12 }}>
              The journey so far
            </h2>
            <p style={{ color: INK_SOFT, fontWeight: 300 }}>
              I didn&apos;t start on the gym floor.
            </p>
          </div>
          <div className="space-y-10">
            {JOURNEY.map((j, i) => (
              <div key={j.title} className="flex gap-6">
                <div className="flex flex-col items-center flex-shrink-0 w-24">
                  <span className="text-xs font-bold text-center" style={{ color: BERRY }}>{j.year}</span>
                  {i < JOURNEY.length - 1 && <span className="w-px flex-1 mt-3" style={{ background: 'rgba(33,26,23,0.12)' }} />}
                </div>
                <div className="pb-2">
                  {j.href ? (
                    <a
                      href={j.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold mb-2 inline-flex items-center gap-1.5 hover:underline"
                      style={{ fontFamily: HEAD, fontSize: '1.1rem', color: INK }}
                    >
                      {j.title}
                      <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: BERRY }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  ) : (
                    <p className="font-bold mb-2" style={{ fontFamily: HEAD, fontSize: '1.1rem' }}>{j.title}</p>
                  )}
                  <p className="text-sm leading-relaxed" style={{ color: INK_SOFT }}>{j.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Prokol exists ───────────────────────────────────────────── */}
      <section className="px-6 py-20" style={{ background: '#EFEAE2' }}>
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--nc-primary)' }}>Why Prokol Exists</p>
          <h2 style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 'clamp(1.5rem,3.5vw,2.1rem)', marginBottom: 16 }}>
            I built the system I needed as a coach — then opened it up.
          </h2>
          <p className="leading-relaxed mb-8" style={{ color: INK_SOFT, fontWeight: 300 }}>
            Across group classes, my own 1:1 coaching, and having helped build a meal prep business from scratch, I was juggling more apps than any one coach should have to. So I built the system I actually needed — nutrition, training, cycle tracking, and client management, all in one place — and opened it up for other coaches to run on too.
          </p>
          <Link href="/" className="inline-block px-6 py-3 rounded-full text-sm font-bold hover:opacity-90 transition-opacity" style={{ background: 'var(--nc-primary)', color: '#fff' }}>
            See the Prokol platform →
          </Link>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="px-6 py-20 flex-1 flex items-center">
        <div className="max-w-3xl mx-auto text-center w-full">
          <h2 style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 'clamp(1.5rem,3.5vw,2.1rem)', marginBottom: 16 }}>
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
