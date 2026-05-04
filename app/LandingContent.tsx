'use client'

import { useState } from 'react'
import Link from 'next/link'

// ── Individual content ────────────────────────────────────────────────────────

const INDIVIDUAL_FEATURES = [
  {
    emoji: '🍽️',
    title: 'Smart Nutrition Tracking',
    desc: 'Log meals in seconds — manually, by barcode, or by snapping a photo. Built-in macro tracking keeps you on top of your goals every day.',
    bullets: [
      'Manual food entry with full macros',
      'Barcode scanner for packaged foods',
      'AI meal photo scanning (Elite)',
      'Meal builder + saved meal templates',
    ],
  },
  {
    emoji: '💪',
    title: 'Training & Recovery',
    desc: 'Track workouts, monitor your weight over time, and log recovery data that actually matters — sleep, HRV, RHR, and energy.',
    bullets: [
      'Structured workout logging + sections',
      'Weight trend chart + full history',
      'Daily check-in: sleep, HRV, RHR, energy',
      'Exercise library with video guides',
    ],
  },
  {
    emoji: '🌸',
    title: 'Cycle Intelligence',
    desc: 'The most comprehensive cycle tracker built into a nutrition app. Track, understand, and predict your cycle — then train around it.',
    bullets: [
      'Period dates + cycle phase awareness',
      'Symptoms, BBT, cervical mucus, moods',
      'Predict period, ovulation & phase windows',
      'Personalised insights from your data (Elite)',
    ],
  },
]

const INDIVIDUAL_STEPS = [
  { step: '01', title: 'Create your free account', desc: 'Sign up in under 30 seconds. No credit card required to get started.' },
  { step: '02', title: 'Choose your plan', desc: 'Start free, or unlock the full experience with Optimiser or Elite.' },
  { step: '03', title: 'Start tracking', desc: 'Log your food, workouts, weight and cycle — all in one place.' },
]

// ── Coach content ─────────────────────────────────────────────────────────────

const COACH_FEATURES = [
  {
    emoji: '🚀',
    title: 'Simple Client Onboarding',
    desc: 'Invite a client with one link — they\'re set up inside the app in minutes. No spreadsheets, no separate logins, no friction.',
    bullets: [
      'One-link client invitations',
      'Branded onboarding forms sent automatically',
      'Clients up and running in under 5 minutes',
      'Manage your full roster in one dashboard',
    ],
  },
  {
    emoji: '📅',
    title: 'Training & Meal Plans',
    desc: 'Build structured programs and personalised nutrition plans. Assign them instantly, duplicate them across clients, and adjust on the fly.',
    bullets: [
      'Weekly training calendars per client',
      'Meal plan library — build once, use many times',
      'Clients can swap foods to match preferences',
      'Auto-calculated macros across every meal',
    ],
  },
  {
    emoji: '✅',
    title: 'Habits, Check-ins & Messaging',
    desc: 'Set daily habits, automate weekly check-ins, and stay close to every client — all inside the same app they already use to track.',
    bullets: [
      'Assign daily habits: steps, water, sleep & more',
      'Automated weekly check-in forms',
      'Progress photos collected in-app',
      'Direct messaging with every client',
    ],
  },
]

const COACH_STEPS = [
  { step: '01', title: 'Set up your coach account', desc: 'Choose a coach plan and get your dashboard live in minutes.' },
  { step: '02', title: 'Invite your clients', desc: 'Send a link — clients sign up free and connect to you instantly.' },
  { step: '03', title: 'Assign & track everything', desc: 'Build plans, set habits, review check-ins, and message clients — all in one place.' },
]

