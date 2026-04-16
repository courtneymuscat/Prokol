import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export type OrgBrandingRecord = {
  id: string
  name: string
  app_name: string | null
  brand_colour: string | null
  brand_colour_secondary: string | null
  brand_colour_text: string | null
  logo_url: string | null
  favicon_url: string | null
  support_email: string | null
  slug: string
}

async function fetchOrgByDomain(domain: string): Promise<OrgBrandingRecord | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('organisations')
    .select('id, name, app_name, brand_colour, brand_colour_secondary, brand_colour_text, logo_url, favicon_url, support_email, slug')
    .eq('custom_domain', domain)
    .eq('is_white_label', true)
    .eq('custom_domain_verified', true)
    .single()

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
    .select('id, name, app_name, brand_colour, brand_colour_secondary, brand_colour_text, logo_url, favicon_url, support_email, slug')
    .eq('id', orgId)
    .single()

  return data ?? null
}

/**
 * Returns true when the hostname is NOT the main Prokol platform domain.
 * Used in proxy to detect white-label requests.
 */
export function isWhiteLabelDomain(hostname: string): boolean {
  const host = hostname.split(':')[0] // strip port
  if (!host) return false
  if (host === 'prokol.io') return false
  if (host === 'www.prokol.io') return false
  if (host.endsWith('.prokol.io')) return false
  if (host.endsWith('.vercel.app')) return false
  if (host === 'localhost') return false
  if (host.match(/^127\.|^192\.168\.|^10\./)) return false
  return true
}
