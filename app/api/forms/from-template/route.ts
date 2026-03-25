import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

type Question = {
  label: string
  type: 'text' | 'textarea' | 'select' | 'number' | 'radio'
  options?: string[]
  required: boolean
}

type Template = {
  title: string
  type: string
  questions: Question[]
}

const TEMPLATES: Record<string, Template> = {
  onboarding: {
    title: 'Client Onboarding & Health Assessment',
    type: 'onboarding',
    questions: [
      // Personal info
      { label: 'Date of birth', type: 'text', required: false },
      { label: 'Height (cm or ft/in)', type: 'text', required: false },
      { label: 'Current weight (kg or lbs)', type: 'number', required: false },
      { label: 'What is your occupation / how active is your job?', type: 'text', required: false },
      // Goals & motivation
      { label: 'What is your primary goal?', type: 'radio', options: ['Fat loss', 'Muscle gain', 'Improve performance', 'General health & fitness', 'Sport-specific training'], required: true },
      { label: 'What is your main motivation for starting now?', type: 'textarea', required: true },
      { label: 'What does success look like to you in 3 months?', type: 'textarea', required: true },
      // Health history
      { label: 'Do you have any diagnosed medical conditions?', type: 'textarea', required: false },
      { label: 'Are you currently taking any medications or supplements?', type: 'textarea', required: false },
      { label: 'Have you had any surgeries or serious injuries in the past?', type: 'textarea', required: false },
      { label: 'Do you have any injuries, pain, or physical limitations?', type: 'textarea', required: false },
      // Lifestyle
      { label: 'Do you smoke or use tobacco?', type: 'radio', options: ['No', 'Occasionally', 'Yes'], required: false },
      { label: 'How often do you consume alcohol?', type: 'radio', options: ['Never', 'Occasionally (< once a week)', '1–3 times per week', '4+ times per week'], required: false },
      { label: 'How many hours of sleep do you get on average?', type: 'number', required: false },
      { label: 'How would you rate your current stress levels?', type: 'radio', options: ['Low', 'Moderate', 'High', 'Very high'], required: false },
      // Training
      { label: 'How would you describe your current fitness level?', type: 'radio', options: ['Beginner (new to training)', 'Intermediate (training 1–2 years)', 'Advanced (training 3+ years)', 'Athlete / competitive'], required: true },
      { label: 'How many days per week can you train?', type: 'radio', options: ['1–2 days', '3–4 days', '5–6 days', 'Every day'], required: true },
      { label: 'What types of training do you enjoy or have access to?', type: 'textarea', required: false },
      // Nutrition
      { label: 'Do you have any dietary restrictions or food allergies?', type: 'textarea', required: false },
      { label: 'How would you describe your current diet?', type: 'radio', options: ['No structure / eating whatever', 'Tracking calories loosely', 'Tracking macros consistently', 'Following a specific diet plan'], required: false },
      { label: 'How many meals do you typically eat per day?', type: 'radio', options: ['1–2 meals', '3 meals', '4–5 meals', '6+ meals / always snacking'], required: false },
      { label: 'How much water do you drink daily (litres)?', type: 'number', required: false },
      // Coaching history
      { label: 'Have you worked with a coach before?', type: 'radio', options: ['No, this is my first time', 'Yes, briefly', 'Yes, for an extended period'], required: false },
      { label: "What did or didn't work in previous attempts?", type: 'textarea', required: false },
      // Catch-all
      { label: 'Is there anything else you would like me to know?', type: 'textarea', required: false },
    ],
  },

  weekly_checkin: {
    title: 'Weekly Check-In',
    type: 'weekly_checkin',
    questions: [
      { label: 'How would you rate this week overall?', type: 'radio', options: ['1 – Rough week', '2 – Below average', '3 – Average', '4 – Good week', '5 – Great week'], required: true },
      { label: 'Current body weight (kg or lbs)', type: 'number', required: false },
      { label: 'How was your nutrition this week?', type: 'radio', options: ['On track / hit my targets', 'Mostly on track with a few slip-ups', 'Struggled but tried', 'Off track'], required: true },
      { label: 'How many training sessions did you complete?', type: 'radio', options: ['0', '1', '2', '3', '4', '5', '6', '7+'], required: true },
      { label: 'How was your energy throughout the week?', type: 'radio', options: ['Low', 'Average', 'Good', 'High'], required: true },
      { label: 'How was your sleep?', type: 'radio', options: ['Poor (< 5 hrs)', 'Okay (5–6 hrs)', 'Good (6–7 hrs)', 'Great (7–8 hrs)', 'Excellent (8+ hrs)'], required: false },
      { label: 'How was your stress / recovery?', type: 'radio', options: ['Very stressed / poor recovery', 'Some stress / moderate recovery', 'Low stress / good recovery'], required: false },
      { label: 'Any injuries, soreness, or pain to flag?', type: 'textarea', required: false },
      { label: 'What went well this week?', type: 'textarea', required: false },
      { label: 'What did you struggle with?', type: 'textarea', required: false },
      { label: 'Anything you need help or support with this week?', type: 'textarea', required: false },
    ],
  },

  monthly_review: {
    title: 'Monthly Progress Review',
    type: 'custom',
    questions: [
      { label: 'Current body weight (kg or lbs)', type: 'number', required: false },
      { label: 'Waist measurement (cm)', type: 'number', required: false },
      { label: 'Hip measurement (cm)', type: 'number', required: false },
      { label: 'How do your clothes feel compared to last month?', type: 'radio', options: ['Looser', 'About the same', 'Tighter'], required: false },
      { label: 'How would you rate your progress this month?', type: 'radio', options: ['1 – No progress', '2 – Minimal progress', '3 – Some progress', '4 – Good progress', '5 – Great progress'], required: true },
      { label: 'Which area improved the most this month?', type: 'radio', options: ['Nutrition / diet', 'Training / fitness', 'Sleep & recovery', 'Energy & mood', 'Body composition'], required: false },
      { label: 'What was your biggest win this month?', type: 'textarea', required: false },
      { label: 'What was your biggest challenge this month?', type: 'textarea', required: false },
      { label: 'Are you happy with the direction things are heading?', type: 'radio', options: ['Yes, very happy', 'Getting there', 'Not really — want to discuss'], required: true },
      { label: 'Would you like to adjust your goals or program for next month?', type: 'textarea', required: false },
    ],
  },

}

export async function POST(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const { templateId } = await req.json()
  const template = TEMPLATES[templateId]
  if (!template) return Response.json({ error: 'Unknown template' }, { status: 400 })

  const supabase = await createClient()

  // Create the form
  const { data: form, error: formErr } = await supabase
    .from('forms')
    .insert({ coach_id: coachId, title: template.title, type: template.type })
    .select('id')
    .single()

  if (formErr || !form) return Response.json({ error: formErr?.message ?? 'Failed to create form' }, { status: 500 })

  // Insert all questions
  const questions = template.questions.map((q, i) => ({
    form_id: form.id,
    order_index: i,
    label: q.label,
    type: q.type,
    options: q.options ?? null,
    required: q.required,
  }))

  const { error: qErr } = await supabase.from('form_questions').insert(questions)
  if (qErr) return Response.json({ error: qErr.message }, { status: 500 })

  return Response.json({ id: form.id })
}