const COACH_PLATFORM_POINTS = [
  { icon: '👥', label: 'Client management', desc: 'Invite, manage and archive clients from one clean dashboard' },
  { icon: '📋', label: 'Custom forms', desc: 'Automate onboarding, check-ins, and progress questionnaires' },
  { icon: '🥗', label: 'Meal plan library', desc: 'Create templates, duplicate across clients, let clients swap foods' },
  { icon: '📅', label: 'Training calendars', desc: 'Assign structured programs — clients see their full week at a glance' },
  { icon: '✅', label: 'Habit tracking', desc: 'Set daily habits per client and monitor compliance effortlessly' },
  { icon: '💬', label: 'Direct messaging', desc: 'Stay connected with every client inside the app' },
]

// ── Shared helpers ────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="#1D9E75" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LandingContent() {
  const [audience, setAudience] = useState<'individual' | 'coach'>('individual')

  const isCoach = audience === 'coach'

  return (
    <>
      {/* ── Audience toggle ──────────────────────────────────────────────────── */}
      <section className="py-10 px-6 bg-white border-b border-gray-100">
        <div className="max-w-md mx-auto text-center space-y-4">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Who are you?</p>
          <div className="inline-flex bg-gray-100 rounded-2xl p-1 gap-1">
            <button
              onClick={() => setAudience('individual')}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                !isCoach
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              I track for myself
            </button>
            <button
              onClick={() => setAudience('coach')}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                isCoach
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              I&apos;m a coach
            </button>
          </div>
        </div>
      </section>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #EEF4F0 0%, rgba(29,158,117,0.08) 50%, #EEF4F0 100%)' }}>
        <div className="max-w-4xl mx-auto px-6 py-24 text-center space-y-8">
          {isCoach ? (
            <>
              <div className="inline-flex items-center gap-2 text-sm font-medium px-4 py-1.5 rounded-full border border-yellow-200 bg-white text-yellow-700">
                🏆 Built for professional coaches
              </div>

              <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-gray-900 leading-tight">
                Next-level coaching.<br />
                <span style={{ color: '#B08000' }}>Zero complexity.</span>
              </h1>

              <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
                Onboard clients in minutes. Deliver structured training, personalised nutrition, and daily habits — all tracked inside one powerful app.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/signup?type=coach"
                  className="text-base font-semibold px-8 py-4 rounded-2xl text-gray-900 transition-colors hover:opacity-90 shadow-sm"
                  style={{ backgroundColor: '#1D9E75' }}
                >
                  Start coaching free →
                </Link>
                <a
                  href="#coach-platform"
                  className="text-base font-semibold px-8 py-4 rounded-2xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  See the platform
                </a>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-gray-500">
                {['📅 Training Calendars', '🥗 Meal Plan Library', '✅ Habit Tracking', '📋 Custom Forms', '💬 Messaging'].map((f) => (
                  <span key={f} className="bg-white rounded-full px-3 py-1 border border-gray-100 shadow-sm">{f}</span>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="inline-flex items-center gap-2 text-sm font-medium px-4 py-1.5 rounded-full border border-yellow-200 bg-white text-yellow-700">
                ✨ Now with AI meal scanning
              </div>

              <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-gray-900 leading-tight">
                Train smarter.<br />
                Recover better.<br />
                <span style={{ color: '#B08000' }}>Understand your body.</span>
              </h1>

              <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
                Prokol tracks your nutrition, training, weight, and cycle in one place — so you can perform at your best, every single day.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/signup"
                  className="text-base font-semibold px-8 py-4 rounded-2xl text-gray-900 transition-colors hover:opacity-90 shadow-sm"
                  style={{ backgroundColor: '#1D9E75' }}
                >
                  Start for free →
                </Link>
                <a
                  href="#pricing"
                  className="text-base font-semibold px-8 py-4 rounded-2xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  View plans
                </a>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-gray-500">
                {['📷 AI Meal Scanner', '⚡ Food Logging', '💪 Workouts', '🌸 Cycle Intelligence', '❤️ Recovery Tracking'].map((f) => (
                  <span key={f} className="bg-white rounded-full px-3 py-1 border border-gray-100 shadow-sm">{f}</span>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center space-y-3">
            {isCoach ? (
              <>
                <h2 className="text-3xl font-bold text-gray-900">Everything your coaching business needs</h2>
                <p className="text-gray-500 text-lg max-w-xl mx-auto">Three pillars of a serious coaching platform, built to work together.</p>
              </>
            ) : (
              <>
                <h2 className="text-3xl font-bold text-gray-900">Everything you need, nothing you don&apos;t</h2>
                <p className="text-gray-500 text-lg max-w-xl mx-auto">Three pillars of health tracking, built to work together.</p>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {(isCoach ? COACH_FEATURES : INDIVIDUAL_FEATURES).map((f) => (
              <div key={f.title} className="space-y-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: 'rgba(29,158,117,0.08)' }}>
                  {f.emoji}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{f.title}</h3>
                  <p className="text-gray-500 mt-2 text-sm leading-relaxed">{f.desc}</p>
                </div>
                <ul className="space-y-2">
                  {f.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckIcon />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Coach platform deep-dive (coach view only) ───────────────────────── */}
      {isCoach && (
        <section id="coach-platform" className="py-24 px-6" style={{ backgroundColor: '#EEF4F0' }}>
          <div className="max-w-5xl mx-auto space-y-14">
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-bold text-gray-900">The platform your clients will love using</h2>
              <p className="text-gray-500 text-lg max-w-2xl mx-auto">
                Your clients get a full-featured tracking app. You get visibility over everything. Everyone wins.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {COACH_PLATFORM_POINTS.map((item) => (
                <div key={item.label} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2">
                  <span className="text-2xl">{item.icon}</span>
                  <p className="font-semibold text-gray-900 text-sm">{item.label}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>

            {/* Client retention callout */}
            <div className="bg-white rounded-2xl border border-gray-100 p-7 flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center text-2xl" style={{ backgroundColor: 'rgba(29,158,117,0.08)' }}>
                🔄
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1">Clients keep tracking after coaching ends</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  When a coaching relationship wraps up, clients don&apos;t lose their data or habits — they simply continue on a free individual plan. They keep tracking their nutrition, workouts, and weight. No switching apps, no lost history. A seamless handoff that reflects well on you.
                </p>
              </div>
              <div className="flex-shrink-0">
                <span className="inline-block bg-green-50 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-green-100">
                  Free forever for ex-clients
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Comparison (coach view only) ────────────────────────────────────── */}
      {isCoach && (
        <section className="py-24 px-6 bg-white">
          <div className="max-w-5xl mx-auto space-y-12">
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-bold text-gray-900">Why coaches are switching to Prokol</h2>
              <p className="text-gray-500 text-lg max-w-2xl mx-auto">
                Most coaches patch together 3–4 tools. Prokol replaces all of them.
              </p>
            </div>

            {/* Problem cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  label: 'Training apps (Trainerize, Everfit)',
                  pain: 'Great for programs — but nutrition is bolted on. Clients still open MyFitnessPal to log food, then manually report back. Two apps, double the friction.',
                  icon: '📅',
                },
                {
                  label: 'Nutrition apps (MyFitnessPal, Cronometer)',
                  pain: 'Solid food tracking — but zero coaching layer. No programs, no check-ins, no habit tracking. You can\'t see client data without screen-sharing.',
                  icon: '🥗',
                },
                {
                  label: 'Spreadsheets & Google Docs',
                  pain: 'Flexible but manual. Check-ins arrive in email, food logs come as screenshots, and progress photos live in WhatsApp. Nothing connects.',
                  icon: '📊',
                },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-red-100 bg-red-50 p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{item.icon}</span>
                    <p className="text-sm font-bold text-gray-800">{item.label}</p>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">{item.pain}</p>
                </div>
              ))}
            </div>

            {/* Comparison table */}
            <div className="overflow-x-auto rounded-2xl border border-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: 'rgba(29,158,117,0.08)' }}>
                    <th className="text-left px-5 py-3.5 font-semibold text-gray-700 w-1/3">Feature</th>
                    <th className="px-5 py-3.5 font-semibold text-gray-500 text-center">Trainerize / Everfit</th>
                    <th className="px-5 py-3.5 font-semibold text-gray-500 text-center">MyFitnessPal</th>
                    <th className="px-5 py-3.5 font-bold text-gray-900 text-center">Prokol</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    ['Training programs & calendars',     true,  false, true ],
                    ['Built-in nutrition tracking',       false, true,  true ],
                    ['Meal plan library & food swaps',    false, false, true ],
                    ['Daily habit tracking per client',   false, false, true ],
                    ['Automated check-in forms',          true,  false, true ],
                    ['Progress photos in-app',            true,  false, true ],
                    ['Direct client messaging',           true,  false, true ],
                    ['Clients keep app after coaching',   false, true,  true ],
                    ['Cycle & hormonal health tracking',  false, false, true ],
                    ['AI meal photo scanning',            false, false, true ],
                  ].map(([feature, trainerize, mfp, prokol]) => (
                    <tr key={feature as string} className="bg-white hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-gray-700">{feature as string}</td>
                      <td className="px-5 py-3 text-center">{trainerize ? '✓' : <span className="text-gray-300">—</span>}</td>
                      <td className="px-5 py-3 text-center">{mfp ? '✓' : <span className="text-gray-300">—</span>}</td>
                      <td className="px-5 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold" style={{ backgroundColor: '#1D9E75', color: '#FFFFFF' }}>✓</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary callout */}
            <div className="rounded-2xl p-7 text-center space-y-3" style={{ backgroundColor: '#EEF4F0' }}>
              <p className="text-xl font-bold text-gray-900">One platform. Everything connected.</p>
              <p className="text-sm text-gray-500 max-w-2xl mx-auto leading-relaxed">
                Your clients log food, complete workouts, track habits, and submit check-ins — all in the same app you use to coach them. No tool-switching, no data gaps, no chasing screenshots on WhatsApp.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <section className={`py-24 px-6 ${isCoach ? 'bg-white' : ''}`} style={isCoach ? {} : { backgroundColor: '#EEF4F0' }}>
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">
              {isCoach ? 'Up and running in three steps' : 'Get started in minutes'}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {(isCoach ? COACH_STEPS : INDIVIDUAL_STEPS).map((s) => (
              <div key={s.step} className="space-y-3">
                <span className="text-4xl font-bold" style={{ color: '#1D9E75' }}>{s.step}</span>
                <h3 className="text-lg font-bold text-gray-900">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>

          {isCoach && (
            <div className="text-center pt-4">
              <Link
                href="/signup?type=coach"
                className="inline-block text-base font-semibold px-10 py-4 rounded-2xl text-gray-900 hover:opacity-90 transition-colors"
                style={{ backgroundColor: '#1D9E75' }}
              >
                Start coaching free →
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-gray-900 text-white text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          {isCoach ? (
            <>
              <h2 className="text-4xl font-bold">Ready to elevate your coaching?</h2>
              <p className="text-gray-400 text-lg">Start free. Invite your first client today — no credit card needed.</p>
              <Link
                href="/signup?type=coach"
                className="inline-block text-base font-semibold px-10 py-4 rounded-2xl text-gray-900 hover:opacity-90 transition-colors"
                style={{ backgroundColor: '#1D9E75' }}
              >
                Create coach account →
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-4xl font-bold">Ready to understand your body?</h2>
              <p className="text-gray-400 text-lg">Join Prokol free today — no credit card required.</p>
              <Link
                href="/signup"
                className="inline-block text-base font-semibold px-10 py-4 rounded-2xl text-gray-900 hover:opacity-90 transition-colors"
                style={{ backgroundColor: '#1D9E75' }}
              >
                Create free account →
              </Link>
            </>
          )}
        </div>
      </section>
    </>
  )
}
