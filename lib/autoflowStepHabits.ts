import type { SupabaseClient } from '@supabase/supabase-js'

type StepHabit = { name: string; icon: string; unit: string; target: number } | null

// Keeps a client's REAL, trackable habits in sync with which autoflow
// steps currently have a habit attached and are due. Called from
// everywhere "is this step due" gets (re)computed (the due-steps poll,
// and immediately on step submission) so a step's habit shows up the
// moment the step becomes available and disappears (deactivates, keeps
// log history) the moment the step is completed, superseded, or its
// habit is simply removed from the step while still due.
//
// `stepsWithHabit` should already have the per-client path resolved
// (see lib/autoflowPaths.ts) — this function only deals in the final,
// resolved habit definition, not the raw per-path authoring shape.
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

  const { data: instances } = await admin
    .from('autoflow_step_habit_instances')
    .select('step_number, habit_id')
    .eq('client_autoflow_id', clientAutoflowId)
  const instanceByStep = new Map<number, string>(
    (instances ?? []).map((i) => [i.step_number as number, i.habit_id as string]),
  )
  const habitByStep = new Map<number, StepHabit>(stepsWithHabit.map((s) => [s.step_number, s.habit]))

  // Every step that either currently has an instance, or currently
  // resolves to a habit — covers brand new, definition changed (e.g. a
  // path switch), habit removed entirely, and step no longer due.
  const relevantSteps = new Set<number>([
    ...instanceByStep.keys(),
    ...stepsWithHabit.filter((s) => s.habit).map((s) => s.step_number),
  ])

  for (const stepNumber of relevantSteps) {
    const habit = habitByStep.get(stepNumber) ?? null
    const shouldBeActive = dueStepNumbers.has(stepNumber) && !!habit
    const existingHabitId = instanceByStep.get(stepNumber)

    if (shouldBeActive && habit) {
      if (!existingHabitId) {
        const { data: habitRow, error } = await admin
          .from('habits')
          .insert({
            coach_id: coachId,
            client_id: clientId,
            name: habit.name,
            type: 'daily',
            target: habit.target,
            unit: habit.unit,
            icon: habit.icon,
            active: true,
          })
          .select('id')
          .single()
        if (!error && habitRow) {
          await admin
            .from('autoflow_step_habit_instances')
            .insert({ client_autoflow_id: clientAutoflowId, step_number: stepNumber, habit_id: habitRow.id })
        }
      } else {
        // Already exists — keep it current (and reactivated) in case the
        // resolved definition changed since it was created, e.g. the
        // client switched path and now a different variant applies.
        await admin
          .from('habits')
          .update({ name: habit.name, target: habit.target, unit: habit.unit, icon: habit.icon, active: true })
          .eq('id', existingHabitId)
      }
    } else if (existingHabitId) {
      // Deactivate (never delete — keeps habit_logs history) rather than
      // creating/removing rows every time a step's due-state flickers.
      await admin.from('habits').update({ active: false }).eq('id', existingHabitId)
    }
  }
}
