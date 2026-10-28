import type { SupabaseClient } from '@supabase/supabase-js'

type StepHabit = { name: string; icon: string; unit: string; target: number } | null

// Keeps a client's REAL, trackable habits in sync with which autoflow
// steps currently have a habit attached and are due. Called from
// everywhere "is this step due" gets (re)computed (the due-steps poll,
// and immediately on step submission) so a step's habit shows up the
// moment the step becomes available and disappears (deactivates, keeps
// log history) the moment the step is completed or superseded.
//
// Must be called with an ADMIN client — writing to `habits` on a
// client's behalf isn't something the client's own session is allowed
// to do under RLS (only the coach can insert/update habits rows).
export async function syncAutoflowStepHabits(
  admin: SupabaseClient,
  params: {
    clientAutoflowId: string
    clientId: string
    coachId: string
    dueStepNumbers: Set<number>
    stepsWithHabit: Array<{ step_number: number; habit: StepHabit }>
  },
) {
  const { clientAutoflowId, clientId, coachId, dueStepNumbers, stepsWithHabit } = params
  const relevant = stepsWithHabit.filter((s) => s.habit)
  if (relevant.length === 0) return

  const { data: instances } = await admin
    .from('autoflow_step_habit_instances')
    .select('step_number, habit_id')
    .eq('client_autoflow_id', clientAutoflowId)
  const instanceByStep = new Map<number, string>(
    (instances ?? []).map((i) => [i.step_number as number, i.habit_id as string]),
  )

  // Create a real habit for any newly-due step that doesn't have one yet.
  for (const step of relevant) {
    if (!dueStepNumbers.has(step.step_number)) continue
    if (instanceByStep.has(step.step_number)) continue
    const h = step.habit!
    const { data: habitRow, error } = await admin
      .from('habits')
      .insert({
        coach_id: coachId,
        client_id: clientId,
        name: h.name,
        type: 'daily',
        target: h.target,
        unit: h.unit,
        icon: h.icon,
        active: true,
      })
      .select('id')
      .single()
    if (!error && habitRow) {
      await admin
        .from('autoflow_step_habit_instances')
        .insert({ client_autoflow_id: clientAutoflowId, step_number: step.step_number, habit_id: habitRow.id })
    }
  }

  // Deactivate (never delete — keeps habit_logs history) any instance
  // whose step is no longer due.
  const toDeactivate = [...instanceByStep.entries()]
    .filter(([stepNumber]) => !dueStepNumbers.has(stepNumber))
    .map(([, habitId]) => habitId)
  if (toDeactivate.length > 0) {
    await admin.from('habits').update({ active: false }).in('id', toDeactivate)
  }
}
