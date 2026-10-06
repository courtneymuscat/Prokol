import { requirePlatformAdmin, getAllOrgs } from '@/lib/admin'
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
  const { orgs, total } = await getAllOrgs(page, 50)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Organisations</h1>
        <p className="text-sm text-zinc-500 mt-1">{total} total organisations</p>
      </div>
      <OrgsTable initialOrgs={orgs} total={total} page={page} />
    </div>
  )
}
