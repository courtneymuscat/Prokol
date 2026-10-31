import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePlatformAdmin } from '@/lib/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { actionEnterGymOrg } from '@/app/actions/admin'

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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/gyms" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">← Gyms</Link>
          <div className="flex items-center gap-3 mt-2">
            {org.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logo_url} alt={org.name} className="h-10 w-10 rounded-lg object-contain bg-zinc-800" />
            ) : (
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: org.brand_colour ?? 'var(--nc-primary)' }}
              >
                {(org.app_name ?? org.name).charAt(0).toUpperCase()}
              </div>
            )}
            <h1 className="text-2xl font-bold text-zinc-100">{org.app_name ?? org.name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/orgs/${org.id}?tab=links`}
            className="text-sm font-medium px-4 py-2 rounded-xl text-zinc-300 border border-zinc-700 hover:bg-zinc-800 transition-colors whitespace-nowrap"
          >
            Organisation settings →
          </Link>
          <form action={actionEnterGymOrg.bind(null, org.id)}>
            <button
              type="submit"
              className="text-sm font-semibold px-4 py-2 rounded-xl text-zinc-900 hover:opacity-90 transition-opacity whitespace-nowrap"
              style={{ backgroundColor: 'var(--nc-primary)' }}
            >
              Enter gym dashboard →
            </button>
          </form>
        </div>
      </div>

      <p className="text-sm text-zinc-500">
        Signup links now live under Organisation settings →{' '}
        <Link href={`/admin/orgs/${org.id}?tab=links`} className="text-emerald-400 hover:underline">Signup Links</Link>.
      </p>
    </div>
  )
}
