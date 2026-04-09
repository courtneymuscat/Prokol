import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data } = await supabase
    .from('autoflow_templates')
    .select('id, name, description, type, total_steps, created_at')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false })

  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description, type, total_steps } = await req.json()
  if (!name) return Response.json({ error: 'Name required' }, { status: 400 })

  const supabase = await createClient()
  const steps = parseInt(total_steps) || (type === 'onboarding' ? 4 : 12)

  const { data: template, error } = await supabase
    .from('autoflow_templates')
    .insert({ coach_id: coachId, name, description: description ?? null, type: type ?? 'weekly_checkin', total_steps: steps })
    .select('id')
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Create empty steps with sensible defaults
  const defaultOffsets = type === 'onboarding' ? [0, 3, 7, 14] : null
  const stepRows = Array.from({ length: steps }, (_, i) => ({
    template_id: template.id,
    step_number: i + 1,
    title: type === 'onboarding'
      ? `Day ${defaultOffsets ? defaultOffsets[i] ?? (i + 1) * 7 : (i + 1) * 7}`
      : `Week ${i + 1}`,
    questions: [],
    day_offset: defaultOffsets ? (defaultOffsets[i] ?? (i + 1) * 7) : i * 7,
  }))
  await supabase.from('autoflow_template_steps').insert(stepRows)

  return Response.json({ id: template.id })
}
