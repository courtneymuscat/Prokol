import type { Metadata } from 'next'
import { DM_Sans } from 'next/font/google'
import Image from 'next/image'
import Link from 'next/link'
import { PersonalNav, PersonalFooter } from '@/app/components/PersonalSiteShell'

export const metadata: Metadata = {
  title: 'About Courtney Muscat — Coach, Nutritionist & Founder',
  description:
    'Accredited Sports Nutritionist, coach, competitor, and founder of Prokol, Better U, and Fuel by Bambu. Coaching full-time at Bambu Fitness, Bali.',
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

const STATS = [
  { v: '200+', l: 'Coached per class' },
  { v: '2', l: 'Businesses built from scratch' },
  { v: '6', l: 'Coaching & nutrition qualifications' },
  { v: "'24", l: 'CrossFit Open Quarterfinalist' },
]

const CURRENT_ROLES = [
  {
    tag: 'Full-Time',
    title: 'Coach, Bambu Fitness — Bali',
    desc: 'I lead CrossFit, Shred, Hyrox, Booty, Gymnastics, and Reformer Pilates classes — up to 200+ people at a time — plus 1:1 nutrition support within my accredited scope, with a focus on female health. I also host hormonal-health seminars for the gym’s retreats and wider community.',
  },
  {
    tag: 'Since 2023',
    title: 'Founder, Better U',
    desc: 'My own online coaching brand. Personalised training and nutrition programs built around female hormonal health, including blood panel review and hormonal health education — plus every bit of the content, communication, and program design behind it.',
  },
  {
    tag: 'Built & Launched',
    title: 'Fuel by Bambu',
    desc: 'I designed and launched Bambu Fitness’s in-house meal prep service from nothing — built the operational systems, worked with the chefs to turn recipes into balanced macros, ran the trials, and onboarded the first members. It’s still running today.',
  },
]

const SKILL_GROUPS = [
  {
    label: 'Nutrition & Hormonal Health',
    skills: ['Accredited Sports Nutritionist (SNA)', 'Hormonal Health Education', 'Blood Panel Review', 'Sports Nutrition & Meal Prep', 'Pre & Post Natal Nutrition'],
  },
  {
    label: 'Movement, Training & Rehab',
    skills: ['CrossFit Level 1', 'Cert III & IV in Fitness', 'Cert IV in Allied Health Assistance', 'Pilates Instructor (InBalance Education)', 'TGA Gymnastics Course', 'Strength & Conditioning', 'Reformer Pilates', 'HIIT / Hyrox / Shred', 'Booty / Glute Programming', 'Rehab & Pre-hab'],
  },
]

const ACHIEVEMENTS = [
  { year: '2024', label: 'FMG Bikini Athletic Pro' },
  { year: '2024', label: 'Quarterfinalist, CrossFit Open' },
  { year: '2023', label: '3rd Place, WBFF' },
  { year: '2022', label: '3rd Place, WBFF Debut' },
]

const JOURNEY = [
  {
    year: '2018 – 2024',
    title: 'Where it started: allied health',
    desc: 'I spent six years as Receptionist & Practice Manager at a multi-disciplinary allied health clinic — working alongside podiatrists, chiropractors, and physiotherapists, and running the operations behind their client care. It’s where I learned how a real health practice is actually run, long before I was coaching one myself.',
  },
  {
    year: '2021 – 2024',
    title: 'Into coaching',
    desc: 'I moved into group fitness coaching at an all-women’s gym, including pre and post-natal clients — and picked up the social content and gym administration alongside it.',
  },
  {
    year: '2023 – Present',
    title: 'Going out on my own',
    desc: 'I founded Better U, and started casual CrossFit coaching and 1:1 personal training — building program design, technique coaching, and client accountability into a full practice.',
  },
  {
    year: '2024 – 2026',
    title: 'Bambu Fitness, Bali',
    desc: 'Now coaching full-time across six modalities for classes of 200+, while building and launching Fuel by Bambu alongside it.',
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
              I&apos;m Court — coach, nutritionist, competitor, founder.
            </h1>
            <p className="text-lg leading-relaxed mb-5" style={{ color: INK_SOFT, fontWeight: 300 }}>
              I&apos;m an Accredited Sports Nutritionist, qualified Personal Trainer, and Pilates instructor, currently coaching full-time at Bambu Fitness in Bali. I also run Better U, my own coaching brand, and I built Fuel by Bambu — a macro-balanced meal prep service — from the ground up.
            </p>
            <p className="text-lg leading-relaxed mb-8" style={{ color: INK_SOFT, fontWeight: 300 }}>
              Nutrition, movement, and competing aren&apos;t separate things for me — it&apos;s one practice, and I bring all of it into every client and every gym I work with.
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
              Three things running at once, all feeding each other.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {CURRENT_ROLES.map((r) => (
              <div key={r.title} className="rounded-2xl p-7 bg-white" style={{ border: '1px solid rgba(33,26,23,0.08)' }}>
                <span className="inline-block text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full mb-4" style={{ background: 'rgba(140,59,82,0.1)', color: BERRY }}>
                  {r.tag}
                </span>
                <p className="font-bold text-lg mb-2" style={{ fontFamily: HEAD }}>{r.title}</p>
                <p className="text-sm leading-relaxed" style={{ color: INK_SOFT }}>{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Credentials & Expertise ─────────────────────────────────────── */}
      <section className="px-6 py-20" style={{ background: '#EFEAE2' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: BERRY }}>Credentials & Expertise</p>
            <h2 style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 'clamp(1.6rem,3.5vw,2.2rem)' }}>
              A rare combination, on purpose
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {SKILL_GROUPS.map((g) => (
              <div key={g.label} className="rounded-2xl p-7 bg-white" style={{ border: '1px solid rgba(33,26,23,0.08)' }}>
                <p className="font-bold mb-4" style={{ fontFamily: HEAD, fontSize: '1.05rem' }}>{g.label}</p>
                <div className="flex flex-wrap gap-2">
                  {g.skills.map((s) => (
                    <span key={s} className="text-xs font-medium px-3 py-1.5 rounded-full" style={{ background: 'rgba(33,26,23,0.05)', color: INK }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── On the competition floor ────────────────────────────────────── */}
      <section className="px-6 py-20" style={{ background: BERRY_DEEP }}>
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.55)' }}>On The Competition Floor</p>
          <h2 style={{ fontFamily: HEAD, fontWeight: 700, fontSize: 'clamp(1.4rem,3vw,1.9rem)', color: '#fff', marginBottom: 32, lineHeight: 1.4 }}>
            Everything I coach, I&apos;ve also competed at. I don&apos;t ask a client to do anything I haven&apos;t tested on myself.
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {ACHIEVEMENTS.map((a) => (
              <div key={a.label} className="flex items-center gap-2.5 px-4 py-2.5 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <span className="text-xs font-bold" style={{ color: '#fff' }}>{a.year}</span>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.75)' }}>{a.label}</span>
              </div>
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
                  <p className="font-bold mb-2" style={{ fontFamily: HEAD, fontSize: '1.1rem' }}>{j.title}</p>
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
            Between coaching 200+ people a week across six modalities, running Better U&apos;s client programs, and having built a meal prep service from scratch, I was juggling more apps than any one coach should have to. So I built the system I actually needed — nutrition, training, cycle tracking, and client management, all in one place — and opened it up for other coaches to run on too.
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
