import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function CoachedOnboardingPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Look up their coach via coach_clients table
  const { data: coachClientRow } = await supabase
    .from('coach_clients')
    .select('coach_id')
    .eq('client_id', user.id)
    .eq('status', 'active')
    .single()

  if (!coachClientRow) {
    redirect('/onboarding')
  }

  // Use admin client to bypass RLS for reading the coach's profile
  const admin = createAdminClient()

  const [{ data: coachProfile }, { data: clientProfile }] = await Promise.all([
    admin
      .from('profiles')
      .select('first_name, email, payment_link')
      .eq('id', coachClientRow.coach_id)
      .single(),
    supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', user.id)
      .single(),
  ])

  const afterPayUrl = clientProfile?.onboarding_completed ? '/dashboard' : '/onboarding'
  const coachName = coachProfile?.first_name || coachProfile?.email || 'your coach'
  const paymentLink = coachProfile?.payment_link ?? null

  // No payment link configured — skip straight to the next step
  if (!paymentLink) {
    redirect(afterPayUrl)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="mb-8">
        <span className="text-xl font-bold text-gray-900">NutriCoach</span>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl border p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-yellow-100 flex items-center justify-center mx-auto">
            <span className="text-2xl">✨</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            Welcome to {coachName}&apos;s program
          </h1>
          <p className="text-sm text-gray-500">Complete the steps below to get started.</p>
        </div>

        {/* Step 1 — Payment */}
        <div className="border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Step 1</p>
          <p className="text-sm font-semibold text-gray-900">Complete payment</p>
          <p className="text-xs text-gray-500">
            Click below to pay {coachName}. Once done, come back here to continue.
          </p>
          <a
            href={paymentLink}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center py-2.5 rounded-xl text-sm font-semibold text-gray-900 transition-colors"
            style={{ backgroundColor: '#FFD885' }}
          >
            Pay now →
          </a>
          <div className="pt-1">
            <Link
              href={afterPayUrl}
              className="block w-full text-center py-2.5 rounded-xl text-sm font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              I&apos;ve paid — continue →
            </Link>
          </div>
        </div>

        {/* Step 2 — Profile setup preview (muted) */}
        <div className="border border-gray-100 bg-gray-50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Step 2</p>
          <p className="text-sm font-semibold text-gray-400">Set up your profile</p>
          <p className="text-xs text-gray-400">
            Answer a few questions so we can calculate your personalised nutrition targets.
          </p>
        </div>
      </div>
    </div>
  )
}
