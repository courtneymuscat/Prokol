import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
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
    return NextResponse.json({ application: null })
  }

  const { data: application } = await admin
    .from('white_label_applications')
    .select('id, status, app_name, custom_domain, submitted_at, rejection_reason')
    .eq('org_id', profile.org_id)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({ application: application ?? null })
}
