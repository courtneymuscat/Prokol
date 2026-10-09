import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { WHITE_LABEL_COACH_SEAT_LIMIT, DEFAULT_COACH_SEAT_LIMIT } from '@/lib/billing'

export type OrgBrandingRecord = {
  id: string
  name: string
  app_name: string | null
  brand_colour: string | null
  brand_colour_secondary: string | null
  brand_colour_text: string | null
  logo_url: string | null
  favicon_url: string | null
  app_icon_url: string | null
  support_email: string | null
  slug: string
}

const ORG_BRANDING_COLUMNS =
  'id, name, app_name, brand_colour, brand_colour_secondary, brand_colour_text, logo_url, favicon_url, app_icon_url, support_email, slug'

export async function getOrgBranding(orgId: string): Promise<OrgBrandingRecord | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('organisations')
    .select(ORG_BRANDING_COLUMNS)
    .eq('id', orgId)
    .single()

  return data ?? null
}

/**
 * Branding for whoever is logged in, regardless of which URL they're on —
 * this is what makes white-label "seamless": a coach or client who signed
 * up long before their org ever went white-label sees the right branding
 * the moment they log in on plain prokol.io, no special link needed.
 * Deliberately returns null (not just unbranded defaults) unless the
 * user's org is actually white-labelled — merely belonging to an ordinary
 * org must never reskin the app.
 */
export async function getOrgBrandingForUser(userId: string): Promise<OrgBrandingRecord | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select(`org_id, organisations(${ORG_BRANDING_COLUMNS}, is_white_label)`)
    .eq('id', userId)
    .single()

  const org = data?.organisations as unknown as (OrgBrandingRecord & { is_white_label: boolean }) | null
  if (!org?.is_white_label) return null

  const { is_white_label: _unused, ...branding } = org
  return branding
}

/**
 * Sets the x-* branding headers proxy forwards downstream, based on
 * whoever's logged in (see getOrgBrandingForUser).
 */
export function applyBrandingHeaders(headers: Headers, org: OrgBrandingRecord): void {
  headers.set('x-org-id', org.id)
  headers.set('x-app-name', org.app_name ?? org.name)
  headers.set('x-brand-colour', org.brand_colour ?? '#F5C842')
  headers.set('x-brand-colour-secondary', org.brand_colour_secondary ?? '#1A1A1A')
  headers.set('x-brand-colour-text', org.brand_colour_text ?? '#1A1A1A')
  headers.set('x-is-white-label', 'true')
  if (org.logo_url) headers.set('x-logo-url', org.logo_url)
  if (org.favicon_url) headers.set('x-favicon-url', org.favicon_url)
  if (org.app_icon_url) headers.set('x-app-icon-url', org.app_icon_url)
}

/**
 * The app URL + display name for a white-labelled org's invite/join links.
 * Always the plain app URL now that domains/subdomains have been removed —
 * branding-follows-login (see getOrgBrandingForUser) only applies once
 * someone has an account, so an invite recipient's very first screen is
 * unbranded Prokol regardless; this is a known, accepted trade-off. Returns
 * null for an org that isn't white-labelled at all, so callers can fall
 * back to generic copy.
 */
export async function getOrgFrontDoorUrl(orgId: string): Promise<{ url: string; appName: string } | null> {
  const admin = createAdminClient()
  const { data: org } = await admin
    .from('organisations')
    .select('name, app_name, is_white_label')
    .eq('id', orgId)
    .maybeSingle()

  if (!org?.is_white_label) return null
  const appName = org.app_name ?? org.name
  const url = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.prokol.io'
  return { url, appName }
}

/**
 * Emails every active client of an org to tell them branding just went
 * live, and — critically — that if they've already added the app to their
 * phone's home screen, they need to remove and re-add it to pick up the
 * new icon/name. This is the one piece of white-label that genuinely can't
 * be seamless: in-app branding (logo, colours) follows login automatically
 * (see getOrgBrandingForUser), but a home-screen icon is baked in at
 * "Add to Home Screen" time and can't be updated remotely — that's a
 * platform limitation (iOS/Android), not something fixable in app code.
 * Called when white-label first goes live (or is reinstated) for an org —
 * not on every branding tweak, since there's currently no self-serve way
 * to edit branding after initial approval.
 */
