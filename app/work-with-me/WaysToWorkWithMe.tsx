'use client'

import { useState } from 'react'
import { InquiryButton } from '@/app/components/InquiryForm'

const INK = '#211A17'
const INK_SOFT = 'rgba(33,26,23,0.62)'
const BERRY = '#1D9E75'
const BERRY_DEEP = '#0F6E56'
const HEAD = 'var(--font-sans, Geist, system-ui, sans-serif)'

type ServiceKey = 'coaching' | 'education' | 'gyms' | 'seminars' | 'consulting'

const BUBBLES: { key: ServiceKey; label: string }[] = [
  { key: 'coaching', label: '1:1 Nutrition Coaching' },
  { key: 'education', label: 'The Prokol Method' },
  { key: 'gyms', label: 'Gym & Studio Partnerships' },
  { key: 'seminars', label: 'Seminars, Workshops & Webinars' },
  { key: 'consulting', label: 'Food Business Consulting' },
]

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

const GYM_STEPS = [
  { n: '01', t: 'We scope it together', d: 'Member consults, group programs, a seminar series, The Prokol Method — we figure out what fits your members and your trainers.' },
  { n: '02', t: 'I run it on Prokol', d: 'Every client gets onboarded, tracked, and automated through Prokol — the coaching platform I built and run myself. Check-ins, nutrition targets, and programs stay organised without extra admin for your team.' },
  { n: '03', t: 'Your gym gets the system too', d: 'Partnering with me is also the easiest way to bring Autoflow — Prokol’s automation layer — into your own coaching, if that’s something your trainers want long-term.' },
]

const EDUCATION_CARDS = [
  {
    tag: 'Learn at your own pace',
    title: 'Self-guided',
    subtitle: '13 weeks for just $249',
    priceLabel: '13 weeks · one payment',
    price: '$249',
    priceNote: 'for the full 13 weeks',
    priceWeekly: 'That’s about $19 a week',
    desc: 'Everything you need to understand nutrition and put it into practice yourself, one small step at a time.',
    points: [
      '13 weeks of short video lessons: Week 0 to get set up, then one new lesson every week',
      'One simple habit each week, matched to the path you choose',
      'Your personalised plan, daily serves and targets in the Prokol app',
      '24 downloadable guides you keep, from protein and carbs to eating out and sleep',
      'The women’s health bonus library: your cycle, iron, energy, menopause and bloodwork',
      'Weekly progress check-ins with photos, so you can see how far you’ve come',
      'Choose your path: Plan and Swap, Track Serves, or Protein + Calories',
    ],
    button: 'Start Self-guided',
    service: 'The Prokol Method — Self-guided',
  },
  {
    tag: 'Most support',
    title: 'Guided',
    subtitle: 'with weekly check-in replies',
    priceLabel: '13 weeks · one payment',
    price: '$449',
    priceNote: 'for the full 13 weeks, with weekly check-in replies',
    priceWeekly: 'That’s about $35 a week',
    desc: 'Everything in Self-guided, plus me reading your check-in and replying every week, so you’re never doing it alone.',
    points: [
      'Everything in Self-guided',
      'A personal reply from me to your weekly in-app check-in, every week for 13 weeks',
      'Feedback on your progress photos, habits, energy, sleep and hunger',
      'Tweaks to your plan when life, training or your goals change',
      'Course-correct early, so small slips don’t turn into big ones',
    ],
    button: 'Start Guided',
    service: 'The Prokol Method — Guided',
    highlight: true,
  },
]

