import Link from 'next/link'

export default function UpgradePrompt({
  plan,
  feature,
}: {
  plan: 'Optimiser' | 'Elite'
  feature: string
}) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center space-y-3">
      <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center mx-auto">
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <div>
        <p className="font-semibold text-gray-900 text-sm">{feature}</p>
        <p className="text-xs text-gray-400 mt-1">Available on the {plan} plan</p>
      </div>
      <Link
        href="/pricing"
        className="inline-block text-xs font-semibold px-4 py-2 rounded-xl text-gray-900 hover:opacity-90 transition-colors"
        style={{ backgroundColor: '#FFD885' }}
      >
        Upgrade to {plan} →
      </Link>
    </div>
  )
}
