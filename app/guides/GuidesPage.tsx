'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

const T = {
  bg: '#F4F7F5',
  dark: '#0A1A14',
  teal: '#1D9E75',
  tealLight: '#4BBFA0',
  tealBorder: 'rgba(29,158,117,0.2)',
  tealBg: 'rgba(29,158,117,0.06)',
  tealBgStrong: 'rgba(29,158,117,0.12)',
  textPrimary: '#0D1F18',
  textSec: '#4A6B5A',
  white: '#FFFFFF',
  border: 'rgba(13,31,24,0.1)',
  borderMid: 'rgba(13,31,24,0.07)',
}

const HEAD = 'var(--font-sans, Geist, system-ui, sans-serif)'

const coachGuides = [
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'inviting-clients', label: 'Inviting Clients' },
  { id: 'training-programs', label: 'Training Programs' },
  { id: 'meal-plans', label: 'Meal Plans' },
  { id: 'forms', label: 'Creating Forms' },
  { id: 'autoflows', label: 'Autoflows' },
  { id: 'resources', label: 'Resources' },
  { id: 'check-ins', label: 'Check-in Feed' },
  { id: 'notes', label: 'Notes & Templates' },
  { id: 'settings', label: 'Settings & Branding' },
]

const clientGuides = [
  { id: 'client-getting-started', label: 'Getting Started' },
  { id: 'client-targets', label: 'Nutrition Targets' },
  { id: 'client-food-logging', label: 'Logging Food' },
  { id: 'client-training', label: 'Training Calendar' },
  { id: 'client-check-ins', label: 'Check-ins & Forms' },
  { id: 'client-progress', label: 'Progress & Weight' },
  { id: 'client-cycle', label: 'Cycle Tracker' },
  { id: 'client-messages', label: 'Messaging' },
  { id: 'client-install', label: 'Installing the App' },
]

function Step({ n, title, children }: { n: number; title?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
      <div style={{
        flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
        background: T.teal, color: '#fff', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: '0.72rem', fontWeight: 700, marginTop: 1,
      }}>
        {n}
      </div>
      <div style={{ flex: 1, paddingTop: 2 }}>
        {title && <p style={{ fontWeight: 600, color: T.textPrimary, marginBottom: 4, fontSize: '0.95rem' }}>{title}</p>}
        <div style={{ color: T.textSec, fontSize: '0.9rem', lineHeight: 1.75 }}>{children}</div>
      </div>
    </div>
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: T.tealBg, border: `1px solid ${T.tealBorder}`,
      borderRadius: 10, padding: '12px 16px', marginTop: 20,
      display: 'flex', gap: 10, alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: '0.9rem', flexShrink: 0, marginTop: 1 }}>💡</span>
      <p style={{ fontSize: '0.85rem', color: T.textSec, lineHeight: 1.65, margin: 0 }}>{children}</p>
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.18)',
      borderRadius: 10, padding: '12px 16px', marginTop: 12,
      display: 'flex', gap: 10, alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: '0.9rem', flexShrink: 0, marginTop: 1 }}>📌</span>
      <p style={{ fontSize: '0.85rem', color: '#7C4B0A', lineHeight: 1.65, margin: 0 }}>{children}</p>
    </div>
  )
}

function VideoEmbed({ src, title }: { src: string; title: string }) {
  return (
    <div style={{
      position: 'relative', paddingBottom: '56.25%', height: 0,
      overflow: 'hidden', borderRadius: 12, marginBottom: 28,
      background: T.dark,
    }}>
      <iframe
        src={src}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
      />
    </div>
  )
}

