import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportSeatUsage } from '@/lib/billing'

/**
 * Accept a coach invite by token.
 * Called after a user signs up or logs in with an invite token.
 * Safe to call multiple times — does nothing if already accepted.
 */
export async function acceptInvite(token: string, clientId: string): Promise<void> {
  // Use admin client for invite lookup — RLS blocks the signing-up user from reading coach_invites
  const admin = createAdminClient()

  // Select core columns first — form_id column may not exist yet if migration hasn't run
  const { data: invite } = await admin
    .from('coach_invites')
    .select('id, coach_id, status, expires_at, service_id')
    .eq('token', token)
    .single()

  if (!invite) return
  // Revoked invites are completely invalid
  if (invite.status === 'revoked') return
  // Expired invites that were never accepted are invalid
  if (new Date(invite.expires_at) < new Date() && invite.status !== 'accepted') return

  // Try to get optional columns separately (may not exist yet if migration hasn't run)
  let formId: string | null = null
  let formSaveToFile = false
  let autoflowId: string | null = null
  try {
    const { data: fi } = await admin
      .from('coach_invites')
      .select('form_id, form_save_to_file, autoflow_id')
      .eq('token', token)
      .single()
    formId = (fi as { form_id?: string | null })?.form_id ?? null
    formSaveToFile = (fi as { form_save_to_file?: boolean })?.form_save_to_file ?? false
    autoflowId = (fi as { autoflow_id?: string | null })?.autoflow_id ?? null
  } catch { /* columns don't exist yet */ }

  // Always ensure coach_clients has an 'active' row for this pair and the
  // profile is marked coached — safe to run multiple times.
  //
  // We deliberately UPDATE first then INSERT-if-missing rather than upserting,
  // because the previous upsert relied on a unique constraint on
  // (coach_id, client_id) that may not exist in every environment. Without
  // that constraint, an upsert silently inserts a duplicate row alongside
  // the original 'pending_invite' row — the coach then sees the client twice
  // (once as Pending, once as Active). Explicit update-then-insert is
  // deterministic and doesn't depend on a particular constraint shape.
  const updatePatch: Record<string, unknown> = {
    accepted_at: new Date().toISOString(),
    status: 'active',
    service_id: invite.service_id ?? null,
  }
  if (formId !== null) updatePatch.form_id = formId

  const { data: updatedRows, error: updateError } = await admin
    .from('coach_clients')
    .update(updatePatch)
    .eq('coach_id', invite.coach_id)
    .eq('client_id', clientId)
    .select('id')

  if (updateError) {
    console.error('acceptInvite: coach_clients update error:', updateError.message)
  }

  if (!updatedRows || updatedRows.length === 0) {
    const insertRow: Record<string, unknown> = {
      coach_id: invite.coach_id,
      client_id: clientId,
      accepted_at: new Date().toISOString(),
      status: 'active',
      service_id: invite.service_id ?? null,
    }
    if (formId !== null) insertRow.form_id = formId
    const { error: insertError } = await admin.from('coach_clients').insert(insertRow)
    if (insertError) {
      console.error('acceptInvite: coach_clients insert error:', insertError.message)
    }
  }

  // Belt-and-braces cleanup: if any duplicate 'pending_invite' rows exist for
  // this pair (from past upsert misses), remove them so the coach view shows
  // a single active client instead of one pending + one active.
  await admin
    .from('coach_clients')
    .delete()
    .eq('coach_id', invite.coach_id)
    .eq('client_id', clientId)
    .eq('status', 'pending_invite')
  await admin.from('profiles').update({
    subscription_tier: 'coached',
    onboarding_completed: true,
  }).eq('id', clientId)

  // Report seat usage for overage billing (non-blocking)
  reportSeatUsage(invite.coach_id).catch((err) =>
    console.error('reportSeatUsage error:', err instanceof Error ? err.message : String(err))
  )

  // One-time actions — only run on the first acceptance
  if (invite.status !== 'pending') return

  // Auto-assign autoflow if one was specified in the invite
  if (autoflowId) {
    try {
      const { data: tpl } = await admin
        .from('autoflow_templates')
        .select('id, name, total_steps')
        .eq('id', autoflowId)
        .single()

      if (tpl) {
        const startDate = new Date().toISOString().split('T')[0]
        const { data: flow } = await admin
          .from('client_autoflows')
          .insert({
            coach_id: invite.coach_id,
            client_id: clientId,
            template_id: autoflowId,
            name: tpl.name,
            start_date: startDate,
            status: 'active',
          })
          .select('id')
          .single()

        if (flow) {
          const { data: steps } = await admin
            .from('autoflow_template_steps')
            .select('step_number, title, day_offset, trigger_type')
            .eq('template_id', autoflowId)
            .order('step_number')

          if (steps && steps.length > 0) {
            const [y, m, d] = startDate.split('-').map(Number)
            const events = steps
              .filter((s) => (s as Record<string, unknown>).trigger_type !== 'on_step_complete')
              .map((s) => ({
                coach_id: invite.coach_id,
                client_id: clientId,
                event_date: new Date(Date.UTC(y, m - 1, d + s.day_offset)).toISOString().split('T')[0],
                type: 'autoflow',
                title: `${tpl.name} — Step ${s.step_number}${s.title ? `: ${s.title}` : ''}`,
                content: { flow_id: flow.id, step_number: s.step_number, link: `/autoflows/${flow.id}/${s.step_number}` },
              }))
            if (events.length > 0) await admin.from('calendar_events').insert(events)
          }
        }
      }
    } catch { /* autoflow assignment is non-critical */ }
  }

  await admin.from('coach_invites').update({ status: 'accepted' }).eq('id', invite.id)
}

/**
 * Verify the current request is from a coach and return their user id.
 * Returns null if the user is not authenticated or not a coach.
 */
export async function requireCoach(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', session.user.id)
    .single()

  if (profile?.user_type !== 'coach' && profile?.user_type !== 'business') return null
  return session.user.id
}