export async function notifyClientsOfBrandingChange(orgId: string): Promise<{ sent: number }> {
  const admin = createAdminClient()

  const { data: org } = await admin
    .from('organisations')
    .select('name, app_name')
    .eq('id', orgId)
    .single()

  if (!org) return { sent: 0 }

  const appName = org.app_name ?? org.name
  // Branding follows login (see getOrgBrandingForUser), so the plain app
  // URL already shows the right branding once logged in.
  const homeLink = process.env.NEXT_PUBLIC_APP_URL ?? 'https://prokol.io'

  const { data: coachRows } = await admin
    .from('org_members')
    .select('user_id')
    .eq('org_id', orgId)
    .eq('is_active', true)

  const coachIds = (coachRows ?? []).map((r) => r.user_id)
  if (coachIds.length === 0) return { sent: 0 }

  const { data: clientRows } = await admin
    .from('coach_clients')
    .select('client_id')
    .in('coach_id', coachIds)
    .eq('status', 'active')

  const clientIds = [...new Set((clientRows ?? []).map((r) => r.client_id))]
  if (clientIds.length === 0) return { sent: 0 }

  const { data: clientProfiles } = await admin
    .from('profiles')
    .select('email, full_name')
    .in('id', clientIds)

  const recipients = (clientProfiles ?? []).filter((p): p is { email: string; full_name: string | null } => !!p.email)

  await Promise.all(
    recipients.map((p) =>
      sendEmail({
        to: p.email,
        subject: `${appName} has a new look`,
        fromName: appName,
        html: `
          <p>Hi ${p.full_name ?? 'there'},</p>
          <p><strong>${appName}</strong> just got new branding.</p>
          <p>If you've added this app to your phone's home screen, the icon and name there won't update on their own — please remove it and add it again from this link to see the new look:</p>
          <p><a href="${homeLink}">${homeLink}</a></p>
          <p>Everything else (logging in, your programs, messages) stays exactly the same either way.</p>
        `,
      }),
    ),
  )

  return { sent: recipients.length }
}

/**
 * Keeps an already-white-labelled org's white_label_tier in sync with its
 * owner's actual paid Stripe tier. Takes prevTier/newTier explicitly from
 * the caller rather than re-deriving "did it change" from the DB, since
 * both real callers can know this reliably on their own (the Stripe
 * webhook from the event's resolved tier, change-plan from the tiers it's
 * switching between directly) — re-reading profiles.subscription_tier to
 * detect a change is unsafe here specifically because change-plan writes
 * the new tier to the DB synchronously, often before the webhook for the
 * same change even arrives, which would make the webhook see "no change"
 * and silently skip turning white-label off.
 *
 * An upgrade/downgrade between wl_starter/wl_pro just updates which tier;
 * downgrading away from white-label entirely (e.g. back to coach_business)
 * actually turns white-label off. Branding fields (logo, colours, domain)
 * are left in place, same as an admin revoke — re-upgrading later restores
 * it without re-uploading anything (admin reinstate).
 */
export async function syncWhiteLabelTierForOwner(
  ownerId: string,
  prevTier: string,
  newTier: string,
): Promise<void> {
  const WL_TIER_MAP: Record<string, 'starter' | 'pro'> = { wl_starter: 'starter', wl_pro: 'pro' }
  const newWlTier = WL_TIER_MAP[newTier] ?? null
  if (!WL_TIER_MAP[prevTier] && !newWlTier) return

  const admin = createAdminClient()
  const { data: ownedOrg } = await admin
    .from('organisations')
    .select('id, is_white_label, name')
    .eq('owner_id', ownerId)
    .maybeSingle()

  if (!ownedOrg?.is_white_label) return

  if (newWlTier) {
    await admin.from('organisations').update({
      white_label_tier: newWlTier,
      coach_seat_limit: WHITE_LABEL_COACH_SEAT_LIMIT[newWlTier],
    }).eq('id', ownedOrg.id)
    return
  }

  await admin.from('organisations').update({
    is_white_label: false,
    white_label_tier: null,
    coach_seat_limit: DEFAULT_COACH_SEAT_LIMIT,
  }).eq('id', ownedOrg.id)

  const { data: ownerProfile } = await admin
    .from('profiles')
    .select('email, full_name')
    .eq('id', ownerId)
    .single()

  if (ownerProfile?.email) {
    await sendEmail({
      to: ownerProfile.email,
      subject: 'Your white-label branding has been turned off',
      html: `
        <p>Hi ${ownerProfile.full_name ?? 'there'},</p>
        <p>Since your plan changed away from a white-label tier, white-label branding for <strong>${ownedOrg.name}</strong> has been switched off — your app and clients are now back to standard Prokol branding.</p>
        <p>Your logo and colours haven't been deleted — if you upgrade to white-label again, just let us know and we'll turn it straight back on.</p>
        <p>Questions? Email <a href="mailto:info@prokol.io">info@prokol.io</a></p>
      `,
    })
  }
}

