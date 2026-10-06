import { requirePlatformAdmin } from '@/lib/admin'
import { computeOrgAnalytics } from '@/lib/org'
import AdminAnalyticsView from '../AdminAnalyticsView'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const admin = await requirePlatformAdmin()

  // This is Court's own coaching business performance, not a platform-wide
  // rollup — the Overview page already covers platform-wide numbers, and
  // mixing every organisation's clients into one churn/growth table here
  // would be meaningless (different businesses, different baselines).
  const analytics = admin.org_id ? await computeOrgAnalytics(admin.org_id) : null

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Analytics</h1>
        <p className="text-sm text-zinc-500 mt-1">Your own coaching business — growth & churn overview</p>
      </div>

      {analytics ? (
        <AdminAnalyticsView data={analytics} />
      ) : (
        <p className="text-sm text-zinc-500">You don&apos;t have an organisation set up yet.</p>
      )}
    </div>
  )
}
