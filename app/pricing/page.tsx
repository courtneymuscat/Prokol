import { INDIVIDUAL_PLANS, COACH_PLANS, type PricingPlan } from '@/lib/features'
import { getSubscription } from '@/lib/subscription'

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function PlanCard({ plan, current }: { plan: PricingPlan; current: boolean }) {
  return (
    <div className={`relative flex flex-col rounded-2xl border p-6 ${
      plan.highlighted
        ? 'border-blue-500 shadow-lg shadow-blue-100 bg-white'
        : 'border-gray-200 bg-white'
    }`}>
      {plan.highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
            Most popular
          </span>
        </div>
      )}

      {current && (
        <div className="absolute -top-3 right-4">
          <span className="bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
            Current plan
          </span>
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
        <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
      </div>

      <div className="mb-6">
        {plan.price === 0 ? (
          <p className="text-4xl font-bold text-gray-900">Free</p>
        ) : (
          <div className="flex items-end gap-1">
            <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
            <span className="text-gray-400 text-sm mb-1">/month</span>
          </div>
        )}
      </div>

      <ul className="space-y-2.5 mb-8 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
            <CheckIcon />
            {f}
          </li>
        ))}
      </ul>

      {current ? (
        <button disabled className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-400 cursor-not-allowed">
          Current plan
        </button>
      ) : plan.price === 0 ? (
        <a
          href="/dashboard"
          className="block w-full py-2.5 rounded-xl text-sm font-semibold text-center border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Get started free
        </a>
      ) : (
        <button
          disabled
          title="Stripe integration coming soon"
          className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            plan.highlighted
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-900 text-white hover:bg-gray-800'
          } opacity-60 cursor-not-allowed`}
        >
          Upgrade — coming soon
        </button>
      )}
    </div>
  )
}

export default async function PricingPage() {
  const sub = await getSubscription()

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <a href="/dashboard" className="text-xl font-bold text-gray-900">NutriCoach</a>
        <a href="/dashboard" className="text-sm text-gray-600 hover:underline">← Back to dashboard</a>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-16 space-y-20">

        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold text-gray-900">Simple, transparent pricing</h1>
          <p className="text-gray-500 text-lg">Choose the plan that fits your goals.</p>
          <p className="text-xs text-gray-400 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 inline-block">
            Payments are not yet active — plans are shown for preview only.
          </p>
        </div>

        {/* Individual plans */}
        <section>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">For Individuals</h2>
            <p className="text-gray-500 mt-1">Track your nutrition, training, and wellness.</p>
          </div>

          {sub.tier === 'coached' ? (
            <div className="bg-white rounded-2xl border border-blue-100 p-8 text-center space-y-3 max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">You&apos;re with a coach</h3>
              <p className="text-sm text-gray-500">
                Your coach covers your plan — you have full Pro access included. Individual plans are not needed while you&apos;re being coached.
              </p>
              <p className="text-xs text-gray-400">If you leave your coach you&apos;ll be moved to the Free plan and can upgrade from here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {INDIVIDUAL_PLANS.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  current={sub.userType === 'individual' && sub.tier === plan.id}
                />
              ))}
            </div>
          )}
        </section>

        {/* Coach plans */}
        <section>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">For Coaches</h2>
            <p className="text-gray-500 mt-1">Manage clients and grow your coaching practice.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {COACH_PLANS.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                current={sub.userType === 'coach' && sub.tier === plan.id}
              />
            ))}
          </div>
        </section>

        {/* FAQ / Stripe note */}
        <section className="bg-white rounded-2xl border p-8 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Frequently asked questions</h2>
          <div className="space-y-4 text-sm text-gray-600">
            <div>
              <p className="font-semibold text-gray-800">When will paid plans be available?</p>
              <p className="mt-1">Stripe integration is coming soon. All features are currently free during the preview period.</p>
            </div>
            <div>
              <p className="font-semibold text-gray-800">Can I switch plans later?</p>
              <p className="mt-1">Yes — you can upgrade or downgrade at any time. Downgrades take effect at the end of your billing cycle.</p>
            </div>
            <div>
              <p className="font-semibold text-gray-800">Is there a free trial for paid plans?</p>
              <p className="mt-1">Yes, paid plans will include a 14-day free trial once payments are enabled.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