function IPhoneFrame({ src, title }: { src: string; title: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
      <div style={{
        width: 260, background: '#0A0A0A', borderRadius: 44,
        padding: '14px 10px', boxShadow: '0 32px 80px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.08)',
        border: '2px solid #222',
      }}>
        {/* Notch */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <div style={{ width: 80, height: 20, background: '#111', borderRadius: 20 }} />
        </div>
        {/* Screen */}
        <div style={{
          position: 'relative', paddingBottom: '177.78%', height: 0,
          overflow: 'hidden', borderRadius: 28, background: '#000',
        }}>
          <iframe
            src={src}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
          />
        </div>
        {/* Home bar */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
          <div style={{ width: 80, height: 4, background: '#333', borderRadius: 4 }} />
        </div>
      </div>
    </div>
  )
}

function GuideSection({
  id, number, title, readTime, children, isClient,
}: {
  id: string; number: string; title: string; readTime: string;
  children: React.ReactNode; isClient?: boolean;
}) {
  const [copied, setCopied] = useState(false)

  const copyLink = useCallback(() => {
    const url = `${window.location.origin}/guides#${id}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [id])

  return (
    <section id={id} style={{
      background: T.white, borderRadius: 16,
      border: `1px solid ${T.border}`,
      padding: '32px 36px', marginBottom: 24,
      scrollMarginTop: 88,
    }}>
      <div style={{ marginBottom: 20 }}>
        <p style={{
          fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em',
          color: T.teal, textTransform: 'uppercase', marginBottom: 8,
        }}>
          {number}
        </p>
        <h2 style={{
          fontFamily: HEAD, fontWeight: 800,
          fontSize: 'clamp(1.4rem, 3vw, 2rem)',
          color: T.textPrimary, margin: 0, lineHeight: 1.2,
          letterSpacing: '-0.02em',
        }}>
          {title}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <span style={{ fontSize: '0.75rem', color: T.textSec }}>{readTime}</span>
          {isClient && (
            <button
              onClick={copyLink}
              style={{
                fontSize: '0.72rem', color: T.teal, background: 'none',
                border: `1px solid ${T.tealBorder}`, borderRadius: 6,
                padding: '1px 8px', cursor: 'pointer', fontWeight: 600,
              }}
            >
              {copied ? '✓ Copied' : 'Copy shareable link'}
            </button>
          )}
        </div>
      </div>
      <div style={{ borderTop: `1px solid ${T.borderMid}`, paddingTop: 24 }}>
        {children}
      </div>
    </section>
  )
}

function SidebarLink({ id, label, active }: { id: string; label: string; active: boolean }) {
  return (
    <a
      href={`#${id}`}
      style={{
        display: 'block', padding: '6px 12px', borderRadius: 8,
        fontSize: '0.83rem', fontWeight: active ? 600 : 400,
        color: active ? T.teal : T.textSec,
        background: active ? T.tealBgStrong : 'transparent',
        textDecoration: 'none', transition: 'all 0.15s',
        borderLeft: active ? `3px solid ${T.teal}` : '3px solid transparent',
      }}
    >
      {label}
    </a>
  )
}

export default function GuidesPage() {
  const [activeSection, setActiveSection] = useState('')
  const [activeTab, setActiveTab] = useState<'coach' | 'client'>('coach')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash) {
      const isClientGuide = clientGuides.some(g => g.id === hash)
      if (isClientGuide) setActiveTab('client')
      setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [])

  useEffect(() => {
    const allGuides = [...coachGuides, ...clientGuides]
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting)
        if (visible.length > 0) {
          setActiveSection(visible[0].target.id)
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    )
    allGuides.forEach(g => {
      const el = document.getElementById(g.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [activeTab])

  const currentGuides = activeTab === 'coach' ? coachGuides : clientGuides

  return (
    <div style={{ fontFamily: 'var(--font-dm-sans, DM Sans, sans-serif)', background: T.bg, minHeight: '100vh', color: T.textPrimary }}>

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: T.dark, borderBottom: `1px solid rgba(255,255,255,0.07)`,
      }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" style={{
            fontFamily: HEAD, fontWeight: 800, fontSize: '1.1rem',
            color: '#fff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            Prokol<span style={{ color: T.teal }}>.</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Help Centre</span>
            <Link href="/login" style={{
              fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)',
              textDecoration: 'none', fontWeight: 500,
            }}>
              Log in →
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ background: T.dark, padding: '48px 24px 56px', borderBottom: `1px solid rgba(255,255,255,0.06)` }}>
        <div className="max-w-4xl mx-auto text-center">
          <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em', color: T.tealLight, textTransform: 'uppercase', marginBottom: 12 }}>
            Help Centre
          </p>
          <h1 style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 'clamp(1.8rem, 4vw, 3rem)', color: '#fff', marginBottom: 12, lineHeight: 1.1 }}>
            Up and running in under an hour.
          </h1>
          <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.45)', maxWidth: 480, margin: '0 auto 32px', lineHeight: 1.7, fontWeight: 300 }}>
            Step-by-step guides for coaches and clients. Share the client guides directly with your clients using the copy link button on each one.
          </p>

          {/* Tab switcher */}
          <div style={{
            display: 'inline-flex', background: 'rgba(255,255,255,0.07)',
            borderRadius: 12, padding: 4, gap: 4,
          }}>
            {([['coach', 'Coach Guides'], ['client', 'Client Guides']] as const).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '10px 24px', borderRadius: 9, border: 'none', cursor: 'pointer',
                  fontWeight: 600, fontSize: '0.88rem', transition: 'all 0.2s',
                  background: activeTab === tab ? T.teal : 'transparent',
                  color: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.5)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile sidebar toggle */}
      <div className="lg:hidden" style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, background: T.white }}>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: '0.85rem', fontWeight: 600, color: T.teal,
            background: 'none', border: `1px solid ${T.tealBorder}`,
            borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
          Jump to a guide
        </button>
        {sidebarOpen && (
          <div style={{
            marginTop: 8, background: T.bg, borderRadius: 10,
            border: `1px solid ${T.border}`, padding: '8px 0',
          }}>
            {currentGuides.map(g => (
              <a
                key={g.id}
                href={`#${g.id}`}
                onClick={() => setSidebarOpen(false)}
                style={{
                  display: 'block', padding: '8px 14px',
                  fontSize: '0.85rem', textDecoration: 'none',
                  fontWeight: activeSection === g.id ? 600 : 400,
                  color: activeSection === g.id ? T.teal : T.textSec,
                }}
              >
                {g.label}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Main layout */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 flex gap-8 items-start">

        {/* Sidebar */}
        <aside className="hidden lg:block" style={{ width: 220, flexShrink: 0, position: 'sticky', top: 88 }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: T.textSec, textTransform: 'uppercase', marginBottom: 8, paddingLeft: 12 }}>
            {activeTab === 'coach' ? 'Coach Guides' : 'Client Guides'}
          </p>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {currentGuides.map(g => (
              <SidebarLink key={g.id} id={g.id} label={g.label} active={activeSection === g.id} />
            ))}
          </nav>

          <div style={{ marginTop: 24, padding: '14px', background: T.tealBg, borderRadius: 10, border: `1px solid ${T.tealBorder}` }}>
            <p style={{ fontSize: '0.78rem', color: T.textSec, lineHeight: 1.6, margin: 0 }}>
              {activeTab === 'coach'
                ? 'Switch to Client Guides for step-by-step instructions you can share directly with your clients.'
                : 'Each guide has a "Copy shareable link" button so you can send the exact URL to your clients.'}
            </p>
            <button
              onClick={() => setActiveTab(activeTab === 'coach' ? 'client' : 'coach')}
              style={{
                marginTop: 10, fontSize: '0.78rem', fontWeight: 600,
                color: T.teal, background: 'none', border: 'none',
                cursor: 'pointer', padding: 0,
              }}
            >
              {activeTab === 'coach' ? 'View Client Guides →' : 'View Coach Guides →'}
            </button>
          </div>
        </aside>

        {/* Guide content */}
        <main style={{ flex: 1, minWidth: 0 }}>

          {/* ─────────── COACH GUIDES ─────────── */}
          {activeTab === 'coach' && (
            <>
              {/* G01 — Getting Started */}
              <GuideSection id="getting-started" number="01" title="Getting Started as a Coach" readTime="10 min read">
                <VideoEmbed src="https://www.youtube.com/embed/Ysso7rJSSdE" title="Getting Started as a Coach" />
                <p style={{ fontSize: '0.9rem', color: T.textSec, lineHeight: 1.75, marginBottom: 20 }}>
                  Before you invite your first client, take 10 minutes to set yourself up properly. A complete profile means clients land in a polished experience from day one.
                </p>
                <Step n={1} title="Set your display name and timezone">
                  Go to <strong>Coach Settings</strong> (at the bottom of the left sidebar, or tap More → Settings on mobile). Set your display name — this is the name that appears in invite emails and throughout the client-facing app. Set your timezone so that scheduled check-ins and reminders fire at the right time for you.
                </Step>
                <Step n={2} title="Add your branding (Coach Pro and above)">
                  Under the <strong>Branding</strong> section in Settings, upload your logo (PNG with transparent background works best — square or landscape), pick your primary brand colour with the colour picker, and enter your practice or gym name. These appear in the header for all your clients.
                </Step>
                <Step n={3} title="Create your services (Coach Pro and above)">
                  Under <strong>Services</strong>, add your service offerings — e.g. "1:1 Online Coaching — $200/month". Give each service a name, price label, short description, and payment link (Stripe, PayPal.me, or any URL). When you invite clients, you can attach a service so they're directed straight to payment. See the <a href="#settings" style={{ color: T.teal, fontWeight: 500 }}>Settings & Branding guide</a> for full details.
                </Step>
                <Step n={4} title="Set up your exercise library (Personal Trainers)">
                  Go to <strong>Exercises</strong> in the sidebar. Browse the built-in library. You can attach a YouTube URL to any exercise as a demo video. To add a custom exercise that isn't in the library, click + Add Exercise and give it a name, category, and optional video. Your custom exercises are saved for future programs.
                </Step>
                <Step n={5} title="Create a note template">
                  Go to <strong>Note Templates</strong> in the sidebar. Create a template for your weekly check-in note — for example, with headings for Progress, Adherence, Adjustments, and Notes. When you write coach notes inside a client&apos;s profile, you can load any saved template with a single click.
                </Step>
                <Step n={6} title="Send yourself a test invite">
                  Sign up with a second email as a client so you can see the full client experience before your real clients do. Check that the app preview, meal plan, and training calendar look the way you expect. Your coach dashboard has an <strong>App Preview</strong> tab on each client profile too — but a live client account gives you the real experience.
                </Step>
                <Tip>
                  Don&apos;t wait until everything is perfect to invite your first client. The most important things are your display name and timezone. You can add branding and templates while clients are onboarding.
                </Tip>
              </GuideSection>

              {/* G02 — Inviting Clients */}
              <GuideSection id="inviting-clients" number="02" title="Inviting and Managing Clients" readTime="8 min read">
                <p style={{ fontSize: '0.9rem', color: T.textSec, lineHeight: 1.75, marginBottom: 20 }}>
                  Your client roster lives on the Clients page. Invites are sent by email, and you can pre-attach forms, autoflows, and services to make intake seamless.
                </p>
                <Step n={1} title="Go to your Coach Dashboard">
                  The invite form is at the top of the dashboard. You can also access it from the Clients page.
                </Step>
                <Step n={2} title="Enter the client's email">
                  Type their email address exactly as they&apos;ll use it to sign up. The invite link is sent here — double-check before sending.
                </Step>
                <Step n={3} title="Attach a service (optional, Coach Pro+)">
                  If you have services set up, select one from the dropdown. After the client creates their account, they&apos;re taken to a page showing your service details and a Pay Now button linking to your payment URL. This removes any manual follow-up from the intake process.
                </Step>
                <Step n={4} title="Attach a form or autoflow (optional)">
                  Pre-assign an intake form or onboarding autoflow. It&apos;s automatically assigned the moment the client accepts — no manual step needed. The client sees it waiting for them on their first login.
                </Step>
                <Step n={5} title="Send the invite">
                  Click <strong>Invite</strong>. The client receives an email with a personalised link. On your <strong>Clients</strong> page, the invite appears under Pending Invites with a copyable link — useful if the email lands in their spam folder.
                </Step>
                <Step n={6} title="Client accepts and sets up their profile">
                  The client clicks the link, creates an account (or logs in), goes through payment if attached, then completes a short profile setup: goal, body stats, activity level, and macro targets. After that, they land on their dashboard with everything you&apos;ve assigned ready to go.
                </Step>
                <Step n={7} title="Manage your roster">
                  <strong>Active clients</strong> show on the Clients page with their last check-in date. Clients with no recent check-in are flagged as lapsed on your dashboard. <strong>Archive a client</strong> by opening their profile — their data is preserved, they move to the Archived tab.
                </Step>
                <Note>
                  If a client already has a Prokol account (e.g. they were self-tracking), they can still accept your invite. They&apos;ll be linked to your roster and automatically upgraded to full coached access for the duration of their time with you.
                </Note>
                <Tip>
                  If a client says they didn&apos;t receive the invite email, go to Clients → find their pending invite → copy the invite URL and send it to them directly via text or email.
                </Tip>
              </GuideSection>

              {/* G03 — Training Programs */}
              <GuideSection id="training-programs" number="03" title="Building Training Programs" readTime="12 min read">
                <VideoEmbed src="https://www.youtube.com/embed/6suzsV89YBY" title="Building Training Programs" />
                <p style={{ fontSize: '0.9rem', color: T.textSec, lineHeight: 1.75, marginBottom: 20 }}>
                  Available on PT Solo, Coach Pro, and White-Label plans. Build reusable week-by-week programs, assign them to clients, and push changes automatically.
                </p>
                <Step n={1} title="Create a new program">
                  Go to <strong>Programs</strong> in the sidebar. Click <strong>+ New Program</strong>. Give it a name (e.g. "8-Week Strength Block") and an optional description. Click Create & Build — you&apos;re taken directly into the program builder.
                </Step>
                <Step n={2} title="Add your first week">
                  Click <strong>+ Add Week</strong>. A row for Week 1 appears. Weeks stack vertically; you can duplicate any week using the week actions menu (useful for progressive overload blocks).
                </Step>
                <Step n={3} title="Add days to the week">
                  Click <strong>+ Day</strong> inside a week row. Add as many training days as the program requires (e.g. 4 days for a Mon/Tue/Thu/Sat split). Name each day or leave it as "Day 1", "Day 2" — clients see these names on their calendar.
                </Step>
                <Step n={4} title="Build a training day">
                  Click on a day cell to open the day editor. Click <strong>Add</strong> and choose:
                  <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
                    <li><strong>Add Exercise</strong> — search the library or type a new name to create a custom exercise inline</li>
                    <li><strong>Add Section</strong> — create a labelled block (e.g. "A — Push", "AMRAP 12 min", "Finisher") with a score type: time, rounds+reps, reps, weight, distance, calories, or custom</li>
                  </ul>
                </Step>
                <Step n={5} title="Configure each exercise">
                  Each exercise block has:
                  <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
                    <li><strong>Metric selector</strong>: Weight + Reps, Reps Only, Weight + Time, Time, or Calories — choose what the client logs for this exercise</li>
                    <li><strong>Set rows</strong>: click + Set to add rows (each row = one set with a target weight, reps, and rest period)</li>
                    <li><strong>Coaching notes</strong>: a text field shown to the client below the exercise — use for cues, tempo instructions, or progressions</li>
                  </ul>
                </Step>
                <Step n={6} title="Reorder days and duplicate weeks">
                  Drag and drop day cells within a week to reorder them. Use the week actions menu to duplicate a week — great for building progressive overload by duplicating Week 1 and adjusting weights/volume in Week 2.
                </Step>
                <Step n={7} title="Assign to a client">
                  Click <strong>Assign to Client</strong>. Select the client and choose a start date. The program appears on the client&apos;s Calendar tab immediately, and on your view of their Training tab.
                </Step>
                <Step n={8} title="Push changes automatically">
                  The <strong>Push to clients</strong> toggle (on by default) means any edits you save are automatically synced to all clients currently on this program. Turn it off if you&apos;re making structural changes mid-cycle and don&apos;t want to affect live clients.
                </Step>
                <Note>
                  You can assign the same program template to multiple clients — each gets their own copy. The Push to clients toggle affects all of them simultaneously, so turn it off before making changes you only want to apply to one person.
                </Note>
                <Tip>
                  Build your base program template without any clients assigned. Once it&apos;s ready, assign it. This way you can edit freely during setup without the toggle affecting anyone.
                </Tip>
              </GuideSection>

              {/* G04 — Meal Plans */}
              <GuideSection id="meal-plans" number="04" title="Building and Assigning Meal Plans" readTime="6 min read">
                <VideoEmbed src="https://www.youtube.com/embed/c8GqAMXGQGI" title="Building and Assigning Meal Plans" />
                <p style={{ fontSize: '0.9rem', color: T.textSec, lineHeight: 1.75, marginBottom: 20 }}>
                  Available on Nutritionist Solo, Coach Pro, and White-Label plans. Create structured meal plans with food-level detail and assign them to clients.
                </p>
                <Step n={1} title="Create a new meal plan">
                  Go to <strong>Meal Plans</strong> in the sidebar. Click + New Meal Plan. Give it a descriptive name — e.g. "High Protein Fat Loss — Training Day" or "2,200 kcal Maintenance". Descriptive names help when a client has multiple active plans.
                </Step>
                <Step n={2} title="Build the plan">
                  Open the meal plan editor. Add meals (Breakfast, Lunch, Dinner, Snacks, Post-Workout — name them as you like), then add foods to each meal. Set quantities and portions. The editor tracks total macros across the plan.
                </Step>
                <Step n={3} title="Assign to a client">
                  From inside the editor, click <strong>Assign</strong>, or go to the client&apos;s profile → <strong>Meal Plan tab</strong> → assign from there. Set a start date and optionally an end date.
                </Step>
                <Step n={4} title="Multiple plans per client">
                  Clients can have more than one active meal plan simultaneously — useful for training-day vs. rest-day plans, or different calorie targets for different phases. Clients see tabs at the top of their meal plan section and can switch between them freely.
                </Step>
                <Step n={5} title="Control which plans are visible">
                  From the client&apos;s Meal Plan tab, you control which plan tabs are shown to the client. Hide a plan they shouldn&apos;t be actively using yet without deleting it.
                </Step>
                <Step n={6} title="Review their food logs">
                  The client&apos;s <strong>Food Logs tab</strong> shows what they&apos;re actually eating each day vs. what&apos;s prescribed. This is your primary adherence tool. Compare their logged macros to the plan targets.
                </Step>
                <Note>
                  Plans without an end date stay active indefinitely alongside any others. If you want to replace a plan, either delete the old one or set an end date so it naturally expires.
                </Note>
                <Tip>
                  Build a library of your go-to plan templates (e.g. "2,000 kcal Fat Loss Standard", "2,400 kcal Maintenance High Protein") and assign them as starting points — then adjust macros per client in their Settings.
                </Tip>
              </GuideSection>

              {/* G05 — Forms */}
              <GuideSection id="forms" number="05" title="Creating Forms and Reviewing Responses" readTime="7 min read">
                <p style={{ fontSize: '0.9rem', color: T.textSec, lineHeight: 1.75, marginBottom: 20 }}>
                  Build custom intake forms, weekly check-ins, and assessments. Responses are collected, badged, and reviewable per client.
                </p>
                <Step n={1} title="Create a new form">
                  Go to <strong>Forms</strong> in the sidebar. Click <strong>+ New Form</strong>. Choose to:
                  <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
                    <li>Start from scratch</li>
                    <li>Use a pre-built template (Onboarding, Weekly Check-in, or Custom)</li>
                    <li>Import from JotForm — paste in a JotForm share URL or form JSON</li>
                  </ul>
                </Step>
                <Step n={2} title="Add and configure questions">
                  In the form builder, click <strong>+ Add Question</strong>. Available question types:
                  <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
                    <li><strong>Short text</strong> — one-line answer (e.g. "What is your goal?&quot;)</li>
                    <li><strong>Long text</strong> — multi-line (e.g. "Describe your typical weekday eating pattern")</li>
                    <li><strong>Number</strong> — numeric input (e.g. "Rate your energy this week: 1–10")</li>
                    <li><strong>Single choice</strong> — radio buttons (one answer)</li>
                    <li><strong>Multiple choice</strong> — checkboxes (multiple answers)</li>
                    <li><strong>Dropdown</strong> — select from a list</li>
                    <li><strong>File upload</strong> — client can attach a document or photo</li>
                    <li><strong>Image upload</strong> — image-specific upload</li>
                  </ul>
                </Step>
                <Step n={3} title="Mark required questions and reorder">
                  Toggle <strong>Required</strong> on any question you want to make mandatory. Drag the handle on the left side of each question to reorder them.
                </Step>
                <Step n={4} title="Assign to clients">
                  Forms can be assigned in three ways:
                  <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
                    <li>During the <strong>invite flow</strong> — pre-assigned at signup</li>
                    <li>From the <strong>client&apos;s profile</strong> (Check-ins or Autoflows tab)</li>
                    <li>Via a <strong>check-in schedule</strong> — recurring weekly or fortnightly assignment</li>
                  </ul>
                </Step>
                <Step n={5} title="Review responses">
                  The Forms page shows an unread badge on each form. Click <strong>Responses</strong> to see all submissions. Click any submission to read the full response. Inside the client&apos;s <strong>Check-ins tab</strong>, you can mark responses as reviewed to clear the badge.
                </Step>
                <Note>
                  Forms assigned via a check-in schedule appear in the <strong>Check-ins</strong> feed and count toward the Check-ins badge — not the Forms badge. Only forms assigned directly via the invite or client profile count against the Forms badge.
                </Note>
                <Tip>
                  Create a detailed intake form and pre-assign it during every invite. By the time you have your first coaching session, you&apos;ll already have their full history, preferences, injuries, and goals — without scheduling a separate intake call.
                </Tip>
              </GuideSection>

              {/* G06 — Autoflows */}
              <GuideSection id="autoflows" number="06" title="Building Autoflows" readTime="10 min read">
                <VideoEmbed src="https://www.youtube.com/embed/tyt1S2qE9do" title="Building Autoflows" />
                <p style={{ fontSize: '0.9rem', color: T.textSec, lineHeight: 1.75, marginBottom: 20 }}>
                  Autoflows are automated sequences of steps that unlock for clients over time. They&apos;re ideal for onboarding, habit-building challenges, and structured program introductions — tasks that currently fall through the cracks.
                </p>
                <Step n={1} title="Create a new flow or import a preset">
                  Go to <strong>Autoflows</strong> in the sidebar. Click <strong>+ New Flow</strong> to start from scratch, or browse the preset templates (e.g. "3-Day Onboarding", "Weekly Check-in Sequence") and import one as a starting point.
                </Step>
                <Step n={2} title="Add steps">
                  Each step is a milestone for the client. Click <strong>+ Add Step</strong> to create one. Inside each step, you can add:
                  <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
                    <li><strong>Title and description</strong> — shown to the client at the top of the step</li>
                    <li><strong>Questions</strong> — text, textarea, scale 1–10, yes/no, or single choice. Responses appear in your Check-ins feed.</li>
                    <li><strong>To-do task list</strong> — individual tasks the client ticks off. Each task can link to a resource, a form, or an external URL.</li>
                    <li><strong>Attached resources</strong> — files or links from your resource library</li>
                    <li><strong>Linked form</strong> — the client completes this form as part of finishing the step</li>
                    <li><strong>Day offset</strong> — the step unlocks N days after the flow starts. Day 0 = available immediately.</li>
                  </ul>
                </Step>
                <Step n={3} title="Set day offsets for pacing">
                  Use day offsets to space out your sequence. For example: Step 1 (Day 0) = intake questions. Step 2 (Day 3) = first mini check-in. Step 3 (Day 7) = week one review form. The client sees a countdown on locked steps.
                </Step>
                <Step n={4} title="Assign to a client">
                  From the client&apos;s profile → <strong>Autoflows tab</strong>, click Assign Flow and select the flow. Alternatively, pre-assign a flow during the invite so it&apos;s waiting for the client on day one. You can assign the same flow to multiple clients — each runs on their own independent timer from the date they were assigned.
                </Step>
                <Step n={5} title="Track progress">
                  The client&apos;s Autoflows tab shows which steps are complete, in progress, or locked. Click on a completed step to read their responses. Autoflow check-in responses also appear in your aggregated <strong>Check-ins</strong> feed.
                </Step>
                <Note>
                  Steps unlock based on the day offset from when the flow was assigned to that specific client — not a global date. If you assign a flow to a new client on a Wednesday, their Day 3 step unlocks on Saturday.
                </Note>
                <Tip>
                  Build an onboarding autoflow that covers everything you&apos;d normally do in a first consultation: intake questions on Day 0, a habit baseline survey on Day 3, a full week-one review form on Day 7. Assign it at invite time. You get all the data without a single manual follow-up.
                </Tip>
              </GuideSection>

              {/* G07 — Resources */}
              <GuideSection id="resources" number="07" title="Managing Resources" readTime="5 min read">
                <p style={{ fontSize: '0.9rem', color: T.textSec, lineHeight: 1.75, marginBottom: 20 }}>
                  Upload PDFs, videos, links, and documents and push them to specific clients. Resources live in folders and appear in the client&apos;s Resources section in the app.
                </p>
                <Step n={1} title="Create folders">
                  Go to <strong>Resources</strong> in the sidebar. Click <strong>+ New Folder</strong> and give it a name and a colour (for visual organisation). Example folders: "Welcome Pack", "Meal Prep Videos", "Program PDFs", "Supplement References".
                </Step>
                <Step n={2} title="Upload or link a resource">
                  Inside a folder, click <strong>+ Add Resource</strong>. Choose a type:
                  <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
                    <li><strong>File</strong> — upload a PDF, image, or document from your computer</li>
                    <li><strong>Video</strong> — upload a video file, or paste a YouTube or Vimeo URL</li>
                    <li><strong>Link</strong> — any external URL (recipe sites, scheduling links, Spotify playlists, external tools)</li>
                  </ul>
                </Step>
                <Step n={3} title="Assign to a client">
                  Click the <strong>Assign</strong> button on any resource and select a client, or assign an entire folder. The resource or folder appears in the client&apos;s Resources page immediately.
                </Step>
                <Step n={4} title="Manage per client">
                  The <strong>Resources tab</strong> on a client&apos;s profile shows all resources currently assigned to them. Add or remove resources from there without going back to the main Resources library.
                </Step>
                <Tip>
                  Create a "Welcome Pack" folder with an intro video, your intake document, and links to anything clients need on day one (booking link, Telegram group, etc.). Pre-assign it in the invite flow — every new client gets it automatically without you doing anything extra.
                </Tip>
              </GuideSection>

              {/* G08 — Check-ins */}
              <GuideSection id="check-ins" number="08" title="The Check-in Feed" readTime="5 min read">
                <VideoEmbed src="https://www.youtube.com/embed/HtwyNXKQytI" title="The Check-in Feed" />
                <p style={{ fontSize: '0.9rem', color: T.textSec, lineHeight: 1.75, marginBottom: 20 }}>
                  The Check-ins page gives you a single feed of all client check-ins across your entire roster — so you never miss a response.
                </p>
                <Step n={1} title="Open the Check-ins page">
                  Click <strong>Check-ins</strong> in the sidebar (or tap it in the mobile bottom nav). The sidebar badge shows the number of unreviewed direct check-ins.
                </Step>
                <Step n={2} title="What counts as a check-in">
                  The feed includes:
                  <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
                    <li>Direct daily check-ins (sleep, energy, HRV, RHR, notes) submitted by clients from their dashboard</li>
                    <li>Form submissions when a form is assigned via a check-in schedule</li>
                    <li>Autoflow step completions that include questions or a linked form</li>
                  </ul>
                </Step>
                <Step n={3} title="Leave feedback">
                  Click into any check-in to read the full submission. You can leave a text response — the client sees your feedback directly in the app. This is the primary feedback loop between you and your client.
                </Step>
                <Step n={4} title="Mark as reviewed">
                  After reviewing a check-in, click <strong>Mark as reviewed</strong> to clear it from your unread count. You can do this from the aggregated Check-ins page or from the client&apos;s individual Check-ins tab.
                </Step>
                <Step n={5} title="7-day upcoming schedule">
                  The right panel shows clients&apos; upcoming scheduled check-ins for the next 7 days, so you can plan your review sessions in advance.
                </Step>
                <Tip>
                  Make clearing your check-in feed a daily habit — treat it like an inbox. The sidebar badge gives you an instant read on who needs attention before you open any individual client file.
                </Tip>
              </GuideSection>

              {/* G09 — Notes */}
              <GuideSection id="notes" number="09" title="Notes and Note Templates" readTime="4 min read">
                <p style={{ fontSize: '0.9rem', color: T.textSec, lineHeight: 1.75, marginBottom: 20 }}>
                  Private coaching notes live on the client&apos;s Notes tab. Note templates let you load pre-written structures so every note starts from a consistent format.
                </p>
                <Step n={1} title="Open a client's Notes tab">
                  Go to <strong>Clients</strong> → select a client → click the <strong>Notes</strong> tab.
                </Step>
                <Step n={2} title="Create a note">
                  Click <strong>+ New Note</strong>. The rich-text editor supports bold, italic, underline, text colour, highlight colour, headings (H1/H2/H3), bullet lists, and numbered lists.
                </Step>
                <Step n={3} title="Load a template">
                  Click <strong>Load Template</strong> in the note editor and select from your saved templates. The template content is inserted into the current note, ready for you to fill in.
                </Step>
                <Step n={4} title="Create note templates">
                  Go to <strong>Note Templates</strong> in the sidebar. Click + New Template. Give it a name and write your standard structure. Examples:
                  <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
                    <li><strong>Weekly Check-in Note</strong>: Progress / Adherence / Adjustments / Action Items</li>
                    <li><strong>New Client Setup</strong>: Goals / Medical History / Preferences / Red Flags / Notes</li>
                    <li><strong>Program Review</strong>: Strength Progress / Recovery / Lifestyle Factors / Next Block</li>
                  </ul>
                </Step>
                <Note>
                  Coach notes are private — clients never see them. They are for your records only.
                </Note>
                <Tip>
                  Consistent note structure makes it much faster to review a client&apos;s history at a glance. A good template means you spend 3 minutes writing a clear note rather than 10 minutes writing a freeform one.
                </Tip>
              </GuideSection>

              {/* G10 — Settings */}
              <GuideSection id="settings" number="10" title="Settings, Branding and Services" readTime="6 min read">
                <p style={{ fontSize: '0.9rem', color: T.textSec, lineHeight: 1.75, marginBottom: 20 }}>
                  Customise how the app looks for your clients, set up payment-linked service offerings, and manage your subscription.
                </p>
                <Step n={1} title="Access Coach Settings">
                  Click <strong>Settings</strong> at the bottom of the left sidebar (desktop), or tap More → Settings (mobile).
                </Step>
                <Step n={2} title="Display name and timezone">
                  Set the name clients see in invite emails and throughout the app. Set your timezone — this affects when scheduled check-in reminders fire for you and your clients.
                </Step>
                <Step n={3} title="Branding (Coach Pro and above)">
                  Under the <strong>Branding</strong> section:
                  <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
                    <li><strong>Logo</strong>: Upload your practice logo. Recommended: PNG with transparent background, square or landscape format. Max size: 1MB.</li>
                    <li><strong>Brand colour</strong>: Pick your primary colour using the colour picker. This becomes the accent colour throughout the client-facing app.</li>
                    <li><strong>Brand name</strong>: Your practice or gym name — shown in the app title for your clients.</li>
                  </ul>
                </Step>
                <Step n={4} title="Services (Coach Pro and above)">
                  Under the <strong>Services</strong> section, add your offerings:
                  <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
                    <li><strong>Service name</strong>: e.g. "1:1 Online Coaching" or "Nutrition Consult Package"</li>
                    <li><strong>Price label</strong>: e.g. "$200/month" or "From $150/session" (display text only, not a number field)</li>
                    <li><strong>Payment link</strong>: Your Stripe payment link, PayPal.me URL, or any checkout URL</li>
                    <li><strong>Description</strong>: Short text shown to clients on the payment landing page</li>
                  </ul>
                </Step>
                <Step n={5} title="Attach a service during invite">
                  When inviting a client, select the service from the dropdown. After creating their account, the client lands on a page with your service details and a <strong>Pay Now</strong> button. You get paid, they get access — no manual back-and-forth.
                </Step>
                <Step n={6} title="Billing">
                  The <strong>Billing</strong> section shows your current Prokol plan. Upgrade, downgrade, or cancel from here. Billing is managed via Stripe.
                </Step>
                <Tip>
                  If you offer multiple services (nutrition only, PT only, combined coaching), create a separate service for each with its own payment link. This keeps intake clean and means every client pays the right amount for the right service.
                </Tip>
              </GuideSection>
            </>
          )}

          {/* ─────────── CLIENT GUIDES ─────────── */}
          {activeTab === 'client' && (
            <>
              {/* Client walkthrough video */}
              <div style={{
                background: T.white, borderRadius: 16, border: `1px solid ${T.border}`,
                padding: '32px 36px', marginBottom: 24, textAlign: 'center',
              }}>
                <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: T.teal, textTransform: 'uppercase', marginBottom: 8 }}>
                  Watch First
                </p>
                <h2 style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 'clamp(1.2rem, 3vw, 1.6rem)', color: T.textPrimary, marginBottom: 6, letterSpacing: '-0.02em' }}>
                  App Walkthrough
                </h2>
                <p style={{ fontSize: '0.88rem', color: T.textSec, marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
                  A quick tour of everything you&apos;ll find in your Prokol app.
                </p>
                <IPhoneFrame src="https://www.youtube.com/embed/ZaEZjPiMKRg" title="Client App Walkthrough" />
              </div>

              <div style={{
                background: T.tealBg, border: `1px solid ${T.tealBorder}`,
                borderRadius: 12, padding: '14px 18px', marginBottom: 20,
                display: 'flex', gap: 12, alignItems: 'center',
              }}>
                <span style={{ fontSize: '1rem' }}>🔗</span>
                <p style={{ fontSize: '0.85rem', color: T.textSec, margin: 0, lineHeight: 1.6 }}>
                  <strong style={{ color: T.textPrimary }}>For coaches:</strong> Each guide below has a <strong>Copy shareable link</strong> button. Click it to copy a direct URL you can send to your clients via message, email, or autoflow task.
                </p>
              </div>

              {/* C01 — Getting Started */}
              <GuideSection id="client-getting-started" number="01" title="Getting Started — Creating Your Account" readTime="5 min read" isClient>
                <p style={{ fontSize: '0.9rem', color: T.textSec, lineHeight: 1.75, marginBottom: 20 }}>
                  Welcome to Prokol. Here&apos;s how to get set up and into your dashboard in under 10 minutes.
                </p>
                <Step n={1} title="Check your email for the invite">
                  Your coach has sent you an invite email. Click the <strong>Accept invite</strong> button or link inside it. If you don&apos;t see the email within 10 minutes, check your spam or junk folder. If it&apos;s still not there, ask your coach to copy and send you the invite link directly.
                </Step>
                <Step n={2} title="Create your account">
                  You&apos;ll land on the Prokol signup page. Enter your email address and choose a password. If you already have a Prokol account (e.g. you were previously self-tracking), log in instead — your coach will be linked to your existing account.
                </Step>
                <Step n={3} title="Complete payment (if required)">
                  If your coach has set up a paid service, you&apos;ll be shown a payment page after signup. Complete the payment through the link provided. Once paid, your coach will activate your account and you&apos;re in.
                </Step>
                <Step n={4} title="You're in">
                  Your dashboard is now live. You&apos;ll see your daily nutrition targets, a food log, and anything your coach has already set up for you (meal plan, habits, forms, autoflow steps). Start exploring.
                </Step>
                <Tip>
                  Install the app on your phone right away — it makes daily logging much faster. See the <a href="#client-install" style={{ color: T.teal, fontWeight: 500 }}>Installing the App</a> guide for how.
                </Tip>
              </GuideSection>

              {/* C02 — Nutrition Targets */}
              <GuideSection id="client-targets" number="02" title="Your Nutrition Targets" readTime="5 min read" isClient>
                <p style={{ fontSize: '0.9rem', color: T.textSec, lineHeight: 1.75, marginBottom: 20 }}>
                  Your nutrition targets are based on how much energy your body uses in a day (your TDEE). Here&apos;s what each number means and when to revisit them.
                </p>
                <Step n={1} title="Understanding your calorie target">
                  Your calorie target is your daily energy goal. If your goal is <strong>fat loss</strong>, it will be below your maintenance level (a deficit). If it&apos;s <strong>muscle gain</strong>, it&apos;ll be above (a surplus). If you&apos;re maintaining, it should roughly match what you burn.
                </Step>
                <Step n={2} title="Understanding your macros">
                  <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
                    <li><strong>Protein</strong>: The most important macro. Supports muscle, keeps you full, and doesn&apos;t change much between phases. Hit this one first.</li>
                    <li><strong>Carbohydrates</strong>: Your main fuel source — especially for training. If your coach has set a training-day and rest-day plan, carbs will likely be higher on training days.</li>
                    <li><strong>Fat</strong>: Supports hormones and brain function. Don&apos;t go too low.</li>
                  </ul>
                </Step>
                <Step n={3} title="Adjusting your targets">
                  If your coach has set your targets, check with them before changing anything. If you&apos;re self-managing: go to <strong>Settings</strong> (tap your profile icon, or find Settings in the navigation). Under Macro Targets, you can manually adjust your daily calorie and macro goals.
                </Step>
                <Step n={4} title="When to consider adjusting">
                  <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
                    <li>After 2–3 weeks with no movement in the direction of your goal</li>
                    <li>After a significant change in activity (new job, injury, training phase change)</li>
                    <li>If you feel consistently exhausted or flat (consider adding 100–200 kcal)</li>
                  </ul>
                </Step>
                <Note>
                  Your coach reviews your food logs and progress data regularly. Always check in with them before making target changes — they may have already spotted a trend and planned an adjustment.
                </Note>
                <Tip>
                  Targets are a starting point, not a rigid rule. Being within 100–150 calories most days is more effective than being perfect for two days and then abandoning it.
                </Tip>
              </GuideSection>

              {/* C03 — Food Logging */}
              <GuideSection id="client-food-logging" number="03" title="Logging Food Every Day" readTime="6 min read" isClient>
                <p style={{ fontSize: '0.9rem', color: T.textSec, lineHeight: 1.75, marginBottom: 20 }}>
                  The food log lives on your dashboard. It&apos;s divided into meals (Breakfast, Lunch, Dinner, Snacks) and tracks your running macro totals as you add foods.
                </p>
                <Step n={1} title="Adding a food">
                  Tap the <strong>+</strong> button next to the meal you want to add to (e.g. Breakfast). Type the food name in the search bar (e.g. "chicken breast", "oats", "banana"). Select the food from the results, choose the serving size and quantity, and tap <strong>Add</strong>. The food appears in your log and your running totals update at the top.
                </Step>
                <Step n={2} title="AI meal scanner (Elite tier)">
                  Tap the <strong>camera icon</strong> in the food log. Take a photo of your meal or upload one from your camera roll. The AI identifies the foods and estimates quantities. Review what it found, adjust any amounts, and confirm to log everything at once. This is especially useful for mixed meals or restaurant food.
                </Step>
                <Step n={3} title="Saving meals for reuse (Optimiser and above)">
                  If you eat the same meals regularly, save them. Build your meal using + Add Food (e.g. your standard breakfast: oats, protein powder, banana, almond butter). Once all ingredients are in, click <strong>Save Meal</strong> and give it a name. Next time, find it under <strong>Saved Meals</strong> and add it with one tap — macros and all.
                </Step>
                <Step n={4} title="Using your meal plan">
                  If your coach has created a meal plan for you, it appears on your dashboard. Use it as a guide for what to eat, then log your actual foods in the food log to track adherence. Your coach can see both what you&apos;re prescribed and what you&apos;re actually eating.
                </Step>
                <Tip>
                  Log as you eat, not at the end of the day. It takes 30 seconds per meal and is far more accurate than trying to remember everything at 9pm. If you eat out, search for restaurant items or use the closest home equivalent — estimating is better than skipping the log entirely.
                </Tip>
              </GuideSection>

              {/* C04 — Training Calendar */}
              <GuideSection id="client-training" number="04" title="Your Training Calendar" readTime="5 min read" isClient>
                <p style={{ fontSize: '0.9rem', color: T.textSec, lineHeight: 1.75, marginBottom: 20 }}>
                  For coached clients with an assigned training program. Your calendar shows your full program week by week, and lets you log your actual performance.
                </p>
                <Step n={1} title="Find your calendar">
                  Tap <strong>Calendar</strong> in the bottom navigation (mobile) or find it in the top navigation (desktop). Today&apos;s date is highlighted. Tap on it to see today&apos;s prescribed session.
                </Step>
                <Step n={2} title="See your prescribed session">
                  Each training day shows the exercises your coach has programmed — including sets, reps, target weights, and any coaching notes. Read the notes before you start; they often include cues, tempo guidance, or progression rules.
                </Step>
                <Step n={3} title="Log your workout">
                  During or after your session, tap the workout to open it. For each exercise, enter the <strong>weight you used</strong> and the <strong>reps you completed</strong> for each set. Tap <strong>Save</strong> when done. Your coach can see exactly what you lifted.
                </Step>
                <Step n={4} title="Rest days">
                  Days without a workout are rest days. You don&apos;t need to log anything on those days — they&apos;re intentionally empty.
                </Step>
                <Step n={5} title="Missed sessions">
                  If you miss a session, you can still log it afterwards — tap the date on the calendar and enter what you did. If you missed it entirely, leave it blank. Your coach can see which sessions were completed and will factor this into their next check-in with you.
                </Step>
                <Tip>
                  Log your sets as you go rather than at the end of the session. You&apos;ll remember the weight and reps much more accurately, and it only takes a few seconds between sets.
                </Tip>
              </GuideSection>

              {/* C05 — Check-ins */}
              <GuideSection id="client-check-ins" number="05" title="Completing Your Check-ins and Forms" readTime="5 min read" isClient>
                <p style={{ fontSize: '0.9rem', color: T.textSec, lineHeight: 1.75, marginBottom: 20 }}>
                  Check-ins are how your coach monitors your progress between sessions. Here&apos;s where to find them and how to complete them properly.
                </p>
                <Step n={1} title="Finding assigned forms">
                  On your dashboard, look for a <strong>Forms</strong> section or a banner prompting you to complete an outstanding form. Tap it to open the form. Forms can also be linked inside autoflow steps (see below).
                </Step>
                <Step n={2} title="Completing a form">
                  Answer each question honestly and completely. Your coach uses these answers to understand your progress and make adjustments to your program or nutrition. Once submitted, you can&apos;t edit the response — if you need to correct something, send your coach a message.
                </Step>
                <Step n={3} title="Autoflow steps">
                  If your coach has set up an onboarding or ongoing sequence for you, you&apos;ll see it on your dashboard under <strong>Coaching</strong>. Each step has a checklist of tasks and questions to complete. Some steps unlock automatically after a set number of days — you&apos;ll see a countdown if one isn&apos;t available yet. Complete tasks, answer questions, and tap Submit when done.
                </Step>
                <Step n={4} title="Daily check-in (self-tracking users)">
                  If you don&apos;t have a coach, or your coach hasn&apos;t set up a check-in form, use the <strong>Daily Check-in</strong> section on your dashboard. Log your sleep hours, sleep quality, energy level, resting heart rate, and any notes. This data tracks over time so you can spot patterns.
                </Step>
                <Tip>
                  Honest check-ins give your coach the real picture. Don&apos;t round up your adherence or hide a hard week — your coach isn&apos;t grading you. The more accurate your data, the better the advice they can give.
                </Tip>
              </GuideSection>

              {/* C06 — Progress */}
              <GuideSection id="client-progress" number="06" title="Progress Photos and Weight Tracking" readTime="5 min read" isClient>
                <p style={{ fontSize: '0.9rem', color: T.textSec, lineHeight: 1.75, marginBottom: 20 }}>
                  Track your physical progress over time. The scale is one data point — progress photos tell the rest of the story.
                </p>
                <Step n={1} title="Logging your weight">
                  On your dashboard, find the <strong>Weight</strong> section. Tap to enter today&apos;s weight. Log consistently at the same time each day — first thing in the morning, after using the bathroom, before eating or drinking. Your weight trend chart updates with each entry.
                </Step>
                <Step n={2} title="Reading your weight trend">
                  Day-to-day weight naturally varies by 1–3kg or more due to water retention, food volume, digestion, and hormones. This is normal. Focus on the <strong>weekly average trend</strong>, not individual days. Your coach looks at the trend line, not the daily number.
                </Step>
                <Step n={3} title="Taking progress photos (Optimiser and above)">
                  Go to <strong>Progress</strong> in the navigation. Tap <strong>+ Add Photo</strong> to upload a photo from your camera roll or take one in the app. Photos are stored privately and only visible to you and your coach.
                </Step>
                <Step n={4} title="Comparing photos">
                  In the Progress section, select two photos from different dates to see a side-by-side before/after comparison. Use this monthly to see changes that are too gradual to notice day-to-day.
                </Step>
                <Step n={5} title="How to take consistent photos">
                  <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
                    <li>Same time of day (morning, post-bathroom, before eating)</li>
                    <li>Same clothing (or none) each time</li>
                    <li>Same lighting and location</li>
                    <li>Take from the front, side, and back</li>
                    <li>Fortnightly is enough — daily won&apos;t show meaningful change</li>
                  </ul>
                </Step>
                <Tip>
                  The scale will lie to you in the short term. Progress photos taken consistently over 4–8 weeks tell the real story. Many people see clear body composition changes with little or no scale movement — especially those who are also gaining muscle.
                </Tip>
              </GuideSection>

              {/* C07 — Cycle Tracker */}
              <GuideSection id="client-cycle" number="07" title="The Cycle Tracker" readTime="5 min read" isClient>
                <p style={{ fontSize: '0.9rem', color: T.textSec, lineHeight: 1.75, marginBottom: 20 }}>
                  Track your menstrual cycle, symptoms, and patterns. Your coach can use this data to time your training and nutrition around your cycle.
                </p>
                <Step n={1} title="Find the Cycle section">
                  Tap <strong>Cycle</strong> in the bottom navigation (mobile) or the top nav (desktop).
                </Step>
                <Step n={2} title="Log your period">
                  When your period starts, tap that date on the calendar and mark it as a period day. Continue marking each day of your period as it goes. After 2–3 cycles logged, the app starts predicting your next period start date.
                </Step>
                <Step n={3} title="Log symptoms and mood">
                  On any day, tap the date to log symptoms (cramps, bloating, headache, breast tenderness, fatigue), moods (low energy, anxious, motivated, irritable), basal body temperature (BBT) if you track it, and cervical mucus observations.
                </Step>
                <Step n={4} title="Phase bar">
                  Below the calendar, the phase bar shows where you are in your current cycle: Menstrual, Follicular, Ovulatory, or Luteal. This updates automatically from your logged period dates.
                </Step>
                <Step n={5} title="Predictions (Elite)">
                  After 2–3 logged cycles, Prokol predicts your next period start date and fertile window. Enable cycle reminders in the Cycle section to get a push notification a few days before your predicted period.
                </Step>
                <Step n={6} title="What your coach can see">
                  Your coach can view your cycle calendar in your client profile — including period days, predictions, and your logged symptoms and moods for each date. They use this to better time your training intensity, nutrition adjustments, and check-in frequency around your cycle. If you&apos;d prefer they don&apos;t see specific information, discuss this with your coach directly.
                </Step>
                <Tip>
                  Even if you only log period start and end dates and nothing else, it&apos;s enough to build useful patterns. Consistent basic logging over 3 months is more valuable than detailed logging for 2 weeks and then stopping.
                </Tip>
              </GuideSection>

              {/* C08 — Messages */}
              <GuideSection id="client-messages" number="08" title="Messaging Your Coach" readTime="3 min read" isClient>
                <p style={{ fontSize: '0.9rem', color: T.textSec, lineHeight: 1.75, marginBottom: 20 }}>
                  The in-app messaging keeps your coaching communication in one place — separate from emails and texts.
                </p>
                <Step n={1} title="Find Messages">
                  Tap <strong>Messages</strong> in the bottom navigation (mobile) or find it in the top nav (desktop). If you&apos;re assigned to one coach, you&apos;ll go straight to your conversation. If there are multiple conversations, you&apos;ll see a list.
                </Step>
                <Step n={2} title="Send a message">
                  Type in the message box at the bottom and tap Send. Your coach will receive a notification and reply when available.
                </Step>
                <Step n={3} title="Send a voice note">
                  Tap the <strong>microphone icon</strong> to record a voice message. Hold to record, release to send. Voice notes are great for quickly explaining something that&apos;s hard to type — like how a workout felt or a tricky food situation.
                </Step>
                <Note>
                  Response times vary by coach. If you have an urgent question, check whether your coach has set up expected response hours in their profile.
                </Note>
                <Tip>
                  Use messages for quick updates your coach needs to know about but that don&apos;t fit in a check-in — a work event, a late night, an injury, or a food win. A two-line message is enough. Your coach appreciates the context.
                </Tip>
              </GuideSection>

              {/* C09 — Install */}
              <GuideSection id="client-install" number="09" title="Installing the App on Your Phone" readTime="2 min read" isClient>
                <p style={{ fontSize: '0.9rem', color: T.textSec, lineHeight: 1.75, marginBottom: 20 }}>
                  Prokol works in your browser, but you can install it on your home screen so it feels and behaves like a native app — with push notifications and full-screen mode. No App Store required.
                </p>
                <Step n={1} title="On iPhone or iPad (Safari only)">
                  <ol style={{ paddingLeft: 20, lineHeight: 2 }}>
                    <li>Open <strong>prokol.io</strong> in <strong>Safari</strong> (not Chrome — Chrome on iOS doesn&apos;t support this)</li>
                    <li>Tap the <strong>Share icon</strong> at the bottom of the screen (the box with an upward arrow)</li>
                    <li>Scroll down in the share sheet and tap <strong>&quot;Add to Home Screen&quot;</strong></li>
                    <li>Give it a name (or leave it as Prokol) and tap <strong>Add</strong></li>
                    <li>The Prokol icon appears on your home screen. Tap it to open in full-screen mode.</li>
                  </ol>
                </Step>
                <Step n={2} title="On Android (Chrome)">
                  <ol style={{ paddingLeft: 20, lineHeight: 2 }}>
                    <li>Open <strong>prokol.io</strong> in <strong>Chrome</strong></li>
                    <li>Tap the <strong>three-dot menu</strong> in the top-right corner</li>
                    <li>Tap <strong>&quot;Add to Home Screen&quot;</strong> or <strong>&quot;Install App&quot;</strong></li>
                    <li>Confirm the installation</li>
                    <li>The Prokol icon appears on your home screen and app drawer</li>
                  </ol>
                </Step>
                <Step n={3} title="Enable push notifications">
                  When you first open the installed app, you&apos;ll be prompted to allow push notifications. Tap <strong>Allow</strong>. This is how your coach&apos;s reminders, check-in prompts, and message notifications reach you without you having to open a browser.
                </Step>
                <Tip>
                  If you don&apos;t see the &quot;Add to Home Screen&quot; option on iOS, make sure you&apos;re using Safari (not Chrome or Firefox). The option only appears in Safari on iPhone and iPad.
                </Tip>
              </GuideSection>
            </>
          )}

          {/* Footer */}
          <div style={{
            textAlign: 'center', padding: '32px 0 48px',
            borderTop: `1px solid ${T.border}`, marginTop: 8,
          }}>
            <p style={{ fontSize: '0.85rem', color: T.textSec, marginBottom: 12 }}>
              Something not covered here? Get in touch.
            </p>
            <a
              href="mailto:info@prokol.io"
              style={{
                display: 'inline-block', padding: '10px 24px',
                background: T.teal, color: '#fff', borderRadius: 10,
                fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none',
              }}
            >
              Contact support
            </a>
            <div style={{ marginTop: 24 }}>
              <Link href="/" style={{ fontSize: '0.8rem', color: T.textSec, textDecoration: 'none' }}>
                ← Back to Prokol
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
