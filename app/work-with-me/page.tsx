import type { Metadata } from 'next'
import { DM_Sans } from 'next/font/google'
import Image from 'next/image'
import Link from 'next/link'
import { PersonalNav, PersonalFooter } from '@/app/components/PersonalSiteShell'
import { InquiryButton } from '@/app/components/InquiryForm'
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
const BERRY = '#1D9E75'
const BERRY_DEEP = '#0F6E56'
const HEAD = 'var(--font-sans, Geist, system-ui, sans-serif)'

export default function WorkWithMePage() {
  return (
    <div className={`${dmSans.variable} min-h-screen flex flex-col`} style={{ background: '#F6F3EF', fontFamily: 'var(--font-dm-sans,DM Sans,sans-serif)', color: INK }}>
      <PersonalNav active="work" />

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="px-6 pt-16 pb-16">
        <div className="max-w-5xl mx-auto grid md:grid-cols-[280px_1fr] gap-12 items-center">
          <div className="relative w-full max-w-xs mx-auto md:max-w-none rounded-3xl overflow-hidden shadow-xl" style={{ aspectRatio: '2 / 3' }}>
            <Image
              src="/work-with-me/courtney-laptop.jpg"
              alt="Courtney Muscat"
              fill
              sizes="(min-width: 768px) 280px, 280px"
              className="object-cover"
              priority
            />
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: BERRY }}>Work With Me</p>
            <h1 style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 'clamp(2rem,5vw,3rem)', lineHeight: 1.15, letterSpacing: '-0.02em', marginBottom: 20 }}>
              Understanding your body shouldn&apos;t be optional.
            </h1>
            <p className="text-lg leading-relaxed mb-6" style={{ color: INK_SOFT, fontWeight: 300 }}>
              I coach, consult, teach, and partner with gyms and studios so people stop pushing through symptoms they&apos;ve been told are normal, and start understanding what their body is actually telling them — whether that&apos;s one person, a whole gym membership, or a room full of people at once.
            </p>
            <p className="text-lg leading-relaxed mb-6" style={{ color: INK_SOFT, fontWeight: 300 }}>
              I see too many people chasing a goal they never quite reach, or reach and can&apos;t hold onto — following rules without understanding why they work, and pushing through symptoms instead of listening to them. My point of difference is education, not more rules: if you don&apos;t understand the why behind what you&apos;re doing, you&apos;re not learning, you&apos;re just doing — and that&apos;s exactly how people end up giving up. Every service here exists to close that gap, so people can actually sustain their results, live symptom-free, eat without fear, and fuel properly for how they want to perform.
            </p>
            <div className="rounded-xl px-5 py-4" style={{ background: '#fff', borderLeft: `3px solid ${BERRY}` }}>
              <p className="text-sm leading-relaxed" style={{ color: INK_SOFT }}>
                Women&apos;s health is one of my specialties — cycles, hormones and perimenopause change what a body actually needs, and most nutrition education leaves that out entirely, so it&apos;s never an afterthought in anything I build or teach. But it&apos;s a specialty, not the whole offering: everything here works exactly the same way whether you&apos;re a man, a woman, an athlete, or an entire gym team.
              </p>
            </div>
          </div>
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
          <InquiryButton className="inline-block px-8 py-4 rounded-full text-base font-bold hover:opacity-90 transition-opacity" style={{ background: '#fff', color: BERRY_DEEP }}>
            Get in touch
          </InquiryButton>
        </div>
      </section>

      <PersonalFooter />
    </div>
  )
}
