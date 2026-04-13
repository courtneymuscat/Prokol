import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export default async function OrgLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  // Should not reach here unauthenticated (proxy handles that), but guard anyway
  if (!session) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('subscription_tier, org_id')
    .eq('id', session.user.id)
    .single()

  // Must be on Business tier
  if (profile?.subscription_tier !== 'coach_business') {
    redirect('/pricing')
  }

  return <>{children}</>
}
