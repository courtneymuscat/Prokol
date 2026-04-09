'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Preset = {
  key: string
  name: string
  type: 'weekly_checkin' | 'onboarding'
  steps: string
  when: string
  how: string
  questions: string[]
}

const PRESETS: Preset[] = [
  {
    key: 'new_client_onboarding',
    name: 'New Client Onboarding',
    type: 'onboarding',
    steps: '4 stages · day 0, 3, 7, 14',
    when: 'Assign on day 1 of coaching. The client gets forms at day 0 (welcome), day 3 (eating habits), day 7 (lifestyle & training) and day 14 (two-week check). Gives you a full picture without overwhelming them on day one.',
    how: 'Assign immediately when a new client joins.',
    questions: ['Food preferences & allergies', 'Goals & motivation', 'Lifestyle, sleep & stress', 'Typical day of eating'],
  },
  {
    key: '12_week_checkin',
    name: '12-Week Progressive Check-in',
    type: 'weekly_checkin',
    steps: '12 steps · weekly',
    when: 'Assign at the start of a 12-week program. Core questions (weight, energy, adherence) appear every week. Focus questions change each week — early weeks build habits, middle weeks track momentum, final weeks reflect on the journey.',
    how: 'Assign at program start with today as the start date.',
    questions: ['Weekly weight + energy', 'Nutrition adherence', 'Training consistency', 'Progressive reflection questions'],
  },
  {
    key: 'monthly_composition',
    name: 'Monthly Body Composition Review',
    type: 'onboarding',
    steps: '6 stages · monthly',
    when: 'Assign on day 1 of coaching as an ongoing tracker. The client gets a form every 30 days with the same core questions (weight, measurements, adherence, energy) plus a milestone question for months 3 and 6.',
    how: 'Assign on day 1 alongside your regular check-in flow.',
    questions: ['Weight & measurements', 'Progress photos prompt', 'Energy & sleep', 'Monthly reflection'],
  },
  {
    key: 'habit_building',
    name: 'Habit-Building Phase',
    type: 'weekly_checkin',
    steps: '6 weeks · weekly',
    when: 'Assign at the start of coaching for clients who need to build foundations before focusing on calories or macros. Each week introduces one new habit: meal timing, protein, vegetables, hydration, mindful eating, then a final lock-in.',
    how: 'Assign instead of (or before) a strict nutrition plan for habit-focused clients.',
    questions: ['Habit consistency score', 'Weekly focus habit check', 'What helped or hindered', 'Confidence & readiness'],
  },
  {
    key: 'plateau_protocol',
    name: 'Plateau Protocol',
    type: 'onboarding',
    steps: '3 stages · day 0, 3, 7',
    when: 'Assign reactively when you notice a client\'s weight has stalled for 2+ weeks. Day 0 is a full diagnostic (eating habits, accuracy, stress, sleep), day 3 checks if adjustments are working, day 7 confirms if the plateau has broken.',
    how: 'Assign manually from the client\'s Autoflows tab when you spot a stall in their weight or food logs.',
    questions: ['Full day-of-eating audit', 'Tracking accuracy', 'Stress & sleep', 'What changed, what resolved it'],
  },
  {
    key: 'post_consultation',
    name: 'Post-Consultation Follow-up',
    type: 'onboarding',
    steps: '3 stages · day 1, 3, 7',
    when: 'Assign immediately after any coaching session or plan change. Checks in at 24h (first impressions), day 3 (early implementation) and day 7 (one full week of changes). Ensures clients don\'t silently struggle with advice they didn\'t fully understand.',
    how: 'Assign after every major consultation or plan update.',
    questions: ['How they felt about the session', 'Changes implemented', 'Obstacles encountered', 'Readiness to continue'],
  },
  {
    key: 'holiday_eating',
    name: 'Pre/Post Holiday Eating Plan',
    type: 'onboarding',
    steps: '4 stages · week 0, 1, 2, 3',
    when: 'Assign 1 week before a client\'s holiday or major event. Stage 1 is pre-holiday strategy, stage 2 is a mid-holiday check-in, stage 3 is the post-holiday reset, stage 4 confirms they\'re back on track.',
    how: 'Assign when a client mentions upcoming travel, Christmas, a holiday or any event where eating will be disrupted.',
    questions: ['Pre-holiday strategy & fears', 'Mid-holiday mindfulness', 'Post-holiday weight & reset', 'What to do differently next time'],
  },
  {
    key: 'quarterly_review',
    name: 'Goal Reset + Quarterly Review',
    type: 'onboarding',
    steps: '4 stages · monthly',
    when: 'Assign at the start of every new quarter. The client sets 3 intentions at the start, then checks in monthly, with a full review at day 90. Great for long-term clients where momentum and motivation need regular renewal.',
    how: 'Assign at the start of Q1, Q2, Q3 and Q4 for any client in ongoing coaching.',
    questions: ['Quarterly goals & intentions', 'Monthly progress checks', 'Reflection & lessons', 'Next quarter planning'],
  },
]

const TYPE_BADGE: Record<string, string> = {
  weekly_checkin: 'Weekly check-in',
  onboarding: 'Staged flow',
}

export default function AutoflowPresets({ existingNames }: { existingNames: string[] }) {
  const router = useRouter()
  const [creating, setCreating] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<string | null>(null)

  async function createFromPreset(key: string) {
    setCreating(key)
    const res = await fetch('/api/coach/autoflows/from-preset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset: key }),
    })
    const d = await res.json()
    if (d.id) router.push(`/coach/autoflows/${d.id}`)
    else setCreating(null)
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Starter templates</h2>
        <p className="text-xs text-gray-500 mt-0.5">Create a ready-made flow and customise it to your style. Click <span className="font-medium">?</span> to learn when and how to use each one.</p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {PRESETS.map(p => {
          const alreadyExists = existingNames.includes(p.name)
          const isCreating = creating === p.key
          const isOpen = tooltip === p.key

          return (
            <div key={p.key} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">{p.name}</span>
                    <span className="text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full flex-shrink-0">
                      {TYPE_BADGE[p.type]}
                    </span>
                    <span className="text-[11px] text-gray-400 flex-shrink-0">{p.steps}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setTooltip(isOpen ? null : p.key)}
                    className={`w-6 h-6 rounded-full text-xs font-bold border transition-colors ${isOpen ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-400 hover:border-gray-500 hover:text-gray-600'}`}
                  >
                    ?
                  </button>
                  {alreadyExists ? (
                    <span className="text-xs text-gray-400 px-3">Added</span>
                  ) : (
                    <button
                      onClick={() => createFromPreset(p.key)}
                      disabled={!!creating}
                      className="text-xs font-semibold text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-500 hover:text-gray-900 disabled:opacity-40 transition-colors"
                    >
                      {isCreating ? 'Creating…' : 'Use template'}
                    </button>
                  )}
                </div>
              </div>

              {/* Tooltip / explainer */}
              {isOpen && (
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-3.5 space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-1">When to assign</p>
                    <p className="text-xs text-gray-600 leading-relaxed">{p.when}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-1">What it covers</p>
                    <div className="flex flex-wrap gap-1.5">
                      {p.questions.map(q => (
                        <span key={q} className="text-[11px] bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{q}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
