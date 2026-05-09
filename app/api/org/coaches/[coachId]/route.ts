import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgRole } from '@/lib/org'
import { sendEmail } from '@/lib/email'
import type { NextRequest } from 'next/server'

const GRACE_PERIOD_DAYS = 3

/**
 * DELETE /api/org/coaches/[coachId]
 * Removes a coach from the organisation. Requires owner or admin role.
 * - Deactivates the org_members row
 * - Clears org_id on the coach's profile
 * - Sets coach_grace_until = now + 3 days so they keep coach access (and
 *   their clients stay coached) during the grace window. Once the window
 *   expires, the next login / dashboard load downgrades them to
 *   individual_free unless they've started their own subscription.
 * Cannot be used to remove yourself or the org owner.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ coachId: string }> },
) {
  const { coachId } = await params

  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  if (coachId === session.user.id) {
    return Response.json({ error: 'You cannot remove yourself from the organisation' }, { status: 400 })
  }

  let membership
  try {
    membership = await requireOrgRole(session.user.id, 'admin')
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Verify the target coach is in the same org
  const { data: target } = await admin
    .from('org_members')
    .select('role')
    .eq('org_id', membership.org_id)
    .eq('user_id', coachId)
    .eq('is_active', true)
    .single()

  if (!target) {
    return Response.json({ error: 'Coach not found in this organisation' }, { status: 404 })
  }
  if (target.role === 'owner') {
    return Response.json({ error: 'Cannot remove the organisation owner' }, { status: 400 })
  }

  // Deactivate membership
  await admin
    .from('org_members')
    .update({ is_active: false })
    .eq('org_id', membership.org_id)
    .eq('user_id', coachId)

  // Clear org_id and start the grace period. Profile keeps coach_business
  // access for now; the next login/dashboard visit after the window expires
  // will trigger the downgrade via lib/coachGrace.ts.
  const graceUntil = new Date(Date.now() + GRACE_PERIOD_DAYS * 86400000)
  await admin
    .from('profiles')
    .update({ org_id: null, coach_grace_until: graceUntil.toISOString() })
    .eq('id', coachId)

  // Decrement org coach_seat_count (minimum 0)
  const { data: org } = await admin
    .from('organisations')
    .select('coach_seat_count, name')
    .eq('id', membership.org_id)
    .single()

  if (org) {
    const newCount = Math.max(0, (org.coach_seat_count as number) - 1)
    await admin
      .from('organisations')
      .update({ coach_seat_count: newCount })
      .eq('id', membership.org_id)
  }

  // Email the removed coach so they know they have 3 days to subscribe
  // before losing coach access and their clients reverting to free.
  const { data: removedProfile } = await admin
    .from('profiles')
    .select('email, full_name, first_name')
    .eq('id', coachId)
    .single()
  if (removedProfile?.email) {
    const name = (removedProfile.full_name as string | null)
      ?? (removedProfile.first_name as string | null)
      ?? 'there'
    const orgName = (org as { name?: string } | null)?.name ?? 'your organisation'
    const graceLabel = graceUntil.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://prokol.io'
    sendEmail({
      to: removedProfile.email as string,
      subject: `You've been removed from ${orgName}`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;background:#fff;">
          <p style="font-size:22px;font-weight:700;color:#111;margin:0 0 12px;">Your access to ${orgName} has ended</p>
          <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 16px;">
            Hi ${name}, you've been removed from <strong>${orgName}</strong> on Prokol.
          </p>
          <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 24px;">
            You have until <strong>${graceLabel}</strong> (3 days) to subscribe to your own coach plan and keep all of your existing clients. After that your account will move to the free Tracker plan and any clients on the Coached plan will move there too — their data is preserved.
          </p>
          <a href="${baseUrl}/pricing#coach"
             style="display:inline-block;background:#1D9E75;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:13px 28px;border-radius:10px;margin-bottom:24px;">
            Choose a coach plan →
          </a>
          <p style="font-size:13px;color:#888;line-height:1.6;margin:0;">
            Questions? Reply to this email and we'll help.
          </p>
        </div>
      `,
    }).catch(() => {/* silent — removal still succeeds even if email fails */})
  }

  return Response.json({ ok: true, grace_until: graceUntil.toISOString() })
}
