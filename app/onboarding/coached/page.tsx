import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PayNowButton from './PayNowButton'

export default async function CoachedOnboardingPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Look up their coach via coach_clients table
  // Select core columns; form_id may not exist yet if migration hasn't run
  const { data: coachClientRow } = await supabase
    .from('coach_clients')
    .select('coach_id, service_id')
    .eq('client_id', user.id)
    .eq('status', 'active')
    .single()

  // Separately try to get form_id (column may not exist yet)
  let coachClientFormId: string | null = null
  try {
    const { data: formRow } = await supabase
      .from('coach_clients')
      .select('form_id')
      .eq('client_id', user.id)
      .eq('status', 'active')
      .single()
    coachClientFormId = (formRow as { form_id?: string | null })?.form_id ?? null
  } catch { /* column doesn't exist yet */ }

  if (!coachClientRow) {
    redirect('/onboarding')
  }

  // Use admin client to bypass RLS for reading the coach's profile and service
  const admin = createAdminClient()

  const [{ data: coachProfile }, { data: clientProfile }] = await Promise.all([
    admin
      .from('profiles')
      .select('first_name, email')
      .eq('id', coachClientRow.coach_id)
      .single(),
    supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', user.id)
      .single(),
  ])

  // Fetch service if one is attached
  let service: { name: string; payment_link: string; price_label: string | null } | null = null
  if (coachClientRow.service_id) {
    const { data } = await admin
      .from('coach_services')
      .select('name, payment_link, price_label')
      .eq('id', coachClientRow.service_id)
      .single()
    service = data ?? null
  }

  const formUrl = coachClientFormId ? `/forms/${coachClientFormId}` : null
  const afterPayUrl = formUrl ?? (clientProfile?.onboarding_completed ? '/dashboard' : '/onboarding/coached')
  const coachName = coachProfile?.first_name || coachProfile?.email || 'your coach'
  const paymentLink = service?.payment_link ?? null
  const serviceName = service?.name ?? null

  // No payment link configured — skip straight to the next step
  if (!paymentLink) {
    // If there's no form either, mark onboarding complete and send to dashboard
    if (!formUrl && !clientProfile?.onboarding_completed) {
      await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user.id)
      redirect('/dashboard')
    }
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
          {serviceName && (
            <p className="text-sm text-gray-600 font-medium">You&apos;re joining: {serviceName}</p>
          )}
          <p className="text-sm text-gray-500">Complete the steps below to get started.</p>
        </div>

        {/* Step 1 — Payment */}
        <div className="border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Step 1</p>
          <p className="text-sm font-semibold text-gray-900">Complete payment</p>
          <p className="text-xs text-gray-500">
            Click below to pay {coachName}. Once done, come back here to continue.
          </p>
          <PayNowButton paymentLink={paymentLink} afterPayUrl={afterPayUrl} />
        </div>

        {/* Step 2 — next step preview (muted) */}
        <div className="border border-gray-100 bg-gray-50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Step 2</p>
          <p className="text-sm font-semibold text-gray-400">
            {formUrl ? 'Complete your onboarding form' : 'Set up your profile'}
          </p>
          <p className="text-xs text-gray-400">
            {formUrl
              ? 'Your coach has a short form for you to fill in.'
              : 'Answer a few questions so we can calculate your personalised nutrition targets.'}
          </p>
        </div>
      </div>
    </div>
  )
}
