import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { acceptInvite } from '@/lib/coach'
import InviteFlow from './InviteFlow'

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  // Admin client bypasses RLS — unauthenticated users can't read coach_invites directly
  const { data: invite } = await admin
    .from('coach_invites')
    .select('id, email, status, expires_at, coach_id, service_id')
    .eq('token', token)
    .single()

  if (!invite) {
    return <InvalidInvite message="This invite link is invalid." />
  }

  if (invite.status === 'revoked') {
    return <InvalidInvite message="This invite link has been revoked. Ask your coach to send a new one." />
  }

  if (new Date(invite.expires_at) < new Date() && invite.status !== 'accepted') {
    return <InvalidInvite message="This invite link has expired. Ask your coach to send a new one." />
  }

  // Fetch coach branding
  const { data: coachProfile } = await admin
    .from('profiles')
    .select('email, full_name, first_name, brand_name, logo_url, brand_colour')
    .eq('id', invite.coach_id)
    .single()

  // If already logged in and not the sending coach, accept and route appropriately
  const { data: { session } } = await supabase.auth.getSession()
  if (session && session.user.id !== invite.coach_id) {
    await acceptInvite(token, session.user.id)
    // If this invite has a service, show the terms+pay page for authenticated users
    if (invite.service_id) redirect('/onboarding/coached')
    redirect('/dashboard')
  }

  // Fetch service details for the terms+pay step
  const serviceId = (invite as Record<string, unknown>).service_id as string | null
  let service: {
    name: string
    payment_link: string | null
    price_label: string | null
    description: string | null
    tos_url: string | null
  } | null = null

  if (serviceId) {
    const { data } = await admin
      .from('coach_services')
      .select('name, payment_link, price_label, description, tos_url')
      .eq('id', serviceId)
      .single()
    service = data
      ? {
          name: data.name,
          payment_link: data.payment_link ?? null,
          price_label: (data as Record<string, unknown>).price_label as string | null ?? null,
          description: (data as Record<string, unknown>).description as string | null ?? null,
          tos_url: (data as Record<string, unknown>).tos_url as string | null ?? null,
        }
      : null
  }

  const cp = coachProfile as Record<string, unknown> | null
  const brandName = cp?.brand_name as string | null
  const coachName =
    (cp?.first_name as string | null) ??
    (cp?.full_name as string | null) ??
    coachProfile?.email ??
    'your coach'
  const displayName = brandName ?? coachName
  const logoUrl = cp?.logo_url as string | null
  const brandColour = cp?.brand_colour as string | null

  return (
    <InviteFlow
      token={token}
      email={invite.email}
      displayName={displayName}
      coachName={coachName}
      logoUrl={logoUrl}
      brandColour={brandColour}
      service={service}
    />
  )
}

function InvalidInvite({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-8 text-center space-y-4">
        <p className="text-gray-700 font-medium">{message}</p>
        <a href="/dashboard" className="text-sm text-blue-600 hover:underline">Go to dashboard</a>
      </div>
    </div>
  )
}
