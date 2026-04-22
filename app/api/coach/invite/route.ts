import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import { sendEmail } from '@/lib/email'
import type { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const { email, service_id, form_id, form_save_to_file, autoflow_id } = await req.json()
  if (!email) return Response.json({ error: 'Email required' }, { status: 400 })

  const supabase = await createClient()
  const admin = createAdminClient()

  // Fetch coach name/brand for the invite email
  const { data: coachProfile } = await supabase
    .from('profiles')
    .select('full_name, email, brand_name')
    .eq('id', coachId)
    .single()
  const brandName = (coachProfile as Record<string, unknown>)?.brand_name as string | null
  const coachName = brandName ?? coachProfile?.full_name ?? coachProfile?.email ?? 'Your coach'

  // Check for an existing pending invite to this email from this coach
  const { data: existing } = await supabase
    .from('coach_invites')
    .select('token')
    .eq('coach_id', coachId)
    .eq('email', email)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .single()

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000')

  let token: string
  if (existing) {
    token = existing.token
    await sendEmail({
      to: email,
      subject: `You've been invited to join ${coachName} on Prokol`,
      html: `
        <p>Hi,</p>
        <p>${coachName} has invited you to join them on Prokol Health, a coaching platform for nutrition and fitness.</p>
        <p><a href="${baseUrl}/invite/${token}">Accept your invite</a></p>
        <p>This link expires in 7 days.</p>
        <p>— The Prokol Health team</p>
      `,
    })
  } else {
    const { data: invite, error } = await supabase
      .from('coach_invites')
      .insert({ coach_id: coachId, email, service_id: service_id || null, form_id: form_id || null, form_save_to_file: form_id ? (form_save_to_file ?? false) : false, autoflow_id: autoflow_id || null })
      .select('token')
      .single()

    if (error) return Response.json({ error: error.message }, { status: 500 })
    token = invite.token

    await sendEmail({
      to: email,
      subject: `You've been invited to join ${coachName} on Prokol`,
      html: `
        <p>Hi,</p>
        <p>${coachName} has invited you to join them on Prokol Health, a coaching platform for nutrition and fitness.</p>
        <p><a href="${baseUrl}/invite/${token}">Accept your invite</a></p>
        <p>This link expires in 7 days.</p>
        <p>— The Prokol Health team</p>
      `,
    })
  }

  const url = `${baseUrl}/invite/${token}`

  // Add the invited client to coach_clients immediately so the coach can start working on
  // their file before the invite is accepted. For emails without an account, pre-create a
  // ghost auth user + profile — they'll activate it when they sign up via the invite link.
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  let clientId = existingProfile?.id ?? null

  if (!clientId) {
    // Pre-create a ghost auth user (not confirmed — client will activate on signup)
    const { data: { user: ghostUser } } = await admin.auth.admin.createUser({
      email,
      email_confirm: false,
    })
    if (ghostUser) {
      clientId = ghostUser.id
      await admin.from('profiles').upsert(
        { id: ghostUser.id, email, user_type: 'individual', role: 'client', subscription_tier: 'individual_free' },
        { onConflict: 'id' }
      )
    }
  }

  if (clientId) {
    await admin
      .from('coach_clients')
      .upsert(
        { coach_id: coachId, client_id: clientId, status: 'pending_invite', service_id: service_id || null },
        { onConflict: 'coach_id,client_id', ignoreDuplicates: true }
      )
  }

  return Response.json({ url, token })
}
