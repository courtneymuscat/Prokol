import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgRole, getCoachPermissions } from '@/lib/org'
import { sendEmail } from '@/lib/email'
import type { NextRequest } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  let membership
  try {
    membership = await requireOrgRole(session.user.id, 'admin')
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Get all active members of this org
  const { data: members } = await admin
    .from('org_members')
    .select('user_id, role, invited_at, accepted_at, is_active')
    .eq('org_id', membership.org_id)
    .eq('is_active', true)

  if (!members?.length) return Response.json([])

  const memberIds = members.map((m) => m.user_id)

  // Fetch profiles and client counts in parallel
  const [profilesResult, clientCountsResult] = await Promise.all([
    admin
      .from('profiles')
      .select('id, email, full_name, subscription_tier')
      .in('id', memberIds),

    admin
      .from('coach_clients')
      .select('coach_id')
      .in('coach_id', memberIds)
      .eq('status', 'active'),
  ])

  const profileMap = Object.fromEntries(
    (profilesResult.data ?? []).map((p) => [p.id, p])
  )

  const clientCountMap: Record<string, number> = {}
  for (const row of clientCountsResult.data ?? []) {
    clientCountMap[row.coach_id] = (clientCountMap[row.coach_id] ?? 0) + 1
  }

  // Fetch permissions for each coach
  const permissionsMap = Object.fromEntries(
    await Promise.all(
      memberIds.map(async (id) => [
        id,
        await getCoachPermissions(id, membership.org_id),
      ])
    )
  )

  const coaches = members.map((m) => ({
    id: m.user_id,
    role: m.role,
    invited_at: m.invited_at,
    accepted_at: m.accepted_at,
    email: profileMap[m.user_id]?.email ?? null,
    full_name: profileMap[m.user_id]?.full_name ?? null,
    client_count: clientCountMap[m.user_id] ?? 0,
    permissions: permissionsMap[m.user_id],
  }))

  return Response.json(coaches)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  let membership
  try {
    membership = await requireOrgRole(session.user.id, 'admin')
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Forbidden' }, { status: 403 })
  }

  const { email, role = 'coach' } = await req.json() as { email: string; role?: string }
  if (!email?.trim()) return Response.json({ error: 'Email required' }, { status: 400 })
  if (!['admin', 'coach'].includes(role)) {
    return Response.json({ error: 'Role must be admin or coach' }, { status: 400 })
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email.trim())) {
    return Response.json({ error: 'Invalid email address' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Check seat cap
  const { data: org } = await admin
    .from('organisations')
    .select('coach_seat_count, coach_seat_limit, name')
    .eq('id', membership.org_id)
    .single()

  if (!org) return Response.json({ error: 'Organisation not found' }, { status: 404 })

  if (org.coach_seat_count >= org.coach_seat_limit) {
    return Response.json(
      {
        error: `You've reached your coach limit (${org.coach_seat_limit} included). Upgrade your plan to add more coaches.`,
        atCap: true,
        current: org.coach_seat_count,
        limit: org.coach_seat_limit,
      },
      { status: 403 },
    )
  }

  const normalEmail = email.trim().toLowerCase()

  // Check for an active unexpired invite for this email + org
  const { data: existingInvite } = await admin
    .from('org_invites')
    .select('id, token')
    .eq('org_id', membership.org_id)
    .eq('email', normalEmail)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  let token: string

  if (existingInvite) {
    // Resend: refresh timestamps on the existing invite
    const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    await admin
      .from('org_invites')
      .update({ created_at: new Date().toISOString(), expires_at: newExpiry })
      .eq('id', existingInvite.id)
    token = existingInvite.token
  } else {
    // Create a new invite record
    const { data: invite, error } = await admin
      .from('org_invites')
      .insert({
        org_id: membership.org_id,
        email: normalEmail,
        role,
        invited_by: session.user.id,
      })
      .select('token')
      .single()

    if (error) return Response.json({ error: error.message }, { status: 500 })
    token = invite.token
  }

  // Send Supabase auth invite (creates account / magic link for new users)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const inviteUrl = `${appUrl}/org/invite/${token}`

  await admin.auth.admin.inviteUserByEmail(normalEmail, {
    redirectTo: inviteUrl,
    data: { org_invite_token: token, org_name: org.name },
  })

  // Send branded invite email
  await sendEmail({
    to: normalEmail,
    subject: `You've been invited to join ${org.name} on Prokol`,
    html: `
      <p>Hi,</p>
      <p>You've been invited to join <strong>${org.name}</strong> as a coach on Prokol.</p>
      <p><a href="${inviteUrl}">Accept your invite</a></p>
      <p>This link expires in 7 days. If you don't have a Prokol account yet, you'll be guided to create one.</p>
      <p>— The Prokol team</p>
    `,
  })

  return Response.json({ success: true, invited: normalEmail })
}
