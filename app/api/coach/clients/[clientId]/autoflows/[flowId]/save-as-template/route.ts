import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import { effectiveQuestions } from '@/lib/autoflow-fork'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ clientId: string; flowId: string }> }

// POST /api/coach/clients/[clientId]/autoflows/[flowId]/save-as-template
//
// Snapshots a single client's autoflow — template + their client-specific
// step overrides + any flow-level core_questions override — into a brand
// new autoflow_templates row owned by the coach. The original template,
// existing assignments, responses and overrides are all untouched.
//
// Useful when the coach has tuned an autoflow for one client and wants to
// promote that tuned version into their library to assign to other
// clients later.
export async function POST(_req: NextRequest, { params }: Ctx) {
  const { flowId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = await createClient()

  // Verify the coach owns this client_autoflow, and pull the parent
  // template + this flow's core_questions override (if any).
  const { data: flow } = await supabase
    .from('client_autoflows')
    .select('id, name, template_id, core_questions, autoflow_templates(name, description, type, core_questions)')
    .eq('id', flowId)
    .eq('coach_id', coachId)
    .single()
  if (!flow) return Response.json({ error: 'Not found' }, { status: 404 })

  const tpl = flow.autoflow_templates as { name?: string; description?: string | null; type?: string; core_questions?: unknown[] } | null
  if (!tpl) return Response.json({ error: 'Template missing' }, { status: 500 })

  // Effective core questions: client-level override wins over template
  // default. Matches the rule in GET /api/coach/clients/.../autoflows/[id].
  const flowCore = (flow as { core_questions?: unknown[] }).core_questions
  const effectiveCoreQuestions = Array.isArray(flowCore) ? flowCore : (tpl.core_questions ?? [])

  // Pull the template's base steps + this client's per-step overrides in
  // parallel, then overlay overrides on top so the saved template
  // captures exactly what the client sees.
  const [{ data: baseSteps }, { data: overrides }] = await Promise.all([
    supabase
      .from('autoflow_template_steps')
      .select('step_number, title, description, questions, day_offset, trigger_type, trigger_step_number, resource_ids, form_id, form_save_to_file, tasks, automated_message')
      .eq('template_id', flow.template_id)
      .order('step_number'),
    supabase
      .from('client_autoflow_step_overrides')
      .select('step_number, title, description, questions')
      .eq('client_autoflow_id', flowId),
  ])

  const overrideMap = new Map<number, { title?: string | null; description?: string | null; questions?: unknown }>()
  for (const o of overrides ?? []) {
    overrideMap.set(o.step_number as number, o)
  }

  // Create the new template owned by the coach
  const { data: newTemplate, error: insertErr } = await supabase
    .from('autoflow_templates')
    .insert({
      coach_id: coachId,
      name: `${tpl.name ?? flow.name ?? 'Autoflow'} (from client)`,
      description: tpl.description ?? null,
      type: tpl.type ?? 'weekly_checkin',
      total_steps: baseSteps?.length ?? 0,
      core_questions: effectiveCoreQuestions,
    })
    .select('id')
    .single()
  if (insertErr || !newTemplate) {
    return Response.json({ error: insertErr?.message ?? 'Failed to create template' }, { status: 500 })
  }

  // Copy the effective steps (base ⊕ override) into the new template
  if (baseSteps && baseSteps.length > 0) {
    const stepRows = baseSteps.map((s) => {
      const ov = overrideMap.get(s.step_number as number)
      return {
        template_id: newTemplate.id,
        step_number: s.step_number,
        title: ov?.title ?? s.title ?? '',
        description: ov?.description ?? s.description ?? null,
        questions: effectiveQuestions(ov?.questions, s.questions),
        day_offset: s.day_offset ?? 0,
        trigger_type: (s as Record<string, unknown>).trigger_type ?? 'day_offset',
        trigger_step_number: (s as Record<string, unknown>).trigger_step_number ?? null,
        resource_ids: s.resource_ids ?? [],
        form_id: s.form_id ?? null,
        form_save_to_file: (s as Record<string, unknown>).form_save_to_file ?? false,
        tasks: s.tasks ?? [],
        automated_message: (s as Record<string, unknown>).automated_message ?? null,
      }
    })
    await supabase.from('autoflow_template_steps').insert(stepRows)
  }

  return Response.json({ id: newTemplate.id })
}
