import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportCoachSeatUsage } from '@/lib/billing'
import type { NextRequest } from 'next/server'

/**
 * GET /api/org/invite/[token]
 * Returns invite details for the accept page (no auth required).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: invite } = await admin
    .from('org_invites')
    .select('email, role, org_id, invited_by, organisations(name)')
    .eq('token', token)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (!invite) {
    return Response.json({ error: 'Invite not found or expired' }, { status: 404 })
  }

  const org = invite.organisations as unknown as { name: string } | null

  const { data: inviterProfile } = await admin
    .from('profiles')
    .select('full_name, email')
    .eq('id', invite.invited_by)
    .single()

  return Response.json({
    org_name: org?.name ?? null,
    invited_by_name: inviterProfile?.full_name ?? inviterProfile?.email ?? null,
    role: invite.role,
    email: invite.email,
  })
}

/**
 * POST /api/org/invite/[token]
 * Accept the invite. Caller must be authenticated.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  // Validate invite
  const { data: invite } = await admin
    .from('org_invites')
    .select('id, org_id, email, role, is_active, expires_at')
    .eq('token', token)
    .single()

  if (!invite || !invite.is_active || new Date(invite.expires_at) <= new Date()) {
    return Response.json({ error: 'Invite not found or expired' }, { status: 404 })
  }

  const orgId = invite.org_id as string

  // Check if this user's email matches the invite
  const userEmail = session.user.email?.toLowerCase()
  const inviteEmail = (invite.email as string).toLowerCase()
  if (userEmail !== inviteEmail) {
    return Response.json(
      { error: 'This invite was sent to a different email address' },
      { status: 403 },
    )
  }

  // Check if already an active org member
  const { data: existingMember } = await admin
    .from('org_members')
    .select('id, is_active')
    .eq('org_id', orgId)
    .eq('user_id', session.user.id)
    .maybeSingle()

  if (existingMember?.is_active) {
    return Response.json({ error: 'Already a member of this organisation' }, { status: 409 })
  }

  const now = new Date().toISOString()

  if (existingMember) {
    // Reactivate a previously removed membership
    await admin
      .from('org_members')
      .update({ is_active: true, role: invite.role, accepted_at: now })
      .eq('id', existingMember.id)
  } else {
    // Create new org_members record
    await admin.from('org_members').insert({
      org_id: orgId,
      user_id: session.user.id,
      role: invite.role,
      is_active: true,
      accepted_at: now,
    })

    // Create default permissions record
    await admin.from('org_coach_permissions').insert({
      org_id: orgId,
      coach_id: session.user.id,
      updated_by: session.user.id,
    })
  }

  // Update the coach's profile — set org_id and upgrade to coach_business tier
  // so they get full business feature access via the org owner's subscription
  const { data: coachProfile } = await admin
    .from('profiles')
    .select('subscription_tier, stripe_subscription_id')
    .eq('id', session.user.id)
    .single()

  const hadOwnSubscription = !!(coachProfile?.stripe_subscription_id)
  const previousTier = coachProfile?.subscription_tier as string | null

  await admin
    .from('profiles')
    .update({ org_id: orgId, subscription_tier: 'coach_business' })
    .eq('id', session.user.id)

  // Mark invite accepted
  await admin
    .from('org_invites')
    .update({ accepted_at: now, is_active: false })
    .eq('id', invite.id)

  // Increment org coach_seat_count and check for overage
  const { data: org } = await admin
    .from('organisations')
    .select('coach_seat_count, coach_seat_limit')
    .eq('id', orgId)
    .single()

  if (org) {
    const newCount = (org.coach_seat_count as number) + 1
    await admin
      .from('organisations')
      .update({ coach_seat_count: newCount })
      .eq('id', orgId)

    if (newCount > (org.coach_seat_limit as number)) {
      await reportCoachSeatUsage(orgId)
    }
  }

  return Response.json({
    success: true,
    redirect: '/coach/dashboard',
    // Warn if they had their own active subscription — they should cancel it in Stripe
    // to avoid double billing (their seat is now covered by the org owner's Business plan)
    had_own_subscription: hadOwnSubscription,
    previous_tier: previousTier,
  })
}
