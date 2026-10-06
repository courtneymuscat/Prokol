import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { attemptDomainVerification } from '@/lib/whitelabel'

const STATUS_BY_KIND: Record<string, number> = {
  dns_not_configured: 422,
  vercel_add_failed: 502,
  db_update_failed: 500,
}

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

  const result = await attemptDomainVerification(profile.org_id, org.custom_domain)
  if (result.verified) return NextResponse.json(result)
  return NextResponse.json(result, { status: STATUS_BY_KIND[result.kind] ?? 500 })
}