const WHATS_INCLUDED = [
  { label: '25 short video lessons', d: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
  { label: '24 downloadable guides', d: 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H8a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { label: 'Weekly habits matched to your path', d: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { label: 'Progress tracking: photos, check-ins and trends', d: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
]

const EDUCATION_HOW_IT_WORKS = [
  { n: '01', t: 'Pick your option', d: 'Pick your option and complete a short intake so your plan fits you.' },
  { n: '02', t: 'Start Week 0', d: 'Get your plan in the app and start Week 0. Each lesson unlocks when you finish the last.' },
  { n: '03', t: 'One lesson a week', d: 'One new lesson each week for 12 weeks, with a habit to practise and a check-in on day 7.' },
]

const EDUCATION_FAQS = [
  { q: 'How is this different from 1:1 coaching?', a: 'The Prokol Method gives everyone the same course, resources and app, built on the framework I use with 1:1 clients. 1:1 coaching is fully built around you, with calls, bloodwork and biofeedback review, and messaging.' },
  { q: 'Do I need to follow a meal plan?', a: 'No. On the Plan and Swap path you keep eating the foods you already eat and make one small swap each week. Your plan is there for ideas.' },
  { q: 'What if I fall behind?', a: 'Nothing is lost. Lessons stay unlocked, and you can pick up where you left off. You keep access after the 13 weeks.' },
  { q: 'What do I get with Guided?', a: 'One personal reply to each weekly check-in. It isn’t unlimited messaging; that’s what 1:1 coaching is for.' },
  { q: 'Can I switch from Self-guided to Guided?', a: 'Yes. Pay the difference at any time and your weekly replies start from your next check-in.' },
  { q: 'Is this medical advice?', a: 'No. The program is education. Anything medical goes to your GP.' },
]

const SIMPLE_PANELS: Record<Exclude<ServiceKey, 'coaching' | 'education'>, { icon: string; badge?: string; desc: string }> = {
  gyms: {
    icon: '🏋️',
    desc: 'I work inside gyms and studios as an Accredited Sports Nutritionist and coach — member consults, group nutrition offerings, and a nutrition specialist your trainers can lean on without a full-time hire. At Bambu Fitness I coached classes of 200+ across six modalities with nutrition support built in — I know what this looks like at real scale.',
  },
  seminars: {
    icon: '🎤',
    desc: 'In-person talks for gyms, studios, and teams, or virtual workshops and webinars for anyone who can’t get me in the room. Practical female-health education — the same material I coach 1:1 with, just delivered to a room or a screen full of people at once.',
  },
  consulting: {
    icon: '🍱',
    desc: 'I consult with food businesses — meal prep services, cafés, health-food brands — on nutrition input, recipe development, and macro-balanced menu design. I’ve done this from the inside: I helped build Fuel by Bambu’s entire nutrition framework, working directly with chefs to turn recipes into balanced macros.',
  },
}

export default function WaysToWorkWithMe() {
  const [active, setActive] = useState<ServiceKey>('coaching')
  const activeLabel = BUBBLES.find((b) => b.key === active)?.label ?? ''

  return (
    <section className="px-6 py-20">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-4">
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: BERRY }}>Ways To Work With Me</p>
          <h2 style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 'clamp(1.7rem,4vw,2.4rem)', marginBottom: 12 }}>
            Choose where to start
          </h2>
          <p style={{ color: INK_SOFT, fontWeight: 300, maxWidth: 580, margin: '0 auto' }}>
            Tap a option below to see what it actually involves.
          </p>
        </div>

        {/* Bubbles */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-10">
          {BUBBLES.map((b) => {
            const isActive = active === b.key
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => setActive(b.key)}
                className="px-5 py-3 rounded-full text-sm font-semibold transition-colors"
                style={isActive
                  ? { background: BERRY, color: '#fff' }
                  : { background: '#fff', color: INK, border: '1px solid rgba(33,26,23,0.12)' }}
              >
                {b.label}
              </button>
            )
          })}
        </div>

        {/* Expanded panel */}
        <div className="mt-14">
          {active === 'coaching' ? (
            <div>
              <p className="text-center mb-10" style={{ color: INK_SOFT, fontWeight: 300, maxWidth: 580, marginLeft: 'auto', marginRight: 'auto' }}>
                Four levels of support, from one clear answer to full ongoing coaching — built around your goals and your calendar, not the other way around.
              </p>

              <div className="grid md:grid-cols-2 gap-5">
                {COACHING_TIERS.map((t) => (
                  <div
                    key={t.title}
                    className="rounded-2xl p-7"
                    style={t.highlight ? { background: BERRY_DEEP, color: '#fff' } : { background: '#fff', border: '1px solid rgba(33,26,23,0.08)' }}
                  >
                    <span
                      className="inline-block text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full mb-4"
                      style={t.highlight ? { background: 'rgba(255,255,255,0.15)', color: '#fff' } : { background: 'rgba(29,158,117,0.1)', color: BERRY }}
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
                <InquiryButton defaultService="1:1 Nutrition Coaching" className="inline-block px-7 py-3.5 rounded-full text-sm font-bold text-white hover:opacity-90 transition-opacity" style={{ background: BERRY }}>
                  Book a discovery call
                </InquiryButton>
              </div>
            </div>
          ) : active === 'education' ? (
            <div>
              <p className="text-center mb-10" style={{ color: INK_SOFT, fontWeight: 300, maxWidth: 580, marginLeft: 'auto', marginRight: 'auto' }}>
                13 weeks of nutrition coaching for one simple payment, from just $249. Learn how to eat for your goals at your own pace, with the same education-first framework behind my 1:1 coaching, all inside the Prokol app. No subscriptions, no lock-in, and you keep access to every lesson and resource after you finish.
              </p>

              <div className="grid md:grid-cols-2 gap-5">
                {EDUCATION_CARDS.map((t) => (
                  <div
                    key={t.title}
                    className="rounded-2xl p-7 flex flex-col"
                    style={t.highlight ? { background: BERRY_DEEP, color: '#fff' } : { background: '#fff', border: '1px solid rgba(33,26,23,0.08)' }}
                  >
                    <span
                      className="inline-block text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full mb-4"
                      style={t.highlight ? { background: 'rgba(255,255,255,0.15)', color: '#fff' } : { background: 'rgba(29,158,117,0.1)', color: BERRY }}
                    >
                      {t.tag}
                    </span>
                    <p className="font-bold text-lg" style={{ fontFamily: HEAD }}>{t.title}</p>
                    <p className="text-sm font-normal mb-4" style={{ color: t.highlight ? 'rgba(255,255,255,0.8)' : INK_SOFT }}>{t.subtitle}</p>

                    <div className="mb-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: t.highlight ? 'rgba(255,255,255,0.85)' : BERRY }}>
                        {t.priceLabel}
                      </p>
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-black" style={{ fontFamily: HEAD, fontSize: '2rem', lineHeight: 1, color: t.highlight ? '#fff' : INK }}>{t.price}</span>
                        <span className="text-xs" style={{ color: t.highlight ? 'rgba(255,255,255,0.75)' : INK_SOFT }}>{t.priceNote}</span>
                      </div>
                      <p className="text-xs mt-1.5" style={{ color: t.highlight ? 'rgba(255,255,255,0.55)' : 'rgba(33,26,23,0.4)' }}>{t.priceWeekly}</p>
                    </div>

                    <p className="text-sm leading-relaxed mb-4" style={{ color: t.highlight ? 'rgba(255,255,255,0.8)' : INK_SOFT }}>{t.desc}</p>
                    <ul className="space-y-1.5 mb-5 flex-1">
                      {t.points.map((p) => (
                        <li key={p} className="flex items-start gap-2 text-xs" style={{ color: t.highlight ? 'rgba(255,255,255,0.75)' : INK_SOFT }}>
                          <span className="mt-1 w-1 h-1 rounded-full flex-shrink-0" style={{ background: t.highlight ? 'rgba(255,255,255,0.6)' : BERRY }} />
                          {p}
                        </li>
                      ))}
                    </ul>
                    <InquiryButton
                      defaultService={t.service}
                      className="block w-full text-center px-5 py-3 rounded-full text-sm font-bold transition-opacity hover:opacity-90"
                      style={t.highlight ? { background: '#fff', color: BERRY_DEEP } : { background: BERRY, color: '#fff' }}
                    >
                      {t.button}
                    </InquiryButton>
                  </div>
                ))}
              </div>

              {/* What's included */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 pt-16" style={{ borderTop: '1px solid rgba(33,26,23,0.08)' }}>
                {WHATS_INCLUDED.map((item) => (
                  <div key={item.label} className="flex flex-col items-center text-center gap-2">
                    <span className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(29,158,117,0.1)', color: BERRY }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.d} />
                      </svg>
                    </span>
                    <p className="text-xs leading-relaxed" style={{ color: INK_SOFT }}>{item.label}</p>
                  </div>
                ))}
              </div>

              {/* How it works */}
              <div className="grid md:grid-cols-3 gap-6 mt-16 pt-16" style={{ borderTop: '1px solid rgba(33,26,23,0.08)' }}>
                {EDUCATION_HOW_IT_WORKS.map((step) => (
                  <div key={step.n}>
                    <p className="text-xs font-bold tracking-widest mb-2" style={{ color: BERRY }}>{step.n}</p>
                    <p className="font-bold mb-2" style={{ fontFamily: HEAD }}>{step.t}</p>
                    <p className="text-sm leading-relaxed" style={{ color: INK_SOFT }}>{step.d}</p>
                  </div>
                ))}
              </div>

              {/* FAQ */}
              <div className="max-w-3xl mx-auto mt-16 pt-16" style={{ borderTop: '1px solid rgba(33,26,23,0.08)' }}>
                <p className="font-bold text-lg mb-4 text-center" style={{ fontFamily: HEAD }}>Questions</p>
                <div className="space-y-3">
                  {EDUCATION_FAQS.map((f) => (
                    <details key={f.q} className="group rounded-xl bg-white px-5 py-4" style={{ border: '1px solid rgba(33,26,23,0.08)' }}>
                      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden flex items-center justify-between gap-3 font-semibold text-sm" style={{ color: INK }}>
                        {f.q}
                        <svg className="w-4 h-4 flex-shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <p className="text-sm leading-relaxed mt-3" style={{ color: INK_SOFT }}>{f.a}</p>
                    </details>
                  ))}
                </div>
              </div>

              {/* Upgrade line */}
              <div className="text-center mt-14">
                <p className="text-sm mb-4" style={{ color: INK_SOFT }}>
                  Ready for more? Finish The Prokol Method and want support built entirely around you?{' '}
                  <button type="button" onClick={() => setActive('coaching')} className="font-semibold underline" style={{ color: BERRY }}>
                    Explore 1:1 coaching
                  </button>
                </p>
                <InquiryButton
                  defaultService="The Prokol Method — Self-guided"
                  className="inline-block px-7 py-3.5 rounded-full text-sm font-bold transition-colors"
                  style={{ border: '1px solid rgba(33,26,23,0.15)', color: INK }}
                >
                  Questions? Get in touch
                </InquiryButton>
              </div>
            </div>
          ) : (
            <div>
              <div className="rounded-2xl p-8 bg-white max-w-3xl mx-auto" style={{ border: '1px solid rgba(33,26,23,0.08)' }}>
                <div className="flex items-start gap-5">
                  <span className="text-3xl flex-shrink-0">{SIMPLE_PANELS[active].icon}</span>
                  <div>
                    <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                      <p className="font-bold text-xl" style={{ fontFamily: HEAD }}>{activeLabel}</p>
                      {SIMPLE_PANELS[active].badge && (
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full" style={{ background: 'rgba(29,158,117,0.1)', color: 'var(--nc-primary)' }}>
                          {SIMPLE_PANELS[active].badge}
                        </span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: INK_SOFT }}>{SIMPLE_PANELS[active].desc}</p>
                  </div>
                </div>
              </div>

              {active === 'gyms' && (
                <div className="grid md:grid-cols-3 gap-6 mt-12 pt-12 max-w-4xl mx-auto" style={{ borderTop: '1px solid rgba(33,26,23,0.08)' }}>
                  {GYM_STEPS.map((step) => (
                    <div key={step.n}>
                      <p className="text-xs font-bold tracking-widest mb-2" style={{ color: BERRY }}>{step.n}</p>
                      <p className="font-bold mb-2" style={{ fontFamily: HEAD }}>{step.t}</p>
                      <p className="text-sm leading-relaxed" style={{ color: INK_SOFT }}>{step.d}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-center mt-12">
                <InquiryButton defaultService={activeLabel} className="inline-block px-7 py-3.5 rounded-full text-sm font-bold text-white hover:opacity-90 transition-opacity" style={{ background: BERRY }}>
                  Get in touch
                </InquiryButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
