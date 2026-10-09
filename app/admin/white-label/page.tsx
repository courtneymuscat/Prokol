import { requirePlatformAdmin } from '@/lib/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import WhiteLabelAppsTable from './WhiteLabelAppsTable'

export const dynamic = 'force-dynamic'

export type WhiteLabelApp = {
  id: string
  org_id: string
  org_name: string
  app_name: string
  brand_colour: string
  brand_colour_secondary: string | null
  logo_url: string | null
  favicon_url: string | null
  support_email: string
  requested_tier: string
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
  reviewed_at: string | null
  rejection_reason: string | null
  owner_email: string | null
  owner_name: string | null
  // Live state on the org row itself — distinct from the application's own
  // status. An application can stay "approved" (an honest historical
  // record) long after an admin has turned white-label off, so the table
  // needs both: what was decided, and what's actually live right now.
  org_is_white_label: boolean
}

export default async function AdminWhiteLabelPage() {
  await requirePlatformAdmin()

  const admin = createAdminClient()

  const { data: applications } = await admin
    .from('white_label_applications')
    .select('*, organisations(name, owner_id)')
    .order('submitted_at', { ascending: false })

  if (!applications) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-zinc-100">White-label Applications</h1>
        <p className="text-zinc-500 text-sm">No applications yet.</p>
      </div>
    )
  }

  // Enrich with owner info
  const ownerIds = [
    ...new Set(
      applications
        .map(a => (a.organisations as { name: string; owner_id: string } | null)?.owner_id)
        .filter(Boolean) as string[],
    ),
  ]

  const { data: owners } = ownerIds.length
    ? await admin.from('profiles').select('id, email, full_name').in('id', ownerIds)
    : { data: [] }

  const ownerMap: Record<string, { email: string | null; full_name: string | null }> = {}
  for (const o of owners ?? []) {
    ownerMap[o.id] = { email: o.email, full_name: o.full_name }
  }

  // Live org state, fetched separately from the application history — an
  // org's actual is_white_label can drift from what its original
  // application said (revoked, reinstated, etc.).
  const appOrgIds = [...new Set(applications.map(a => a.org_id))]
  const { data: liveOrgs } = appOrgIds.length
    ? await admin.from('organisations').select('id, is_white_label').in('id', appOrgIds)
    : { data: [] }
  const liveOrgMap: Record<string, { is_white_label: boolean }> = {}
  for (const o of liveOrgs ?? []) {
    liveOrgMap[o.id] = { is_white_label: o.is_white_label }
  }

  const apps: WhiteLabelApp[] = applications.map(a => {
    const org = a.organisations as { name: string; owner_id: string } | null
    const owner = org?.owner_id ? (ownerMap[org.owner_id] ?? null) : null
    const live = liveOrgMap[a.org_id]
    return {
      id: a.id,
      org_id: a.org_id,
      org_name: org?.name ?? '—',
      app_name: a.app_name,
      brand_colour: a.brand_colour,
      brand_colour_secondary: a.brand_colour_secondary,
      logo_url: a.logo_url,
      favicon_url: a.favicon_url,
      support_email: a.support_email,
      requested_tier: a.requested_tier,
      status: a.status as WhiteLabelApp['status'],
      submitted_at: a.submitted_at,
      reviewed_at: a.reviewed_at,
      rejection_reason: a.rejection_reason,
      owner_email: owner?.email ?? null,
      owner_name: owner?.full_name ?? null,
      org_is_white_label: live?.is_white_label ?? false,
    }
  })

  const pending = apps.filter(a => a.status === 'pending')
  const reviewed = apps.filter(a => a.status !== 'pending')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">White-label Applications</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {pending.length} pending · {reviewed.length} reviewed
        </p>
      </div>

      {pending.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">
            Pending review
          </h2>
          <WhiteLabelAppsTable apps={pending} />
        </section>
      )}

      {reviewed.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">
            Reviewed
          </h2>
          <WhiteLabelAppsTable apps={reviewed} readonly />
        </section>
      )}

      {apps.length === 0 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 px-6 py-8 text-center">
          <p className="text-zinc-500 text-sm">No white-label applications yet.</p>
        </div>
      )}
    </div>
  )
}
