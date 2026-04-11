import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ templateId: string }> }

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { templateId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()

  // Fetch the original template (verify ownership)
  const [{ data: template }, { data: steps }] = await Promise.all([
    supabase
      .from('autoflow_templates')
      .select('name, description, type, total_steps, core_questions')
      .eq('id', templateId)
      .eq('coach_id', coachId)
      .single(),
    supabase
      .from('autoflow_template_steps')
      .select('step_number, title, description, questions, day_offset, trigger_type, trigger_step_number, resource_ids, form_id, form_save_to_file, tasks')
      .eq('template_id', templateId)
      .order('step_number'),
  ])

  if (!template) return Response.json({ error: 'Not found' }, { status: 404 })

  // Insert the copy
  const { data: newTemplate, error } = await supabase
    .from('autoflow_templates')
    .insert({
      coach_id: coachId,
      name: `${template.name} (copy)`,
      description: template.description ?? null,
      type: template.type,
      total_steps: template.total_steps,
      core_questions: template.core_questions ?? [],
    })
    .select('id')
    .single()

  if (error || !newTemplate) return Response.json({ error: error?.message ?? 'Failed to duplicate' }, { status: 500 })

  // Copy all steps
  if (steps && steps.length > 0) {
    const stepRows = steps.map(s => ({
      template_id: newTemplate.id,
      step_number: s.step_number,
      title: s.title ?? '',
      description: s.description ?? null,
      questions: s.questions ?? [],
      day_offset: s.day_offset ?? 0,
      trigger_type: (s as Record<string, unknown>).trigger_type ?? 'day_offset',
      trigger_step_number: (s as Record<string, unknown>).trigger_step_number ?? null,
      resource_ids: s.resource_ids ?? [],
      form_id: s.form_id ?? null,
      form_save_to_file: (s as Record<string, unknown>).form_save_to_file ?? false,
      tasks: s.tasks ?? [],
    }))
    await supabase.from('autoflow_template_steps').insert(stepRows)
  }

  return Response.json({ id: newTemplate.id })
}
