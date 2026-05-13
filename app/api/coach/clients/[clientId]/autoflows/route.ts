import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import { sendPushToUser } from '@/lib/push'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ clientId: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data } = await supabase
    .from('client_autoflows')
    .select(`
      id, name, start_date, status, created_at,
      autoflow_templates ( type, total_steps ),
      autoflow_responses ( step_number )
    `)
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  return Response.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { template_id, start_date, show_as_checkin_prompt } = await req.json()
  if (!template_id || !start_date) return Response.json({ error: 'template_id and start_date required' }, { status: 400 })

  const supabase = await createClient()
  const admin = createAdminClient()

  // Allow assigning either the coach's own template OR an org-published one
  // they have access to. We use the admin client for the org-template fallback
  // because the row is owned by the org owner.
  const { getOrgForUser } = await import('@/lib/org')

  let template: { id: string; name: string; total_steps: number } | null = null
  const { data: ownTemplate } = await supabase
    .from('autoflow_templates')
    .select('id, name, total_steps')
    .eq('id', template_id)
    .eq('coach_id', coachId)
    .maybeSingle()
  if (ownTemplate) {
    template = ownTemplate
  } else {
    const membership = await getOrgForUser(coachId)
    if (membership) {
      const { data: orgTemplate } = await admin
        .from('autoflow_templates')
        .select('id, name, total_steps')
        .eq('id', template_id)
        .eq('org_id', membership.org_id)
        .eq('is_org_template', true)
        .maybeSingle()
      if (orgTemplate) template = orgTemplate
    }
  }
  if (!template) return Response.json({ error: 'Template not found' }, { status: 404 })

  // Steps fetch always uses admin so org-template steps come through
  const { data: steps } = await admin
    .from('autoflow_template_steps')
    .select('step_number, title, day_offset, trigger_type, automated_message')
    .eq('template_id', template_id)
    .order('step_number')

  const { data: flow, error } = await supabase
    .from('client_autoflows')
    .insert({ coach_id: coachId, client_id: clientId, template_id, name: template.name, start_date, status: 'active', show_as_checkin_prompt: show_as_checkin_prompt === true })
    .select('id')
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Create calendar events for date-based steps only
  if (steps && steps.length > 0) {
    const [y, m, d] = start_date.split('-').map(Number)
    const events = steps
      .filter((s) => (s as Record<string, unknown>).trigger_type !== 'on_step_complete')
      .map((s) => ({
        coach_id: coachId,
        client_id: clientId,
        event_date: new Date(Date.UTC(y, m - 1, d + s.day_offset)).toISOString().split('T')[0],
        type: 'autoflow',
        title: `${template.name} — Step ${s.step_number}${s.title ? `: ${s.title}` : ''}`,
        content: { flow_id: flow.id, step_number: s.step_number, link: `/autoflows/${flow.id}/${s.step_number}` },
      }))
    if (events.length > 0) await supabase.from('calendar_events').insert(events)

    // Send automated messages for day_offset=0 steps (available immediately on assignment)
    const immediateSteps = steps.filter(
      (s) => (s as Record<string, unknown>).trigger_type !== 'on_step_complete' &&
             s.day_offset === 0 &&
             (s as unknown as Record<string, unknown>).automated_message
    )

    if (immediateSteps.length > 0) {
      // Get or create conversation between coach and client
      const { data: convo } = await admin
        .from('conversations')
        .upsert({ coach_id: coachId, client_id: clientId }, { onConflict: 'coach_id,client_id', ignoreDuplicates: false })
        .select('id')
        .single()

      if (convo?.id) {
        const msgRows = immediateSteps.map((s) => ({
          conversation_id: convo.id,
          sender_id: coachId,
          body: (s as unknown as Record<string, unknown>).automated_message as string,
        }))
        await admin.from('messages').insert(msgRows)
        await admin
          .from('conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', convo.id)
        // Mark these as sent so the hourly cron doesn't resend them.
        // ignoreDuplicates lets older flows (where the log row already exists
        // because of a retry) pass through cleanly.
        await admin
          .from('client_autoflow_message_log')
          .upsert(
            immediateSteps.map((s) => ({
              client_autoflow_id: flow.id,
              step_number: s.step_number,
            })),
            { onConflict: 'client_autoflow_id,step_number', ignoreDuplicates: true },
          )
      }
    }
  }

  // Push notification to the client — let them know they have new tasks
  const { data: coachProfile } = await supabase
    .from('profiles')
    .select('first_name, full_name')
    .eq('id', coachId)
    .single()
  const coachName = coachProfile?.first_name ?? coachProfile?.full_name ?? 'Your coach'

  sendPushToUser(clientId, {
    title: 'New tasks from ' + coachName,
    body: template.name,
    url: '/dashboard',
    icon: '/icons/icon-192.png',
    tag: `autoflow-assigned-${clientId}`,
  }).catch(() => {/* silent */})

  return Response.json({ id: flow.id })
}
