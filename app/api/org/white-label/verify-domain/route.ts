import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  checkDnsForVercel,
  addDomainToVercel,
  triggerVercelDomainVerify,
  VERCEL_CNAME_TARGET,
  VERCEL_A_TARGET,
} from '@/lib/vercel'

export async function POST() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Resolve the org for this user
  const { data: profile } = await admin
    .from('profiles')
    .select('org_id')
    .eq('id', session.user.id)
    .single()

  if (!profile?.org_id) {
    return NextResponse.json({ error: 'No organisation found' }, { status: 400 })
  }

  const { data: org } = await admin
    .from('organisations')
    .select('custom_domain, is_white_label')
    .eq('id', profile.org_id)
    .single()

  if (!org?.custom_domain || !org.is_white_label) {
    return NextResponse.json({ error: 'No white-label domain configured' }, { status: 400 })
  }

  const domain = org.custom_domain

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

    return NextResponse.json(
      {
        verified: false,
        dnsFound: false,
        message: `DNS not configured correctly. ${foundSummary}.`,
        instructions: {
          summary: `Add the following DNS record at your domain registrar (GoDaddy, Cloudflare, Namecheap, etc.), then click Verify again. Changes can take up to 24 hours to propagate.`,
          records: instructions,
        },
      },
      { status: 422 },
    )
  }

  // ── Step 2: Ensure domain is registered on this Vercel project ────────────
  // The admin-approve flow calls addDomainToVercel already, but it may have
  // failed or the project may have been relinked. This call is idempotent.
  const addResult = await addDomainToVercel(domain)
  if (addResult.error) {
    console.error('[verify-domain] Vercel add failed:', addResult.error)
    return NextResponse.json(
      { verified: false, error: `Could not register domain with Vercel: ${addResult.error}` },
      { status: 502 },
    )
  }

  // ── Step 3: Trigger Vercel's own DNS re-probe ─────────────────────────────
  // This flips verified=true on their side so routing works immediately.
  const vercelVerify = await triggerVercelDomainVerify(domain)
  if (vercelVerify.error) {
    // Non-fatal — Vercel sometimes returns an error here while still processing.
    // Log it but continue; the DNS check already confirmed everything is correct.
    console.warn('[verify-domain] Vercel verify trigger warning:', vercelVerify.error)
  }

  // ── Step 4: Mark domain verified in Supabase ──────────────────────────────
  const { error: dbError } = await admin
    .from('organisations')
    .update({ custom_domain_verified: true })
    .eq('id', profile.org_id)

  if (dbError) {
    console.error('[verify-domain] Supabase update failed:', dbError.message)
    return NextResponse.json(
      { verified: false, error: 'Domain verified but database update failed. Please try again.' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    verified: true,
    domain,
    vercelVerified: vercelVerify.verified,
    message: `${domain} is verified and active.`,
  })
}
