import { requirePlatformAdmin, getAllCoaches } from '@/lib/admin'
import CoachesTable from './CoachesTable'

export const dynamic = 'force-dynamic'

export default async function AdminCoachesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  await requirePlatformAdmin()

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const { coaches, total } = await getAllCoaches(page, 50)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Coaches</h1>
        <p className="text-sm text-zinc-500 mt-1">{total} total coaches</p>
      </div>
      <CoachesTable initialCoaches={coaches} total={total} page={page} />
    </div>
  )
}
