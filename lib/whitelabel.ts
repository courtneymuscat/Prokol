import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  checkDnsForVercel,
  addDomainToVercel,
  triggerVercelDomainVerify,
  VERCEL_CNAME_TARGET,
  VERCEL_A_TARGET,
} from '@/lib/vercel'

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

// Exported directly (not just via the cached wrapper below) so it's
// testable without needing a Next.js server-request context for unstable_cache.
export async function fetchOrgByDomain(domain: string): Promise<OrgBrandingRecord | null> {
  const admin = createAdminClient()

  // {slug}.prokol.io — the free, zero-DNS white-label subdomain. No
  // custom_domain_verified check: there's no DNS to verify for a subdomain
  // of a domain Prokol already controls, so it's live the moment an org is
  // approved, not gated on anything the org owner has to do.
  if (domain.endsWith('.prokol.io')) {
    const slug = domain.slice(0, -'.prokol.io'.length)
    const { data } = await admin
      .from('organisations')
      .select(ORG_BRANDING_COLUMNS)
      .eq('slug', slug)
      .eq('is_white_label', true)
      .maybeSingle()
    return data ?? null
  }

  const { data } = await admin
    .from('organisations')
    .select(ORG_BRANDING_COLUMNS)
    .eq('custom_domain', domain)
    .eq('is_white_label', true)
    .eq('custom_domain_verified', true)
    .maybeSingle()

  return data ?? null
}

// Cached for 5 minutes — used by server components and proxy.
// NOTE: unstable_cache is deprecated in Next.js 16 (see `use cache` directive).
// In Edge (proxy) context the cache wrapper is a passthrough; the query still runs.
export const getOrgByDomain = unstable_cache(
  fetchOrgByDomain,
  ['org-by-domain'],
  { revalidate: 300 },
)

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
 * Sets the x-* branding headers proxy forwards downstream — shared by both
 * the domain-based lookup (an org's own subdomain/custom domain) and the
 * login-based lookup (plain prokol.io, branding follows the account).
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
 * Returns true when the hostname is a candidate white-label request — either
 * a {slug}.prokol.io subdomain or an org's own custom domain. Used in proxy
 * to decide whether to even attempt an org lookup; getOrgByDomain is what
 * actually confirms the org exists and is white-labelled.
 */
export function isWhiteLabelDomain(hostname: string): boolean {
  const host = hostname.split(':')[0] // strip port
  if (!host) return false
  if (host === 'prokol.io') return false
  if (host === 'www.prokol.io') return false
  if (host.endsWith('.vercel.app')) return false
  if (host === 'localhost') return false
  if (host.match(/^127\.|^192\.168\.|^10\./)) return false
  return true
}

export type DomainVerificationResult =
  | { verified: true; domain: string; vercelVerified: boolean; message: string }
  | {
      verified: false
      kind: 'dns_not_configured'
      dnsFound: boolean
      message: string
      instructions: {
        summary: string
        records: { type: string; host: string; value: string; ttl: string }[]
      }
    }
  | { verified: false; kind: 'vercel_add_failed'; error: string }
  | { verified: false; kind: 'db_update_failed'; error: string }

/**
 * The actual "is this custom domain ready, and if so flip it live" logic —
 * shared by the manual "Check DNS" button (app/api/org/white-label/verify-domain)
 * and the daily background cron (app/api/cron/white-label-dns-check), so an
 * org owner doesn't have to remember to come back and click a button for
 * their DNS change to take effect.
 */
export async function attemptDomainVerification(
  orgId: string,
  domain: string,
): Promise<DomainVerificationResult> {
  const admin = createAdminClient()

  // ── Step 1: Real DNS check ────────────────────────────────────────────────
  const dns = await checkDnsForVercel(domain)

  if (!dns.valid) {
    const isApex = !domain.includes('.', domain.indexOf('.') + 1)
      || domain.split('.').length === 2

    const instructions = isApex
      ? [
          { type: 'A',     host: '@',   value: VERCEL_A_TARGET,     ttl: '3600' },
          { type: 'CNAME', host: 'www', value: VERCEL_CNAME_TARGET, ttl: '3600' },
        ]
      : [
          { type: 'CNAME', host: domain.split('.')[0], value: VERCEL_CNAME_TARGET, ttl: '3600' },
        ]

    const foundSummary = dns.found.length
      ? `Found: ${dns.recordType} → ${dns.found.join(', ')}`
      : 'No DNS records found for this domain yet'

    return {
      verified: false,
      kind: 'dns_not_configured',
      dnsFound: dns.found.length > 0,
      message: `DNS not configured correctly. ${foundSummary}.`,
      instructions: {
        summary: `Add the following DNS record at your domain registrar (GoDaddy, Cloudflare, Namecheap, etc.), then click Verify again. Changes can take up to 24 hours to propagate.`,
        records: instructions,
      },
    }
  }

  // ── Step 2: Ensure domain is registered on this Vercel project ────────────
  // The admin-approve flow calls addDomainToVercel already, but it may have
  // failed or the project may have been relinked. This call is idempotent.
  const addResult = await addDomainToVercel(domain)
  if (addResult.error) {
    console.error('[attemptDomainVerification] Vercel add failed:', addResult.error)
    return {
      verified: false,
      kind: 'vercel_add_failed',
      error: `Could not register domain with Vercel: ${addResult.error}`,
    }
  }

  // ── Step 3: Trigger Vercel's own DNS re-probe ─────────────────────────────
  // This flips verified=true on their side so routing works immediately.
  const vercelVerify = await triggerVercelDomainVerify(domain)
  if (vercelVerify.error) {
    // Non-fatal — Vercel sometimes returns an error here while still processing.
    // Log it but continue; the DNS check already confirmed everything is correct.
    console.warn('[attemptDomainVerification] Vercel verify trigger warning:', vercelVerify.error)
  }

  // ── Step 4: Mark domain verified in Supabase ──────────────────────────────
  const { error: dbError } = await admin
    .from('organisations')
    .update({ custom_domain_verified: true })
    .eq('id', orgId)

  if (dbError) {
    console.error('[attemptDomainVerification] Supabase update failed:', dbError.message)
    return {
      verified: false,
      kind: 'db_update_failed',
      error: 'Domain verified but database update failed. Please try again.',
    }
  }

  return {
    verified: true,
    domain,
    vercelVerified: vercelVerify.verified,
    message: `${domain} is verified and active.`,
  }
}
