import { requirePlatformAdmin } from '@/lib/admin'
import CoursesManager from './CoursesManager'

export const dynamic = 'force-dynamic'

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ autoflow?: string }>
}) {
  await requirePlatformAdmin()
  const { autoflow } = await searchParams

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Courses</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Bundle one or more autoflows behind a single link you sell directly to individuals — no gym involved.
          Leave the price blank for a free course. Payment (when priced) is confirmed by Stripe before anyone
          actually gets enrolled, so sharing the link doesn't let anyone skip paying.
        </p>
      </div>
      <CoursesManager initialAutoflowId={autoflow ?? null} />
    </div>
  )
}
