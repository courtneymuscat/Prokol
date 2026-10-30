import type { SupabaseClient } from '@supabase/supabase-js'

type ProgramLink = { program_id: string } | null

// Auto-assigns a real training program to a client the first time a step
// with a program_link becomes due — the same "fork the template's content
// into a real per-client row" that manual assignment already does
// (app/api/coach/clients/[clientId]/programs/route.ts), just triggered by
// the autoflow reaching that step instead of a coach clicking a button.
// start_date is today — the real date this fired for this specific
// client, not the template's day_offset.
//
// Unlike syncAutoflowStepHabits, there's no deactivation path: once a
// program starts, it runs its own course, same as a manually-assigned one
// would — the autoflow step completing/expiring doesn't end it. Tracked
// via autoflow_step_program_instances purely so it only happens once.
//
// Must be called with an ADMIN client — inserting into client_programs
// on a client's behalf isn't something their own session can do under RLS.
export async function syncAutoflowStepPrograms(
  admin: SupabaseClient,
  params: {
    clientAutoflowId: string
    clientId: string
    coachId: string
    dueStepNumbers: Set<number>
    stepsWithProgramLink: Array<{ step_number: number; program_link: ProgramLink }>
  },
) {
  const { clientAutoflowId, clientId, coachId, dueStepNumbers, stepsWithProgramLink } = params

  const toStart = stepsWithProgramLink.filter(
    (s) => s.program_link && dueStepNumbers.has(s.step_number),
  )
  if (toStart.length === 0) return

  const { data: existingInstances } = await admin
    .from('autoflow_step_program_instances')
    .select('step_number')
    .eq('client_autoflow_id', clientAutoflowId)
  const alreadyStarted = new Set((existingInstances ?? []).map((i) => i.step_number as number))

  const today = new Date()
  const startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  for (const step of toStart) {
    if (alreadyStarted.has(step.step_number)) continue
    const programId = step.program_link!.program_id

    const { data: template } = await admin
      .from('programs')
      .select('id, name, content')
      .eq('id', programId)
      .maybeSingle()
    if (!template) continue // program template deleted/missing — nothing to assign

    const { data: clientProgram, error } = await admin
      .from('client_programs')
      .insert({
        program_id: template.id,
        client_id: clientId,
        coach_id: coachId,
        name: template.name,
        content: template.content,
        start_date: startDate,
        status: 'active',
      })
      .select('id')
      .single()
    if (error || !clientProgram) continue

    await admin
      .from('autoflow_step_program_instances')
      .insert({
        client_autoflow_id: clientAutoflowId,
        step_number: step.step_number,
        client_program_id: clientProgram.id,
      })
  }
}
