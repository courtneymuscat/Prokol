import { getSubscription } from '@/lib/subscription'
import { createClient } from '@/lib/supabase/server'
import { getOrgForUser } from '@/lib/org'
import PricingCards from './PricingCards'
import Link from 'next/link'

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const sub = await getSubscription()
  const { tab } = await searchParams
  // Default to the coach tab when the visitor is a coach/business user, or
  // when the URL explicitly asks for it via ?tab=coach. The #coach hash is
  // handled client-side in PricingCards because hashes never reach the server.
  const initialTab: 'individual' | 'coach' =
    tab === 'coach' || sub.userType === 'coach' || sub.userType === 'business'
      ? 'coach'
      : 'individual'

  // Coaches who joined via an org invite have their plan paid for by the org
  // owner. They shouldn't see upgrade CTAs (would double-charge them).
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const membership = session ? await getOrgForUser(session.user.id) : null
  const orgManaged = membership && membership.role !== 'owner'
    ? { orgName: membership.org_name, role: membership.role }
    : null

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <Link href="/" className="text-xl font-bold text-gray-900">Prokol</Link>
        <Link href="/dashboard" className="text-sm text-gray-600 hover:underline">← Back to dashboard</Link>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-16 space-y-12">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold text-gray-900">Simple, transparent pricing</h1>
          <p className="text-gray-500 text-lg">Choose the plan that fits your goals. Cancel anytime.</p>
        </div>

        {orgManaged && (
          <div className="bg-white rounded-2xl border border-blue-100 p-6 max-w-2xl mx-auto flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="space-y-1 flex-1">
              <p className="text-sm font-semibold text-gray-900">Managed by {orgManaged.orgName}</p>
              <p className="text-sm text-gray-500">
                Your plan is covered by your organisation&apos;s subscription. Contact your organisation administrator to change plans or features.
              </p>
            </div>
          </div>
        )}

        <PricingCards
          currentTier={sub.tier === 'coached' ? null : sub.tier}
          currentUserType={sub.userType === 'business' ? null : sub.userType}
          initialTab={initialTab}
          orgManaged={orgManaged}
        />

        {sub.tier === 'coached' && (
          <div className="bg-white rounded-2xl border border-blue-100 p-8 text-center space-y-3 max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900">You&apos;re with a coach</h3>
            <p className="text-sm text-gray-500">
              Your coach covers your plan — you have Elite access included. Individual plans are not needed while you&apos;re being coached.
            </p>
            <p className="text-xs text-gray-400">AI meal photo scanning isn&apos;t included while coached — it&apos;s only on a self-subscribed Elite plan. Everything else is covered.</p>
            <p className="text-xs text-gray-400">If you leave your coach you&apos;ll be moved to the free Tracker plan and can upgrade from here.</p>
          </div>
        )}

        {/* FAQ */}
        <section className="bg-white rounded-2xl border p-8 space-y-5 max-w-3xl mx-auto">
          <h2 className="text-lg font-bold text-gray-900">Frequently asked questions</h2>
          <div className="space-y-4 text-sm text-gray-600">
            {[
              {
                q: 'Can I switch plans later?',
                a: 'Yes — upgrade or downgrade at any time. Downgrades take effect at the end of your billing cycle.',
              },
              {
                q: 'Is there a free trial for paid plans?',
                a: 'Your free Tracker plan is available forever. Paid plans include a 14-day free trial.',
              },
              {
                q: 'What currency are prices in?',
                a: 'All prices are in Australian dollars (AUD) and include GST.',
              },
              {
                q: "What happens when I'm added by a coach?",
                a: "You'll get Elite-level access covered by your coach's plan — the one exception is AI meal photo scanning, which is only available on a self-subscribed Elite plan. If you ever leave, you'll return to the free Tracker plan.",
              },
            ].map(({ q, a }) => (
              <div key={q}>
                <p className="font-semibold text-gray-800">{q}</p>
                <p className="mt-1">{a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
