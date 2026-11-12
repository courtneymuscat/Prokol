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
    points: ['Weekly async check-in — no live call', 'Light-touch review of adherence & symptoms'],
    requires: 'Only available as a continuation — you’ll need to complete one of the tiers above first',
  },
]

const HOW_IT_WORKS = [
  { n: '01', t: 'Discovery call', d: 'A conversation about your goals, training, and lifestyle — and where you actually fit, consultation or ongoing coaching.' },
  { n: '02', t: 'Your personalised plan', d: 'Built from a full intake and a 45-minute consult, delivered 2–3 business days later via a proper Loom walkthrough — never rushed out live on the call.' },
  { n: '03', t: 'Ongoing support, your way', d: 'Weekly, monthly, or async — whatever level of contact matches the tier you’re on.' },
]

const GYM_STATS = [
  { n: '25', label: 'video lessons' },
  { n: '24', label: 'downloadable guides' },
  { n: '41', label: 'flagged messages' },
  { n: '13', label: 'weeks' },
]

const GYM_TIERS = [
  {
    tag: 'Every member, automated',
    title: 'Self-guided',
    subtitle: 'Every flag seen, automated tips on the common ones',
    priceLabel: 'Flat monthly fee · up to 150 members',
    price: '$499',
    priceNote: '/ month',
    priceWeekly: 'About $3.33 a member a month',
    desc: 'Every member gets the full nutrition education curriculum, with automated tips on common flags and me personally reviewing every safety screening and sensitive health flag.',
    points: [
      'A real nutrition education curriculum — 25 video lessons and 24 downloadable guides, delivered over 13 weeks',
      '3 paths to choose from: Plan & Swap, Track Serves, or Protein + Calories',
      'Personalised plan, macros and targets from their intake form',
      'Weekly recorded Q&A — I answer every progress-check question on video',
      'Women’s health bonus library: cycle, iron, energy, menopause, bloodwork',
      'Automated tip and next steps on common flags',
      'I personally review every safety screening and sensitive health flag',
    ],
    button: 'Start Self-guided',
    service: 'Gym Partnership — Self-guided',
  },
  {
    tag: 'Most support, ~$2 more a member',
    title: 'Guided',
    subtitle: 'A personal reply from me on every single flag',
    priceLabel: 'Flat monthly fee · up to 150 members',
    price: '$849',
    priceNote: '/ month (founding gyms $749)',
    priceWeekly: 'About $5.66 a member a month (founding ~$4.99)',
    desc: 'Everything in Self-guided, plus a personal reply from me on every flagged check-in, not just the common ones — real guidance for members who want it, with zero extra work for your trainers.',
    points: [
      'Everything in Self-guided',
      'A personal reply from me on every flag, within 2–3 business days',
      'Common flags also get an automated tip alongside the personal reply',
      'Founding gyms lock in $749/month and the set-up fee is waived',
    ],
    button: 'Start Guided',
    service: 'Gym Partnership — Guided',
    highlight: true,
  },
]

