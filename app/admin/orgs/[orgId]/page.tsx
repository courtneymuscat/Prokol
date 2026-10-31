import { requirePlatformAdmin, getOrgDetail, getPublishableTemplates } from '@/lib/admin'
import { computeOrgAnalytics, listOrgLeads } from '@/lib/org'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrgFrontDoorUrl } from '@/lib/whitelabel'
import { actionEnterGymOrg } from '@/app/actions/admin'
import { notFound } from 'next/navigation'
import OrgDetailClient from './OrgDetailClient'

export const dynamic = 'force-dynamic'

export default async function AdminOrgDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const admin = await requirePlatformAdmin()
  const { orgId } = await params

  const [{ org, members, publications, archivedClients, pendingWhiteLabelApplication }, publishableTemplates, analytics, leads] = await Promise.all([
    getOrgDetail(orgId),
    getPublishableTemplates(admin.id),
    computeOrgAnalytics(orgId),
    listOrgLeads(orgId),
  ])

  if (!org) notFound()

  // Same "gym" definition app/admin/gyms/page.tsx uses — "just any
  // organisation this platform admin owns, not a special tenant_type".
  // Gates both the Enter gym dashboard shortcut below and signup links:
  // a signup-link signup resolves its coach_id from org.owner_id, which
  // only works end-to-end when that owner is the admin actually running
  // this flow. tenant_type is a separate, unrelated dimension
  // (coaching_business vs gym affects health-data visibility, not this).
  const isOwnedByAdmin = org.owner_id === admin.id
  let frontDoorUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.prokol.io'
  let existingLinks: { id: string; code: string; name: string | null; isActive: boolean; autoflowNames: string[] }[] = []
  if (isOwnedByAdmin) {
    const supabaseAdmin = createAdminClient()
    const [frontDoor, { data: links }] = await Promise.all([
      getOrgFrontDoorUrl(orgId),
      supabaseAdmin
        .from('org_signup_links')
        .select('id, code, name, is_active, created_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false }),
    ])
    frontDoorUrl = frontDoor?.url ?? frontDoorUrl

    const { data: linkAutoflowRows } = await supabaseAdmin
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

    existingLinks = (links ?? []).map((l) => ({
      id: l.id,
      code: l.code,
      name: l.name,
      isActive: l.is_active,
      autoflowNames: autoflowsByLink.get(l.id) ?? [],
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <a href="/admin/orgs" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">← All organisations</a>
          <h1 className="text-2xl font-bold text-zinc-100 mt-1">{org.name}</h1>
          <p className="text-sm text-zinc-500 mt-1">/{org.slug}</p>
        </div>
        {isOwnedByAdmin && (
          <form action={actionEnterGymOrg.bind(null, org.id)}>
            <button
              type="submit"
              className="text-sm font-semibold px-4 py-2 rounded-xl text-zinc-900 hover:opacity-90 transition-opacity whitespace-nowrap"
              style={{ backgroundColor: 'var(--nc-primary)' }}
            >
              Enter gym dashboard →
            </button>
          </form>
        )}
      </div>
      <OrgDetailClient
        org={org}
        members={members}
        publications={publications}
        publishableTemplates={publishableTemplates}
        archivedClients={archivedClients}
        pendingWhiteLabelApplication={pendingWhiteLabelApplication}
        analytics={analytics}
        initialLeads={leads}
        frontDoorUrl={frontDoorUrl}
        existingLinks={existingLinks}
        canManageSignupLinks={isOwnedByAdmin}
      />
    </div>
  )
}
