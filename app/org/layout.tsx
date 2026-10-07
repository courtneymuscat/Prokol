import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { hasOrgAreaAccess } from '@/lib/org'

export default async function OrgLayout({ children }: { children: React.ReactNode }) {
  // Invited coaches enter through /org/invite/[token] while their profile is
  // still individual_free — the auto-accept on that page upgrades them. If
  // this layout's tier gate fires for that path they get redirected to
  // /pricing before the acceptance can run. Bypass the gate for the invite
  // route so the auto-accept can complete.
  const headerList = await headers()
  const path = headerList.get('x-pathname') ?? headerList.get('x-invoke-path') ?? ''
  if (path.startsWith('/org/invite/')) return <>{children}</>

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

  // Must be on Business tier or higher (the invite path bypassed above, so
  // this only gates /org/setup and /org/white-label).
  if (!hasOrgAreaAccess(profile?.subscription_tier as string | null)) {
    redirect('/pricing')
  }

  return <>{children}</>
}
