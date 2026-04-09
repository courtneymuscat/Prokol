import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

type Q = { id: string; type: string; label: string; required: boolean; options?: string[] }

function q(type: string, label: string, required = true, options?: string[]): Q {
  return { id: crypto.randomUUID(), type, label, required, options }
}

// ── Preset definitions ────────────────────────────────────────────────────────

const PRESETS: Record<string, {
  name: string
  description: string
  type: string
  total_steps: number
  core_questions: Q[]
  steps: { step_number: number; title: string; description: string; questions: Q[]; day_offset: number }[]
}> = {

  '12_week_checkin': {
    name: '12-Week Progressive Check-in',
    description: 'Weekly check-ins that evolve over 12 weeks — core questions every week, with focus questions that shift as the client progresses.',
    type: 'weekly_checkin',
    total_steps: 12,
    core_questions: [
      q('number', 'Weight this morning (kg or lbs)'),
      q('scale',  'Overall energy this week (1 = exhausted, 10 = great)'),
      q('scale',  'How closely did you follow your nutrition plan? (1–10)'),
      q('number', 'How many days did you train this week?'),
      q('text',   'Biggest win this week'),
      q('text',   'Main challenge this week'),
    ],
    steps: [
      { step_number: 1,  day_offset: 0,   title: 'Week 1',  description: 'Welcome to your first check-in. Let\'s get a baseline picture.',
        questions: [q('textarea', 'Describe your current eating habits — what does a typical day look like?'), q('textarea', 'What are you most hoping to change or improve over the next 12 weeks?')] },
      { step_number: 2,  day_offset: 7,   title: 'Week 2',  description: '', questions: [q('textarea', 'How has the first week felt? Any surprises?'), q('yesno', 'Did you feel hungry or deprived at any point?')] },
      { step_number: 3,  day_offset: 14,  title: 'Week 3',  description: '', questions: [q('scale', 'How confident are you feeling about your progress? (1–10)'), q('textarea', 'What habits are starting to stick?')] },
      { step_number: 4,  day_offset: 21,  title: 'Week 4',  description: 'One month in — let\'s reflect.',
        questions: [q('textarea', 'What\'s shifted since we started — physically or mentally?'), q('yesno', 'Do you feel the plan suits your lifestyle?'), q('textarea', 'Anything you\'d like to adjust?')] },
      { step_number: 5,  day_offset: 28,  title: 'Week 5',  description: '', questions: [q('scale', 'How consistent have you been with meals this week? (1–10)'), q('textarea', 'Any social eating situations or travel this week?')] },
      { step_number: 6,  day_offset: 35,  title: 'Week 6',  description: 'Halfway point check-in.',
        questions: [q('textarea', 'Comparing to week 1 — what feels different?'), q('scale', 'How motivated are you feeling right now? (1–10)'), q('textarea', 'What would make the next 6 weeks even better?')] },
      { step_number: 7,  day_offset: 42,  title: 'Week 7',  description: '', questions: [q('yesno', 'Have you noticed any changes in your hunger or cravings?'), q('textarea', 'How is your sleep and recovery this week?')] },
      { step_number: 8,  day_offset: 49,  title: 'Week 8',  description: 'Two months in.',
        questions: [q('textarea', 'What\'s working best in your routine right now?'), q('textarea', 'What\'s still feeling hard or inconsistent?')] },
      { step_number: 9,  day_offset: 56,  title: 'Week 9',  description: '', questions: [q('scale', 'How is your stress level affecting your eating? (1 = a lot, 10 = not at all)'), q('textarea', 'Any life events or changes coming up I should know about?')] },
      { step_number: 10, day_offset: 63,  title: 'Week 10', description: '', questions: [q('yesno', 'Have you been taking progress photos or measurements?'), q('textarea', 'What do you notice has changed physically?')] },
      { step_number: 11, day_offset: 70,  title: 'Week 11', description: 'Almost there.',
        questions: [q('textarea', 'What are you most proud of from this 12-week journey?'), q('textarea', 'What habits do you want to keep long-term?')] },
      { step_number: 12, day_offset: 77,  title: 'Week 12 — Final Review', description: 'Congratulations on completing 12 weeks! Let\'s reflect on the full journey.',
        questions: [q('textarea', 'How do you compare to where you started 12 weeks ago?'), q('scale', 'Overall, how satisfied are you with your progress? (1–10)'), q('textarea', 'What would you tell your week-1 self?'), q('yesno', 'Would you like to continue coaching?')] },
    ],
  },

  'monthly_composition': {
    name: 'Monthly Body Composition Review',
    description: 'Recurring monthly check-ins tracking measurements, energy, adherence and progress photos.',
    type: 'onboarding',
    total_steps: 6,
    core_questions: [
      q('number',   'Current weight (kg or lbs)'),
      q('text',     'Waist measurement (cm or inches)'),
      q('text',     'Hip measurement (optional)'),
      q('scale',    'Average energy levels this month (1–10)'),
      q('scale',    'Nutrition adherence this month (1–10)'),
      q('scale',    'Sleep quality this month (1–10)'),
      q('textarea', 'What went well this month?'),
      q('textarea', 'What was your biggest challenge?'),
      q('textarea', 'Any changes to note — medications, stress, travel, hormones?', false),
    ],
    steps: [
      { step_number: 1, day_offset: 0,   title: 'Month 1 — Baseline', description: 'Let\'s establish your starting point.',
        questions: [q('yesno', 'Have you taken baseline progress photos?'), q('textarea', 'Describe your body composition goals in your own words.'), q('textarea', 'What\'s your biggest motivation for this process?')] },
      { step_number: 2, day_offset: 30,  title: 'Month 2', description: '', questions: [q('yesno', 'Did you take progress photos this month?'), q('textarea', 'Comparing to last month — what do you notice?')] },
      { step_number: 3, day_offset: 60,  title: 'Month 3 — Quarter Check', description: '',
        questions: [q('yesno', 'Did you take progress photos this month?'), q('textarea', 'Looking back at 3 months — what\'s the biggest shift?'), q('yesno', 'Do you want to adjust your goals or focus for the next quarter?')] },
      { step_number: 4, day_offset: 90,  title: 'Month 4', description: '', questions: [q('yesno', 'Did you take progress photos this month?'), q('textarea', 'Any plateaus or changes in the rate of progress?')] },
      { step_number: 5, day_offset: 120, title: 'Month 5', description: '', questions: [q('yesno', 'Did you take progress photos this month?'), q('textarea', 'What habits feel fully automatic now vs still requiring effort?')] },
      { step_number: 6, day_offset: 150, title: 'Month 6 — Half-Year Review', description: 'Six months in — a major milestone.',
        questions: [q('yesno', 'Did you take progress photos this month?'), q('textarea', 'Reflecting on 6 months — what are you most proud of?'), q('scale', 'How satisfied are you with your overall progress? (1–10)'), q('yesno', 'Would you like to continue this monthly check-in going forward?')] },
    ],
  },

  'plateau_protocol': {
    name: 'Plateau Protocol',
    description: 'A short 3-step diagnostic flow to assign when a client\'s progress has stalled for 2+ weeks.',
    type: 'onboarding',
    total_steps: 3,
    core_questions: [
      q('number', 'Current weight this morning (kg or lbs)'),
      q('scale',  'Energy levels right now (1–10)'),
    ],
    steps: [
      { step_number: 1, day_offset: 0, title: 'Day 1 — Diagnostic', description: 'Let\'s figure out what\'s going on. Be as honest as possible — no judgement.',
        questions: [
          q('textarea', 'Walk me through a typical day of eating right now (breakfast through dinner + snacks)'),
          q('yesno',    'Are you weighing or tracking your food accurately right now?'),
          q('scale',    'How accurately do you think you\'re hitting your targets? (1 = not at all, 10 = spot on)'),
          q('scale',    'Stress levels this past 2 weeks (1 = very low, 10 = very high)'),
          q('scale',    'Sleep quality this past 2 weeks (1–10)'),
          q('yesno',    'Have you been more sedentary than usual?'),
          q('textarea', 'Any changes recently — travel, social events, hormonal changes, medications?', false),
          q('textarea', 'How are you feeling emotionally about the plateau?'),
        ]},
      { step_number: 2, day_offset: 3, title: 'Day 3 — Adjustment Check', description: 'A few days after making changes — let\'s see what\'s shifted.',
        questions: [
          q('textarea', 'What changes did you make after the last check-in?'),
          q('yesno',    'Have you seen any movement on the scales?'),
          q('scale',    'How are you feeling about the plan right now? (1–10)'),
          q('textarea', 'Anything else coming up that might be affecting things?', false),
        ]},
      { step_number: 3, day_offset: 7, title: 'Day 7 — Resolution Check', description: 'One week in — has the plateau broken?',
        questions: [
          q('yesno',    'Has the scale started moving again?'),
          q('textarea', 'Describe what\'s changed in the past week'),
          q('scale',    'How are you feeling about your progress now? (1–10)'),
          q('textarea', 'What do you think made the difference?', false),
        ]},
    ],
  },

  'habit_building': {
    name: 'Habit-Building Phase (6 Weeks)',
    description: 'A 6-week flow that gradually introduces and reinforces one new habit per week.',
    type: 'weekly_checkin',
    total_steps: 6,
    core_questions: [
      q('scale',    'How confident do you feel about your habits right now? (1–10)'),
      q('scale',    'How consistent were you with this week\'s focus habit? (1–10)'),
      q('textarea', 'What made it easier or harder to stick to this week?'),
    ],
    steps: [
      { step_number: 1, day_offset: 0,  title: 'Week 1 — Foundation', description: 'This week\'s focus: eating at regular times.',
        questions: [q('yesno', 'Did you eat at roughly the same times each day?'), q('textarea', 'What does your current meal timing look like?'), q('textarea', 'What\'s one small thing you can do to make this easier next week?')] },
      { step_number: 2, day_offset: 7,  title: 'Week 2 — Protein at Every Meal', description: 'This week\'s focus: including a protein source at every meal.',
        questions: [q('scale', 'How often did you include protein at each meal? (1 = rarely, 10 = every time)'), q('textarea', 'What protein sources are you relying on most?'), q('textarea', 'Any meals where it was hard to include protein?')] },
      { step_number: 3, day_offset: 14, title: 'Week 3 — Vegetables', description: 'This week\'s focus: 2+ servings of vegetables per day.',
        questions: [q('scale', 'How many days did you hit 2+ serves of veg? (out of 7)'), q('text', 'Your go-to vegetables this week'), q('yesno', 'Are vegetables feeling more automatic yet?')] },
      { step_number: 4, day_offset: 21, title: 'Week 4 — Hydration', description: 'This week\'s focus: consistent daily water intake.',
        questions: [q('number', 'Average daily water intake (litres or cups)'), q('yesno', 'Did you hit your water target most days?'), q('textarea', 'What helped you drink more? What got in the way?')] },
      { step_number: 5, day_offset: 28, title: 'Week 5 — Mindful Eating', description: 'This week\'s focus: slowing down and eating without distractions.',
        questions: [q('scale', 'How mindful were your meals this week? (1–10)'), q('yesno', 'Did you notice any difference in hunger or fullness?'), q('textarea', 'What did you observe about your eating patterns?')] },
      { step_number: 6, day_offset: 35, title: 'Week 6 — Review & Lock In', description: 'Final week — let\'s lock these habits in for the long term.',
        questions: [q('textarea', 'Which of the 5 habits feels most automatic now?'), q('textarea', 'Which one still needs the most work?'), q('scale', 'How confident are you that you\'ll maintain these habits long-term? (1–10)'), q('textarea', 'What support or accountability do you need going forward?')] },
    ],
  },

  'new_client_onboarding': {
    name: 'New Client Onboarding',
    description: 'A 4-stage welcome flow over 14 days — gets all the information you need while easing the client in.',
    type: 'onboarding',
    total_steps: 4,
    core_questions: [],
    steps: [
      { step_number: 1, day_offset: 0, title: 'Day 0 — Welcome', description: 'Welcome! Let\'s get to know you properly before we dive in.',
        questions: [
          q('text',     'Full name and preferred name'),
          q('number',   'Age'),
          q('choice',   'Biological sex (for TDEE calculation)', true, ['Male', 'Female', 'Prefer not to say']),
          q('number',   'Current height (cm or inches)'),
          q('number',   'Current weight (kg or lbs)'),
          q('textarea', 'What are your main health and body goals?'),
          q('textarea', 'Why now — what\'s motivating you to start?'),
          q('textarea', 'Any injuries, medical conditions or physical limitations I should know about?'),
          q('textarea', 'Any foods you dislike, allergies or dietary restrictions?'),
          q('choice',   'Do you currently cook at home?', true, ['Yes, most meals', 'Sometimes', 'Rarely — mostly takeaway/eating out']),
        ]},
      { step_number: 2, day_offset: 3, title: 'Day 3 — Eating Habits', description: 'Now let\'s dig into your current eating patterns.',
        questions: [
          q('textarea', 'Walk me through everything you ate yesterday (breakfast, lunch, dinner, snacks, drinks)'),
          q('scale',    'How healthy do you think your current diet is? (1–10)'),
          q('textarea', 'What time do you usually eat your first meal? Your last?'),
          q('choice',   'Do you tend to skip meals?', true, ['Never', 'Sometimes', 'Often']),
          q('textarea', 'What does stress or emotional eating look like for you?', false),
          q('choice',   'How much alcohol do you drink per week?', false, ['None', '1–3 drinks', '4–7 drinks', '7+ drinks']),
        ]},
      { step_number: 3, day_offset: 7, title: 'Day 7 — Lifestyle & Training', description: 'One week in — let\'s understand your lifestyle.',
        questions: [
          q('choice',   'What is your job like physically?', true, ['Desk job / sedentary', 'On my feet most of the day', 'Manual/physical work']),
          q('number',   'How many days per week do you currently exercise?'),
          q('textarea', 'What types of exercise do you do? How long are your sessions?'),
          q('scale',    'How is your sleep quality? (1–10)'),
          q('number',   'Average hours of sleep per night'),
          q('scale',    'How stressed are you in daily life? (1 = very stressed, 10 = very calm)'),
          q('textarea', 'How has the first week felt? Any questions or concerns?'),
        ]},
      { step_number: 4, day_offset: 14, title: 'Day 14 — Two-Week Check', description: 'Two weeks in — we should have a solid foundation now.',
        questions: [
          q('scale',    'How comfortable do you feel with the plan so far? (1–10)'),
          q('textarea', 'What\'s been the easiest part so far?'),
          q('textarea', 'What\'s been the hardest part?'),
          q('yesno',    'Is there anything about the plan you\'d like to adjust?'),
          q('textarea', 'Anything else you want me to know about you that we haven\'t covered?', false),
        ]},
    ],
  },

  'post_consultation': {
    name: 'Post-Consultation Follow-up',
    description: 'A 3-step follow-up after a coaching session — check in at 24h, 3 days and 7 days to ensure changes stick.',
    type: 'onboarding',
    total_steps: 3,
    core_questions: [],
    steps: [
      { step_number: 1, day_offset: 1, title: 'Day 1 — First Impressions', description: 'Just 24 hours since our session — quick check-in.',
        questions: [
          q('scale',    'How are you feeling about what we discussed? (1 = overwhelmed, 10 = motivated)'),
          q('textarea', 'What\'s the first change you\'re going to make?'),
          q('textarea', 'Is there anything from our session you\'d like me to clarify?', false),
        ]},
      { step_number: 2, day_offset: 3, title: 'Day 3 — Early Changes', description: 'Three days after your session.',
        questions: [
          q('yesno',    'Have you been able to start implementing the changes we discussed?'),
          q('textarea', 'What have you changed or started doing differently?'),
          q('scale',    'How confident are you feeling about sticking to the plan? (1–10)'),
          q('textarea', 'Any challenges or obstacles that have come up?', false),
        ]},
      { step_number: 3, day_offset: 7, title: 'Day 7 — One Week On', description: 'One full week since your session.',
        questions: [
          q('scale',    'How consistently have you followed the plan this week? (1–10)'),
          q('textarea', 'What\'s working well?'),
          q('textarea', 'What\'s still feeling hard?'),
          q('yesno',    'Do you feel ready to continue with this approach?'),
          q('textarea', 'Anything you\'d like to adjust or discuss in our next session?', false),
        ]},
    ],
  },

  'holiday_eating': {
    name: 'Pre/Post Holiday Eating Plan',
    description: 'A 4-step flow around a holiday or event — prepare beforehand and reset cleanly afterwards.',
    type: 'onboarding',
    total_steps: 4,
    core_questions: [],
    steps: [
      { step_number: 1, day_offset: 0, title: 'Pre-Holiday Prep (1 Week Before)', description: 'Let\'s set you up for success before the holiday.',
        questions: [
          q('text',     'What holiday or event is coming up?'),
          q('textarea', 'What are your biggest concerns about eating during this time?'),
          q('textarea', 'What will be hardest to navigate — alcohol, social pressure, food availability, restaurant meals?'),
          q('textarea', 'What\'s your personal strategy or intention going into this?'),
          q('yesno',    'Would you like to give yourself full permission to enjoy without guilt, and just reset after?'),
        ]},
      { step_number: 2, day_offset: 7, title: 'During Holiday Check-in', description: 'Mid-holiday check-in — no judgement, just honest data.',
        questions: [
          q('scale',    'How mindful have you been about food choices? (1–10)'),
          q('yesno',    'Have you been able to stay active at all?'),
          q('textarea', 'How has eating been different from your normal routine?'),
          q('scale',    'How are you feeling physically? (1–10)'),
        ]},
      { step_number: 3, day_offset: 14, title: 'Post-Holiday Reset', description: 'You\'re back — let\'s reset without drama.',
        questions: [
          q('number',   'Current weight this morning (kg or lbs)'),
          q('scale',    'How do you feel physically right now? (1–10)'),
          q('textarea', 'How would you describe how you ate over the holiday?'),
          q('yesno',    'Do you feel like you need a strict reset week, or just returning to normal is enough?'),
          q('textarea', 'What worked well about your holiday eating strategy?'),
        ]},
      { step_number: 4, day_offset: 21, title: 'Back on Track', description: 'One week back from holiday — are we back to normal?',
        questions: [
          q('number',   'Current weight this morning'),
          q('scale',    'How back on track are you feeling? (1–10)'),
          q('yesno',    'Have your eating habits returned to normal?'),
          q('textarea', 'Anything from this experience you want to approach differently next time?', false),
        ]},
    ],
  },

  'quarterly_review': {
    name: 'Goal Reset + Quarterly Review',
    description: 'A 4-step quarterly review to reset goals, reassess progress and plan the next phase.',
    type: 'onboarding',
    total_steps: 4,
    core_questions: [
      q('number', 'Current weight (kg or lbs)'),
      q('scale',  'Overall wellbeing this month (1–10)'),
      q('scale',  'Nutrition consistency this month (1–10)'),
    ],
    steps: [
      { step_number: 1, day_offset: 0, title: 'Quarter Start — Set Intentions', description: 'Let\'s begin the quarter with clear goals and honest reflection.',
        questions: [
          q('textarea', 'What are your top 3 goals for this quarter?'),
          q('textarea', 'What did you learn from last quarter that you want to apply?'),
          q('textarea', 'What might get in the way this quarter — upcoming events, travel, stress?'),
          q('choice',   'What\'s your primary focus this quarter?', true, ['Fat loss', 'Muscle gain', 'Maintenance', 'Performance', 'Building habits']),
        ]},
      { step_number: 2, day_offset: 30, title: 'Month 1 Check', description: '',
        questions: [
          q('scale',    'How on track are you with your quarterly goals? (1–10)'),
          q('textarea', 'What\'s going well?'),
          q('textarea', 'What needs adjusting?'),
        ]},
      { step_number: 3, day_offset: 60, title: 'Month 2 Check', description: '',
        questions: [
          q('scale',    'How on track are you with your quarterly goals? (1–10)'),
          q('textarea', 'Any major changes to your routine or life situation?'),
          q('textarea', 'What would make the final month of this quarter your best yet?'),
        ]},
      { step_number: 4, day_offset: 90, title: 'Quarter Complete — Full Review', description: 'End of quarter — let\'s review, celebrate and plan what\'s next.',
        questions: [
          q('textarea', 'Did you achieve your quarterly goals? What happened?'),
          q('scale',    'How satisfied are you with this quarter\'s progress? (1–10)'),
          q('textarea', 'What\'s your single biggest achievement this quarter?'),
          q('textarea', 'What do you want to focus on next quarter?'),
          q('yesno',    'Would you like to continue coaching into the next quarter?'),
        ]},
    ],
  },
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { preset } = await req.json()
  const p = PRESETS[preset]
  if (!p) return Response.json({ error: 'Unknown preset' }, { status: 400 })

  const supabase = await createClient()

  const { data: template, error } = await supabase
    .from('autoflow_templates')
    .insert({
      coach_id: coachId,
      name: p.name,
      description: p.description,
      type: p.type,
      total_steps: p.total_steps,
      core_questions: p.core_questions,
    })
    .select('id')
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  await supabase.from('autoflow_template_steps').insert(
    p.steps.map(s => ({ template_id: template.id, ...s }))
  )

  return Response.json({ id: template.id })
}
