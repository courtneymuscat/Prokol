import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

// Map JotForm question types to our types
function mapType(jotType: string): 'text' | 'textarea' | 'radio' | 'checkbox' | 'dropdown' | 'number' {
  switch (jotType) {
    case 'control_textarea':
    case 'control_address':
      return 'textarea'
    case 'control_radio':
    case 'control_rating':
    case 'control_scale':
      return 'radio'
    case 'control_dropdown':
      return 'dropdown'
    case 'control_checkbox':
      return 'checkbox'
    case 'control_number':
    case 'control_spinner':
      return 'number'
    default:
      return 'text'
  }
}

// Extract options from a JotForm question
function getOptions(q: Record<string, unknown>): string[] | null {
  // JotForm uses "none" as a string sentinel when a field doesn't apply.
  // Only treat `special` as an options object if it really is a plain object.
  const special = q.special
  if (special && typeof special === 'object' && !Array.isArray(special)) {
    const opts = Object.values(special as Record<string, unknown>)
      .filter((v): v is string => typeof v === 'string' && !!(v as string).trim())
    if (opts.length) return opts
  }
  const options = q.options as string | undefined
  if (options && options !== 'none') {
    const opts = options.split('|').map((o) => o.trim()).filter(Boolean)
    if (opts.length) return opts
  }
  return null
}

export async function POST(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const { jotformApiKey, jotformFormId } = await req.json()
  if (!jotformApiKey || !jotformFormId) {
    return Response.json({ error: 'API key and form ID are required' }, { status: 400 })
  }

  // Fetch form details from JotForm
  const [formRes, questionsRes] = await Promise.all([
    fetch(`https://api.jotform.com/form/${jotformFormId}?apiKey=${jotformApiKey}`),
    fetch(`https://api.jotform.com/form/${jotformFormId}/questions?apiKey=${jotformApiKey}`),
  ])

  if (!formRes.ok || !questionsRes.ok) {
    return Response.json({ error: 'Could not fetch form from JotForm — check your API key and form ID' }, { status: 400 })
  }

  const formData = await formRes.json()
  const questionsData = await questionsRes.json()

  if (formData.responseCode !== 200 || questionsData.responseCode !== 200) {
    return Response.json({ error: formData.message ?? 'JotForm API error' }, { status: 400 })
  }

  const formTitle = formData.content?.title ?? 'Imported Form'

  // Sort questions by order
  const rawQuestions = Object.values(questionsData.content as Record<string, Record<string, unknown>>)
  const sorted = rawQuestions
    .filter((q) => q.type !== 'control_head' && q.type !== 'control_button' && q.type !== 'control_pagebreak')
    .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))

  const supabase = await createClient()

  // Create the form
  const { data: form, error: formErr } = await supabase
    .from('forms')
    .insert({ coach_id: coachId, title: formTitle, type: 'custom' })
    .select('id')
    .single()

  if (formErr || !form) {
    return Response.json({ error: formErr?.message ?? 'Failed to create form' }, { status: 500 })
  }

  // Insert questions
  const questions = sorted.map((q, i) => {
    const type = mapType(q.type as string)
    const options = ['radio', 'checkbox', 'dropdown'].includes(type) ? getOptions(q) : null
    const label = (q.text as string) || (q.name as string) || 'Question'
    const sublabel = (q.sublabel as string | undefined)?.replace(/<[^>]+>/g, '').trim() || null
    return {
      form_id: form.id,
      order_index: i,
      label: label.replace(/<[^>]+>/g, '').trim(),
      description: sublabel,
      type,
      options,
      required: q.required === 'Yes',
    }
  })

  if (questions.length > 0) {
    const { error: qErr } = await supabase.from('form_questions').insert(questions)
    if (qErr) return Response.json({ error: qErr.message }, { status: 500 })
  }

  return Response.json({ id: form.id, title: formTitle, questionCount: questions.length })
}