const GYM_WHATS_INCLUDED = [
  { label: 'Your own branded app', d: 'M7.5 21H16.5C17.3284 21 18 20.3284 18 19.5V4.5C18 3.67157 17.3284 3 16.5 3H7.5C6.67157 3 6 3.67157 6 4.5V19.5C6 20.3284 6.67157 21 7.5 21Z M12 17.25H12.0075' },
  { label: 'Simple monthly report', d: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { label: 'Gym Toolkit, including launch copy', d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { label: 'Zero extra time from your trainers', d: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
]

const GYM_FLAG_CATEGORIES = [
  { n: '1', t: 'Weekly wellbeing', d: 'Energy, sleep, stress, hunger, habits and weight change.' },
  { n: '2', t: 'Safety screening', d: 'Exercise readiness and food allergies at sign-up.' },
  { n: '3', t: 'Women’s health', d: 'Health history, pregnancy and cycles. Always a personal reply.' },
  { n: '4', t: 'Extra support', d: 'An upcoming event, feeling stuck or wanting more help.' },
  { n: '5', t: 'Week-specific', d: 'Under-fuelling, digestion, run-down and supplement safety.' },
  { n: '6', t: 'Tracking and mindset', d: 'Tracking anxiety, all-or-nothing thinking and rigid rules.' },
]

const GYM_ADDONS = [
  {
    title: 'Personal Feedback',
    price: '$299',
    priceNote: 'per member, for 13 weeks',
    desc: 'A personal Loom video reply from me to every weekly progress check, for 13 weeks. Member opts in, or your gym subsidises it — works with either tier.',
  },
  {
    title: 'Plan Consults',
    price: '$45',
    priceNote: 'per consult',
    desc: '20 minutes with me, in person at your gym or online, plus notes and a summary sent to the member. Talking through their plan, their path, and practical questions — not bloodwork review, medical advice, or ongoing coaching.',
  },
]

const GYM_HOW_IT_WORKS = [
  { n: '01', t: 'Set-up week', d: 'I brand your app and send your Gym Toolkit.' },
  { n: '02', t: 'Members join', d: 'With your gym’s own code.' },
  { n: '03', t: 'Education unfolds', d: 'Lessons, habits and their personalised plan, week by week over 13 weeks.' },
  { n: '04', t: 'Every week', d: 'Progress checks, replies and the recorded Q&A.' },
]

const GYM_FAQS = [
  { q: 'Is this medical advice?', a: 'No. Education only, never clinical. Plan Consults stay in scope; anything medical goes to the member’s GP or a support line.' },
  { q: 'What happens if something’s flagged?', a: 'Both tiers: an automated tip and next steps on common flags, plus I personally review every safety screening and sensitive health flag. Guided adds a personal reply from me on every flag, within 2–3 business days.' },
  { q: 'How many members does this cover?', a: 'Up to 150 members on either tier, plus $2 per extra member a month.' },
  { q: 'What’s the commitment?', a: 'A 3-month minimum, then monthly with 30 days’ notice. A one-off $490 set-up fee applies, waived for founding gyms.' },
  { q: 'Does this replace our trainers?', a: 'No — it runs alongside your coaching, inside your gym’s own branded app, with zero extra time from your trainers. Members get a nutrition specialist without you needing a full-time hire.' },
  { q: 'What do Plan Consults include?', a: 'Talking through their plan and targets, choosing or adjusting their path, practical questions on eating out, busy weeks and fuelling, and general supplement guidance — not bloodwork review, medical advice, a new bespoke plan, or ongoing coaching (that’s 1:1).' },
  { q: 'Does it pay for itself?', a: 'If a membership is about $25 a week, Self-guided is covered by keeping about 5 members a month; Guided about 8.' },
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
      'Your plan, daily serves and targets in the Prokol app, built from your onboarding answers',
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
      'Answers to your questions, so you’re never stuck figuring it out alone',
      'Course-correct early, so small slips don’t turn into big ones',
    ],
    button: 'Start Guided',
    service: 'The Prokol Method — Guided',
    highlight: true,
  },
  {
    tag: 'Add training alongside it',
    title: 'Self-guided + Training',
    subtitle: '13 weeks nutrition + 12 weeks training',
    priceLabel: '13 weeks · one payment',
    price: '$349',
    priceNote: 'for the full program',
    priceWeekly: 'That’s about $27 a week',
    desc: 'Everything in Self-guided, plus a structured training program to work alongside it, delivered the same way — in the app, at your own pace.',
    points: [
      'Everything in Self-guided',
      '2 x 6-week training blocks, delivered in the Prokol app',
      'Progressive programming that builds across both blocks',
      'Train and eat from the same plan, with nothing to coordinate yourself',
    ],
    button: 'Start Self-guided + Training',
    service: 'The Prokol Method — Self-guided + Training',
  },
  {
    tag: 'Most complete',
    title: 'Guided + Training',
    subtitle: 'with weekly check-in replies',
    priceLabel: '13 weeks · one payment',
    price: '$599',
    priceNote: 'for the full program, with weekly check-in replies',
    priceWeekly: 'That’s about $46 a week',
    desc: 'Everything in Guided, plus a structured training program and weekly replies that cover both.',
    points: [
      'Everything in Guided',
      '2 x 6-week training blocks, delivered in the Prokol app',
      'Weekly check-in replies cover your training as well as your nutrition',
      'Progressive programming that builds across both blocks',
    ],
    button: 'Start Guided + Training',
    service: 'The Prokol Method — Guided + Training',
    highlight: true,
  },
]

const CURRICULUM = [
  { week: 'Week 0', title: 'Foundations', d: 'Six short lessons to get set up — protein, carbs, fats, energy balance, and building your first plate.' },
  { week: 'Week 1', title: 'Protein at Every Meal', d: 'Making protein a habit, not an afterthought.' },
  { week: 'Week 2', title: 'Fuel Your Training', d: 'Timing your carbs and fuelling your sessions properly.' },
  { week: 'Week 3', title: 'Fibre, Colour and Gut Health', d: 'More plants, more often.' },
  { week: 'Week 4', title: 'Meals Made Simple', d: 'Easy swaps that make eating well sustainable.' },
  { week: 'Week 5', title: 'Real Life: Eating Out, Drinks and Weekends', d: 'Handling meals away from home, guilt-free.' },
  { week: 'Week 6', title: 'Midpoint Review', d: 'Compare your Week 0 photos and measurements — see how far you’ve come.' },
  { week: 'Week 7', title: "Supplements: What's Worth It", d: 'What’s actually doing something, before you add anything new.' },
  { week: 'Week 8', title: 'Hunger, Cravings and Appetite', d: 'Rating your hunger and understanding your cues.' },
  { week: 'Week 9', title: 'Body Composition Phases', d: 'Fat loss, maintenance, or building — choosing what’s next.' },
  { week: 'Week 10', title: 'Sleep, Stress and Recovery', d: 'Your wind-down routine and your evenings.' },
  { week: 'Week 11', title: 'Ease Off and Your Reset Plan', d: 'Pulling back on tracking in a way that still feels safe.' },
  { week: 'Week 12', title: 'Making It Last', d: 'Locking in what keeps working long after the program ends.' },
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

const SIMPLE_PANELS: Record<Exclude<ServiceKey, 'coaching' | 'education' | 'gyms'>, { icon: string; badge?: string; desc: string }> = {
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

              <div className="grid md:grid-cols-3 gap-6">
                {HOW_IT_WORKS.map((step) => (
                  <div key={step.n}>
                    <p className="text-xs font-bold tracking-widest mb-2" style={{ color: BERRY }}>{step.n}</p>
                    <p className="font-bold mb-2" style={{ fontFamily: HEAD }}>{step.t}</p>
                    <p className="text-sm leading-relaxed" style={{ color: INK_SOFT }}>{step.d}</p>
                  </div>
                ))}
              </div>

              <div className="grid md:grid-cols-2 gap-5 mt-16 pt-16" style={{ borderTop: '1px solid rgba(33,26,23,0.08)' }}>
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
                    {'requires' in t && t.requires && (
                      <p
                        className="text-xs font-semibold rounded-lg px-3 py-2 mb-4 flex items-start gap-1.5"
                        style={{
                          background: t.highlight ? 'rgba(255,255,255,0.1)' : 'rgba(29,158,117,0.08)',
                          color: t.highlight ? '#fff' : BERRY,
                          border: `1px solid ${t.highlight ? 'rgba(255,255,255,0.25)' : 'rgba(29,158,117,0.25)'}`,
                        }}
                      >
                        <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {t.requires}
                      </p>
                    )}
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

              {/* Curriculum */}
              <div>
                <p className="font-bold text-lg mb-6 text-center" style={{ fontFamily: HEAD }}>The 13-week curriculum</p>
                <div className="grid md:grid-cols-2 gap-3 max-w-3xl mx-auto">
                  {CURRICULUM.map((c) => (
                    <div key={c.week} className="rounded-xl p-4 flex items-start gap-3" style={{ background: '#fff', border: '1px solid rgba(33,26,23,0.08)' }}>
                      <span
                        className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full flex-shrink-0"
                        style={{ background: 'rgba(29,158,117,0.1)', color: BERRY }}
                      >
                        {c.week}
                      </span>
                      <div>
                        <p className="font-bold text-sm" style={{ fontFamily: HEAD, color: INK }}>{c.title}</p>
                        <p className="text-xs leading-relaxed mt-0.5" style={{ color: INK_SOFT }}>{c.d}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-center mt-5" style={{ color: 'rgba(33,26,23,0.4)' }}>
                  Plus a women’s health bonus library alongside it — cycle, iron, energy, menopause, bloodwork.
                </p>
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

              {/* Pricing */}
              <div className="grid md:grid-cols-2 gap-5 mt-16 pt-16" style={{ borderTop: '1px solid rgba(33,26,23,0.08)' }}>
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
          ) : active === 'gyms' ? (
            <div>
              <div
                className="text-center mb-10 mx-auto rounded-[2rem] px-8 py-8 md:px-12 md:py-9"
                style={{ background: 'rgba(29,158,117,0.08)', border: '1px solid rgba(29,158,117,0.18)', maxWidth: 700 }}
              >
                <p style={{ color: INK, fontWeight: 300, fontSize: '1.05rem', lineHeight: 1.6 }}>
                  Real nutrition education for your members, running inside your gym’s own branded app — 25 video lessons, 24 downloadable guides, and a women’s health library, delivered over 13 weeks and built and run personally by me as an Accredited Sports Nutritionist. Give your members as much or as little personal guidance as you like: one flat monthly fee covers everyone, every flag is seen, and it takes zero extra time from your trainers.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-14 max-w-3xl mx-auto">
                {GYM_STATS.map((s) => (
                  <div key={s.label} className="rounded-2xl text-center py-7 px-3" style={{ background: '#fff', border: '1px solid rgba(33,26,23,0.08)' }}>
                    <p className="font-black" style={{ fontFamily: HEAD, fontSize: '2.25rem', lineHeight: 1, color: BERRY }}>{s.n}</p>
                    <p className="text-sm mt-2" style={{ color: INK_SOFT }}>{s.label}</p>
                  </div>
                ))}
              </div>

              {/* What your gym gets */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 pt-16" style={{ borderTop: '1px solid rgba(33,26,23,0.08)' }}>
                {GYM_WHATS_INCLUDED.map((item) => (
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

              {/* 41 built-in flags */}
              <div className="mt-16 pt-16" style={{ borderTop: '1px solid rgba(33,26,23,0.08)' }}>
                <p className="font-bold text-lg mb-2 text-center" style={{ fontFamily: HEAD }}>41 built-in flags, built into the curriculum</p>
                <p className="text-sm text-center mb-8" style={{ color: INK_SOFT, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
                  Every progress check is scored against a real set of rules, built from actually coaching members at scale — not a generic checklist.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-5 max-w-3xl mx-auto">
                  {GYM_FLAG_CATEGORIES.map((c) => (
                    <div key={c.n} className="rounded-xl p-4" style={{ background: '#fff', border: '1px solid rgba(33,26,23,0.08)' }}>
                      <p className="font-bold text-sm mb-1" style={{ fontFamily: HEAD, color: INK }}>{c.t}</p>
                      <p className="text-xs leading-relaxed" style={{ color: INK_SOFT }}>{c.d}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* How it works */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 pt-16" style={{ borderTop: '1px solid rgba(33,26,23,0.08)' }}>
                {GYM_HOW_IT_WORKS.map((step) => (
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
                  {GYM_FAQS.map((f) => (
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

              {/* Pricing */}
              <div className="grid md:grid-cols-2 gap-5 mt-16 pt-16" style={{ borderTop: '1px solid rgba(33,26,23,0.08)' }}>
                {GYM_TIERS.map((t) => (
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

              {/* Add-ons */}
              <div className="mt-16 pt-16" style={{ borderTop: '1px solid rgba(33,26,23,0.08)' }}>
                <p className="font-bold text-lg mb-2 text-center" style={{ fontFamily: HEAD }}>Add-ons</p>
                <p className="text-sm text-center mb-8" style={{ color: INK_SOFT }}>Two optional extras for members who want more personal support.</p>
                <div className="grid md:grid-cols-2 gap-5 max-w-3xl mx-auto">
                  {GYM_ADDONS.map((a) => (
                    <div key={a.title} className="rounded-2xl p-6" style={{ background: '#fff', border: '1px solid rgba(33,26,23,0.08)' }}>
                      <p className="font-bold text-base mb-1" style={{ fontFamily: HEAD }}>{a.title}</p>
                      <div className="flex items-baseline gap-2 mb-3">
                        <span className="font-black" style={{ fontFamily: HEAD, fontSize: '1.5rem', color: INK }}>{a.price}</span>
                        <span className="text-xs" style={{ color: INK_SOFT }}>{a.priceNote}</span>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: INK_SOFT }}>{a.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="text-center mt-14">
                <p className="text-sm mb-4" style={{ color: INK_SOFT }}>Not sure which tier fits your gym? Let's talk it through.</p>

                <InquiryButton defaultService="Gym & Studio Partnerships" className="inline-block px-7 py-3.5 rounded-full text-sm font-bold text-white hover:opacity-90 transition-opacity" style={{ background: BERRY }}>
                  Get in touch
                </InquiryButton>
              </div>
            </div>
          ) : (
            <div>
              <div className="rounded-2xl p-8 bg-white max-w-3xl mx-auto" style={{ border: '1px solid rgba(33,26,23,0.08)' }}>
                <div className="flex items-start gap-5">
                  <span className="text-3xl flex-shrink-0">{SIMPLE_PANELS[active as Exclude<ServiceKey, 'coaching' | 'education' | 'gyms'>].icon}</span>
                  <div>
                    <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                      <p className="font-bold text-xl" style={{ fontFamily: HEAD }}>{activeLabel}</p>
                      {SIMPLE_PANELS[active as Exclude<ServiceKey, 'coaching' | 'education' | 'gyms'>].badge && (
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full" style={{ background: 'rgba(29,158,117,0.1)', color: 'var(--nc-primary)' }}>
                          {SIMPLE_PANELS[active as Exclude<ServiceKey, 'coaching' | 'education' | 'gyms'>].badge}
                        </span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: INK_SOFT }}>{SIMPLE_PANELS[active as Exclude<ServiceKey, 'coaching' | 'education' | 'gyms'>].desc}</p>
                  </div>
                </div>
              </div>

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
