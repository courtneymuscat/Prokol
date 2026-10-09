import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePlatformAdmin, getGymMembers } from '@/lib/admin'
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

  // Links straight into the existing /coach/clients/[clientId] page — that
  // page authorizes purely on coach_clients.coach_id = you, so it already
  // works for gym clients with no new client-detail UI at all.
  const members = await getGymMembers(orgId, adminProfile.id)

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

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 max-w-2xl">
        <h2 className="text-sm font-semibold text-zinc-200">Members ({members.length})</h2>
        {members.length === 0 ? (
          <p className="text-xs text-zinc-500">No members yet — share a signup link below to get started.</p>
        ) : (
          <div className="divide-y divide-zinc-800">
            {members.map((m) => (
              <Link
                key={m.id}
                href={`/coach/clients/${m.id}`}
                className="flex items-center justify-between py-3 hover:bg-zinc-800/40 -mx-2 px-2 rounded-lg transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm text-zinc-100 truncate">{m.name ?? m.email}</p>
                  <p className="text-xs text-zinc-500 truncate">{m.email}</p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-xs text-zinc-500">
                    Last activity: {m.lastActivity ? new Date(m.lastActivity).toLocaleDateString() : 'Never'}
                  </p>
                  <p className="text-xs text-zinc-600">
                    Joined {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : '—'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
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
