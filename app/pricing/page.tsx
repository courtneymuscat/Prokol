import { getSubscription } from '@/lib/subscription'
import PricingCards from './PricingCards'
import Link from 'next/link'

export default async function PricingPage() {
  const sub = await getSubscription()

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

        <PricingCards
          currentTier={sub.tier === 'coached' ? null : sub.tier}
          currentUserType={sub.userType === 'business' ? null : sub.userType}
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
              Your coach covers your plan — you have full Elite access included. Individual plans are not needed while you&apos;re being coached.
            </p>
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
                a: "You'll get full Elite access covered by your coach's plan. If you ever leave, you'll return to the free Tracker plan.",
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
