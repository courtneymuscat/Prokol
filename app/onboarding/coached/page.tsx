import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import TosAcceptanceGate from './TosAcceptanceGate'

export default async function CoachedOnboardingPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Use admin client — RLS may block clients from reading their own coach_clients row.
  const { data: coachClientRow } = await admin
    .from('coach_clients')
    .select('coach_id, service_id')
    .eq('client_id', user.id)
    .in('status', ['active', 'pending_invite'])
    .limit(1)
    .single()

  if (!coachClientRow) redirect('/dashboard')

  // Optional columns that may not exist in older schema versions
  let formId: string | null = null
  let autoflowTemplateId: string | null = null
  try {
    const { data: extras } = await admin
      .from('coach_clients')
      .select('form_id, autoflow_id')
      .eq('client_id', user.id)
      .in('status', ['active', 'pending_invite'])
      .limit(1)
      .single()
    formId = (extras as Record<string, unknown>)?.form_id as string | null ?? null
    autoflowTemplateId = (extras as Record<string, unknown>)?.autoflow_id as string | null ?? null
  } catch { /* columns don't exist yet — fine */ }

  const [{ data: coachProfile }, { data: clientProfile }] = await Promise.all([
    admin.from('profiles').select('first_name, email, brand_name, logo_url, brand_colour').eq('id', coachClientRow.coach_id).single(),
    admin.from('profiles').select('onboarding_completed').eq('id', user.id).single(),
  ])

  // Fetch service if attached — include tos_url for acceptance gate
  let service: { name: string; payment_link: string; price_label: string | null; description: string | null; tos_url: string | null } | null = null
  if (coachClientRow.service_id) {
    const { data } = await admin
      .from('coach_services')
      .select('name, payment_link, price_label, description, tos_url')
      .eq('id', coachClientRow.service_id)
      .single()
    service = data ? { ...data, tos_url: (data as Record<string, unknown>).tos_url as string | null ?? null } : null
  }

  // Look up the active autoflow instance so we can link directly to it
  let autoflowInstanceId: string | null = null
  if (autoflowTemplateId) {
    try {
      const { data: flowRow } = await admin
        .from('client_autoflows')
        .select('id')
        .eq('client_id', user.id)
        .eq('template_id', autoflowTemplateId)
        .eq('status', 'active')
        .limit(1)
        .single()
      autoflowInstanceId = flowRow?.id ?? null
    } catch { /* no autoflow yet */ }
  }

  const finalDestination = '/dashboard'
  const afterPayUrl = finalDestination

  const coachName = coachProfile?.first_name || coachProfile?.email || 'your coach'
  const coachBrandName = (coachProfile as Record<string, unknown>)?.brand_name as string | null ?? null
  const coachLogoUrl = (coachProfile as Record<string, unknown>)?.logo_url as string | null ?? null
  const coachBrandColour = (coachProfile as Record<string, unknown>)?.brand_colour as string | null ?? null
  const displayName = coachBrandName || coachName

  // No service — go straight to the app
  if (!service) redirect(finalDestination)

  const paymentLink = service.payment_link

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo / brand header */}
      <div className="mb-8 flex items-center gap-2">
        {coachLogoUrl ? (
          <img src={coachLogoUrl} alt={displayName} className="h-8 object-contain" />
        ) : (
          <span className="text-xl font-bold text-gray-900">{displayName}</span>
        )}
      </div>

      <div className="w-full max-w-md space-y-4">
        {/* Welcome header */}
        <div className="bg-white rounded-2xl border p-6 text-center space-y-3">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto text-2xl"
            style={{ backgroundColor: coachBrandColour ? `${coachBrandColour}22` : '#fef9c3' }}
          >
            ✨
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            Welcome to {displayName}&apos;s program
          </h1>
          <p className="text-sm text-gray-500">You&apos;re almost in. Here&apos;s what you&apos;re signing up for.</p>
        </div>

        {/* Service card */}
        <div
          className="bg-white rounded-2xl border-2 p-5 space-y-3"
          style={{ borderColor: coachBrandColour ?? '#e5e7eb' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 flex-1 min-w-0">
              <p className="text-base font-bold text-gray-900">{service.name}</p>
              {service.description && (
                <p className="text-sm text-gray-500 leading-relaxed">{service.description}</p>
              )}
            </div>
            {service.price_label && (
              <span
                className="flex-shrink-0 text-sm font-bold px-3 py-1 rounded-full"
                style={{
                  backgroundColor: coachBrandColour ? `${coachBrandColour}18` : '#f0fdf4',
                  color: coachBrandColour ?? '#15803d',
                }}
              >
                {service.price_label}
              </span>
            )}
          </div>
        </div>

        {/* ToS acceptance + payment */}
        <TosAcceptanceGate
          paymentLink={paymentLink}
          afterPayUrl={afterPayUrl}
          tosUrl={service.tos_url}
          coachName={coachName}
          brandColour={coachBrandColour}
        />

        <p className="text-xs text-center text-gray-400">
          Questions? Contact {coachName} directly.
        </p>
      </div>
    </div>
  )
}
