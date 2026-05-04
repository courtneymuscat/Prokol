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

  // Also return pending invites (sent but not yet accepted)
  const { data: pendingInvites } = await admin
    .from('org_invites')
    .select('token, email, role, created_at, expires_at')
    .eq('org_id', membership.org_id)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .is('accepted_at', null)
    .order('created_at', { ascending: false })

  return Response.json({ coaches, pending_invites: pendingInvites ?? [] })
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const acceptUrl = `${appUrl}/org/invite/${token}`
  const loginUrl = `${appUrl}/login?next=${encodeURIComponent('/org/invite/' + token)}`
  const signupUrl = `${appUrl}/signup?org_invite=${token}`

  // Single branded invite email — no Supabase auth invite (avoids double email)
  await sendEmail({
    to: normalEmail,
    subject: `You've been invited to join ${org.name} on Prokol`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;background:#fff;">
        <p style="font-size:20px;font-weight:700;color:#111;margin:0 0 16px;">You've been invited to join ${org.name}</p>
        <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 24px;">
          You've been invited as a coach on Prokol Health. Click below to accept your invite.
        </p>
        <a href="${acceptUrl}" style="display:inline-block;background:#1D9E75;color:#fff;font-weight:700;font-size:15px;padding:12px 28px;border-radius:10px;text-decoration:none;margin-bottom:24px;">Accept invite →</a>
        <p style="font-size:13px;color:#888;margin:0 0 8px;">
          Already have a Prokol account? <a href="${loginUrl}" style="color:#1D9E75;">Log in to accept</a>
        </p>
        <p style="font-size:13px;color:#888;margin:0 0 24px;">
          New to Prokol? <a href="${signupUrl}" style="color:#1D9E75;">Create an account to accept</a>
        </p>
        <p style="font-size:12px;color:#aaa;">This invite expires in 7 days.</p>
      </div>
    `,
  })

  return Response.json({ success: true, invited: normalEmail })
}
