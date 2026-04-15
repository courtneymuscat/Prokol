import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import { sendEmail } from '@/lib/email'
import type { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const { email, service_id, form_id, form_save_to_file, autoflow_id } = await req.json()
  if (!email) return Response.json({ error: 'Email required' }, { status: 400 })

  const supabase = await createClient()

  // Fetch coach name for the invite email
  const { data: coachProfile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', coachId)
    .single()
  const coachName = coachProfile?.full_name ?? coachProfile?.email ?? 'Your coach'

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

  if (existing) {
    const url = `${baseUrl}/invite/${existing.token}`
    await sendEmail({
      to: email,
      subject: `You've been invited to join ${coachName} on Prokol`,
      html: `
        <p>Hi,</p>
        <p>${coachName} has invited you to join them on Prokol, a coaching platform for nutrition and fitness.</p>
        <p><a href="${url}">Accept your invite</a></p>
        <p>This link expires in 7 days.</p>
        <p>— The Prokol team</p>
      `,
    })
    return Response.json({ url, token: existing.token })
  }

  const { data: invite, error } = await supabase
    .from('coach_invites')
    .insert({ coach_id: coachId, email, service_id: service_id || null, form_id: form_id || null, form_save_to_file: form_id ? (form_save_to_file ?? false) : false, autoflow_id: autoflow_id || null })
    .select('token')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const url = `${baseUrl}/invite/${invite.token}`
  await sendEmail({
    to: email,
    subject: `You've been invited to join ${coachName} on Prokol`,
    html: `
      <p>Hi,</p>
      <p>${coachName} has invited you to join them on Prokol, a coaching platform for nutrition and fitness.</p>
      <p><a href="${url}">Accept your invite</a></p>
      <p>This link expires in 7 days.</p>
      <p>— The Prokol team</p>
    `,
  })
  return Response.json({ url, token: invite.token })
}
