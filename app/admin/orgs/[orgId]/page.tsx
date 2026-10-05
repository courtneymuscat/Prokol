import { requirePlatformAdmin, getOrgDetail, getPublishableTemplates } from '@/lib/admin'
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

  const [{ org, members, publications, archivedClients, pendingWhiteLabelApplication }, publishableTemplates] = await Promise.all([
    getOrgDetail(orgId),
    getPublishableTemplates(admin.id),
  ])

  if (!org) notFound()

  return (
    <div className="space-y-6">
      <div>
        <a href="/admin/orgs" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">← All organisations</a>
        <h1 className="text-2xl font-bold text-zinc-100 mt-1">{org.name}</h1>
        <p className="text-sm text-zinc-500 mt-1">/{org.slug}</p>
      </div>
      <OrgDetailClient
        org={org}
        members={members}
        publications={publications}
        publishableTemplates={publishableTemplates}
        archivedClients={archivedClients}
        pendingWhiteLabelApplication={pendingWhiteLabelApplication}
      />
    </div>
  )
}
