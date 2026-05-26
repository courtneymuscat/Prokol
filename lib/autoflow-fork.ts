import type { SupabaseClient } from '@supabase/supabase-js'

// ensureClientOnlyTemplate
//
// Used by per-client autoflow editors (FlowsTab) before any STRUCTURAL
// change (add / duplicate / delete step). If the client's flow currently
// points at a shared template (the normal case), we clone the template
// into a private one — owned by the coach but flagged is_client_only =
// true so it doesn't appear in the main autoflows library. The client's
// client_autoflows row is repointed at the clone. After this, structural
// edits land on the clone only.
//
// Returns the resolved template_id (existing one if already private,
// otherwise the new clone's id). Idempotent — calling it twice on the
// same flow is a no-op the second time.
export async function ensureClientOnlyTemplate(
  admin: SupabaseClient,
  opts: { coachId: string; clientId: string; flowId: string },
): Promise<{ template_id: string; was_forked: boolean } | { error: string }> {
  const { coachId, clientId, flowId } = opts

  // Pull the flow + parent template metadata in one trip.
  const { data: flow } = await admin
    .from('client_autoflows')
    .select('id, template_id, autoflow_templates(name, description, type, core_questions, is_client_only)')
    .eq('id', flowId)
    .eq('coach_id', coachId)
    .single()
  if (!flow) return { error: 'Flow not found' }

  const tpl = flow.autoflow_templates as {
    name?: string
    description?: string | null
    type?: string
    core_questions?: unknown[]
    is_client_only?: boolean
  } | null

  // Already private — nothing to do.
  if (tpl?.is_client_only) {
    return { template_id: flow.template_id as string, was_forked: false }
  }

  // Resolve the client's first name (or fallback) so the clone's name
  // is recognisable in the rare case someone ends up looking at the row
  // directly in the DB.
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, first_name')
    .eq('id', clientId)
    .maybeSingle()
  const clientLabel =
    (profile?.first_name as string | undefined)?.trim() ||
    (profile?.full_name as string | undefined)?.trim()?.split(' ')[0] ||
    'client'

  // Clone the template row.
  const { data: cloneRow, error: cloneErr } = await admin
    .from('autoflow_templates')
    .insert({
      coach_id: coachId,
      name: `${tpl?.name ?? 'Autoflow'} – ${clientLabel} (custom)`,
      description: tpl?.description ?? null,
      type: tpl?.type ?? 'weekly_checkin',
      core_questions: tpl?.core_questions ?? [],
      is_client_only: true,
      forked_from_template_id: flow.template_id,
      forked_for_client_id: clientId,
    })
    .select('id')
    .single()
  if (cloneErr || !cloneRow) {
    return { error: cloneErr?.message ?? 'Failed to fork template' }
  }
  const newTemplateId = cloneRow.id as string

  // Copy every step into the new template. Carry over step_numbers
  // verbatim so existing client_autoflow_step_overrides (keyed by
  // client_autoflow_id + step_number) keep pointing at the right step.
  const { data: steps } = await admin
    .from('autoflow_template_steps')
    .select('step_number, title, description, questions, day_offset, trigger_type, trigger_step_number, resource_ids, form_id, form_save_to_file, tasks, automated_message')
    .eq('template_id', flow.template_id)
    .order('step_number')
  if (steps && steps.length > 0) {
    type StepRow = Record<string, unknown> & {
      step_number: number
      title: string | null
      description: string | null
      questions: unknown
      day_offset: number | null
      resource_ids: unknown
      form_id: string | null
      tasks: unknown
    }
    const stepRows = (steps as StepRow[]).map((s) => ({
      template_id: newTemplateId,
      step_number: s.step_number,
      title: s.title ?? '',
      description: s.description ?? null,
      questions: s.questions ?? [],
      day_offset: s.day_offset ?? 0,
      trigger_type: s.trigger_type ?? 'day_offset',
      trigger_step_number: s.trigger_step_number ?? null,
      resource_ids: s.resource_ids ?? [],
      form_id: s.form_id ?? null,
      form_save_to_file: s.form_save_to_file ?? false,
      tasks: s.tasks ?? [],
      automated_message: s.automated_message ?? null,
    }))
    await admin.from('autoflow_template_steps').insert(stepRows)
  }

  // Update total_steps on the clone for parity with the original.
  await admin
    .from('autoflow_templates')
    .update({ total_steps: steps?.length ?? 0 })
    .eq('id', newTemplateId)

  // Repoint the client_autoflows row at the clone. All existing
  // overrides / responses / calendar events stay valid because they're
  // keyed by client_autoflow_id + step_number, not template_id.
  await admin
    .from('client_autoflows')
    .update({ template_id: newTemplateId })
    .eq('id', flowId)

  return { template_id: newTemplateId, was_forked: true }
}
