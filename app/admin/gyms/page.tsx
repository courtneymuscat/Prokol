import Link from 'next/link'
import { requirePlatformAdmin } from '@/lib/admin'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function AdminGymsPage() {
  const adminProfile = await requirePlatformAdmin()
  const admin = createAdminClient()

  // A "gym" here is just any organisation this platform admin owns — not a
  // special tenant_type (see lib/coach.ts's acceptOrgSignupLink doc comment
  // for why). COURT itself matches this too, but is managed through the
  // regular coach dashboard rather than this screen.
  const { data: gyms } = await admin
    .from('organisations')
    .select('id, name, app_name, slug, logo_url, brand_colour, created_at')
    .eq('owner_id', adminProfile.id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Gyms</h1>
          <p className="text-sm text-zinc-500 mt-1">{gyms?.length ?? 0} gym organisations</p>
        </div>
        <Link
          href="/admin/gyms/new"
          className="text-sm font-semibold px-4 py-2 rounded-xl text-zinc-900 hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#1D9E75' }}
        >
          + Add gym
        </Link>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl divide-y divide-zinc-800">
        {(gyms ?? []).length === 0 && (
          <p className="px-5 py-8 text-sm text-zinc-500 text-center">No gyms yet.</p>
        )}
        {(gyms ?? []).map((gym) => (
          <Link
            key={gym.id}
            href={`/admin/gyms/${gym.id}`}
            className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-800/60 transition-colors"
          >
            {gym.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={gym.logo_url} alt={gym.name} className="h-10 w-10 rounded-lg object-contain bg-zinc-800 flex-shrink-0" />
            ) : (
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ backgroundColor: gym.brand_colour ?? '#1D9E75' }}
              >
                {(gym.app_name ?? gym.name).charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-100 truncate">{gym.app_name ?? gym.name}</p>
              <p className="text-xs text-zinc-500">{gym.slug}.prokol.io</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
