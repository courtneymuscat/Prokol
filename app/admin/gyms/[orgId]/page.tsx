import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePlatformAdmin } from '@/lib/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrgFrontDoorUrl } from '@/lib/whitelabel'
import SignupLinkPanel from './SignupLinkPanel'

export const dynamic = 'force-dynamic'

export default async function GymDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const adminProfile = await requirePlatformAdmin()
  const { orgId } = await params
  const admin = createAdminClient()

  const { data: org } = await admin
    .from('organisations')
    .select('id, name, app_name, logo_url, brand_colour, owner_id')
    .eq('id', orgId)
    .maybeSingle()

  if (!org || org.owner_id !== adminProfile.id) notFound()

  const frontDoor = await getOrgFrontDoorUrl(orgId)
  const frontDoorUrl = frontDoor?.url ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.prokol.io'

  const { data: links } = await admin
    .from('org_signup_links')
    .select('id, code, is_active, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  const { data: linkAutoflowRows } = await admin
    .from('org_signup_link_autoflows')
    .select('link_id, autoflow_id, autoflow_templates(name)')
    .in('link_id', (links ?? []).map((l) => l.id))

  const autoflowsByLink = new Map<string, string[]>()
  for (const row of linkAutoflowRows ?? []) {
    const names = autoflowsByLink.get(row.link_id) ?? []
    const tpl = row.autoflow_templates as unknown as { name: string } | null
    names.push(tpl?.name ?? 'Untitled autoflow')
    autoflowsByLink.set(row.link_id, names)
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/gyms" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">← Gyms</Link>
        <div className="flex items-center gap-3 mt-2">
          {org.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logo_url} alt={org.name} className="h-10 w-10 rounded-lg object-contain bg-zinc-800" />
          ) : (
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: org.brand_colour ?? '#1D9E75' }}
            >
              {(org.app_name ?? org.name).charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="text-2xl font-bold text-zinc-100">{org.app_name ?? org.name}</h1>
        </div>
      </div>

      <SignupLinkPanel
        orgId={org.id}
        frontDoorUrl={frontDoorUrl}
        existingLinks={(links ?? []).map((l) => ({
          id: l.id,
          code: l.code,
          isActive: l.is_active,
          autoflowNames: autoflowsByLink.get(l.id) ?? [],
        }))}
      />
    </div>
  )
}
