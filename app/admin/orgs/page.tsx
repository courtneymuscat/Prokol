import { requirePlatformAdmin, getAllOrgs, getAllCoaches } from '@/lib/admin'
import OrgsTable from './OrgsTable'

export const dynamic = 'force-dynamic'

export default async function AdminOrgsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  await requirePlatformAdmin()

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const [{ orgs, total }, { total: independentCoachTotal }] = await Promise.all([
    getAllOrgs(page, 50),
    getAllCoaches(1, 1, true),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Organisations</h1>
        <p className="text-sm text-zinc-500 mt-1">{total} total organisations</p>
      </div>
      <OrgsTable initialOrgs={orgs} total={total} page={page} />
      <a
        href="/admin/coaches"
        className="block bg-zinc-900 rounded-xl border border-zinc-800 px-5 py-4 hover:border-zinc-700 transition-colors"
      >
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Umbrella</p>
        <p className="text-sm text-zinc-200 mt-1">
          <span className="font-semibold">{independentCoachTotal}</span> independent coach{independentCoachTotal === 1 ? '' : 'es'} outside any organisation →
        </p>
      </a>
    </div>
  )
}
