import { requirePlatformAdmin, computePlatformAnalytics } from '@/lib/admin'
import AdminAnalyticsView from '../AdminAnalyticsView'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  await requirePlatformAdmin()

  // Platform-wide — this is the "Prokol umbrella" view (every coach, every
  // org). Court's own coaching business has its own Analytics, same as any
  // other org, reached from her regular Business dashboard or by clicking
  // into her own org from the Organisations list in Admin Mode.
  const analytics = await computePlatformAnalytics()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Analytics</h1>
        <p className="text-sm text-zinc-500 mt-1">Growth & churn across every coach and organisation on Prokol</p>
      </div>

      <AdminAnalyticsView data={analytics} />
    </div>
  )
}
