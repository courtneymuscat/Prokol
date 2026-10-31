import Link from 'next/link'
import { requirePlatformAdmin } from '@/lib/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { actionEnterGymOrg } from '@/app/actions/admin'

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
    .select('id, name, app_name, logo_url, brand_colour, created_at')
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
          style={{ backgroundColor: 'var(--nc-primary)' }}
        >
          + Add gym
        </Link>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl divide-y divide-zinc-800">
        {(gyms ?? []).length === 0 && (
          <p className="px-5 py-8 text-sm text-zinc-500 text-center">No gyms yet.</p>
        )}
        {(gyms ?? []).map((gym) => (
          <div key={gym.id} className="flex items-center gap-2 px-2">
            {/* Primary action: enter this gym's real coach dashboard as its
                owner-coach (see lib/admin.ts enterGymOrg). A bound server
                action in a plain <form> needs no client JS. */}
            <form action={actionEnterGymOrg.bind(null, gym.id)} className="flex-1">
              <button
                type="submit"
                className="w-full flex items-center gap-4 px-3 py-4 rounded-xl hover:bg-zinc-800/60 transition-colors text-left"
              >
                {gym.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={gym.logo_url} alt={gym.name} className="h-10 w-10 rounded-lg object-contain bg-zinc-800 flex-shrink-0" />
                ) : (
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ backgroundColor: gym.brand_colour ?? 'var(--nc-primary)' }}
                  >
                    {(gym.app_name ?? gym.name).charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-100 truncate">{gym.app_name ?? gym.name}</p>
                  <p className="text-xs text-zinc-500">Enter dashboard →</p>
                </div>
              </button>
            </form>
            <Link
              href={`/admin/orgs/${gym.id}`}
              title="Organisation settings"
              className="flex-shrink-0 p-2.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
