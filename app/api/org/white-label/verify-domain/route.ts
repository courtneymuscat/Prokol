import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyDomain } from '@/lib/vercel'

export async function POST() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

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

  const { verified, error } = await verifyDomain(org.custom_domain)

  if (verified) {
    await admin
      .from('organisations')
      .update({ custom_domain_verified: true })
      .eq('id', profile.org_id)
  }

  return NextResponse.json({ verified, error: error ?? null })
}
