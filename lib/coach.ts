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
  if (invite.status !== 'pending') return
  if (new Date(invite.expires_at) < new Date()) return

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

  // Link client to coach and switch them to coached tier
  const clientRow: Record<string, unknown> = {
    coach_id: invite.coach_id,
    client_id: clientId,
    accepted_at: new Date().toISOString(),
    status: 'active',
    service_id: invite.service_id ?? null,
  }
  if (formId !== null) clientRow.form_id = formId

  await admin.from('coach_clients').upsert(clientRow, { onConflict: 'coach_id,client_id' })
  await admin.from('profiles').update({ subscription_tier: 'coached' }).eq('id', clientId)

  // Report seat usage for overage billing (non-blocking)
  reportSeatUsage(invite.coach_id).catch((err) =>
    console.error('reportSeatUsage error:', err instanceof Error ? err.message : String(err))
  )

  // Auto-assign autoflow if one was specified in the invite
  if (autoflowId) {
    try {
      // Fetch template to get total_steps
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

        // Generate calendar events for each step
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

  // Mark invite accepted
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
