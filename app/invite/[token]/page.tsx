import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { acceptInvite } from '@/lib/coach'

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  // Look up invite via admin client — unauthenticated users can't read coach_invites via RLS
  const { data: invite } = await admin
    .from('coach_invites')
    .select('id, email, status, expires_at, coach_id')
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

  // Get coach profile
  const { data: coachProfile } = await admin
    .from('profiles')
    .select('email, brand_name, full_name')
    .eq('id', invite.coach_id)
    .single()

  // If already logged in and NOT the coach who sent this invite — handle redirect
  const { data: { session } } = await supabase.auth.getSession()
  if (session && session.user.id !== invite.coach_id) {
    if (invite.status === 'accepted') {
      // Link already used — check if this logged-in user is the enrolled client
      const { data: rel } = await supabase
        .from('coach_clients')
        .select('id')
        .eq('coach_id', invite.coach_id)
        .eq('client_id', session.user.id)
        .single()
      // If they're already in coach_clients, send them back to where they left off
      if (rel) redirect('/onboarding/coached')
    } else {
      await acceptInvite(token, session.user.id)
      redirect('/onboarding/coached')
    }
  }

  // Invite already accepted and user not logged in — prompt them to log in to resume
  if (invite.status === 'accepted') {
    const coachEmail = coachProfile?.email ?? 'your coach'
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-8 space-y-6 text-center">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Resume your onboarding</h1>
            <p className="text-gray-500 mt-2 text-sm">
              Log in to continue where you left off with{' '}
              <span className="font-medium text-gray-700">{coachEmail}</span>.
            </p>
          </div>
          <a
            href={`/login?next=/onboarding/coached`}
            className="block w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Log in to continue
          </a>
        </div>
      </div>
    )
  }

  const brandName = (coachProfile as Record<string, unknown>)?.brand_name as string | null
  const displayName = brandName ?? (coachProfile as Record<string, unknown>)?.full_name as string | null ?? coachProfile?.email ?? 'your coach'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-8 space-y-6 text-center">
        <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">You&apos;re invited!</h1>
          <p className="text-gray-500 mt-2 text-sm">
            <span className="font-medium text-gray-700">{displayName}</span> has invited you to join their coaching roster on Prokol.
          </p>
        </div>

        <div className="space-y-3">
          <a
            href={`/signup?invite=${token}`}
            className="block w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Create an account
          </a>
          <a
            href={`/login?invite=${token}`}
            className="block w-full border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            I already have an account
          </a>
        </div>

        <p className="text-xs text-gray-400">
          This invite was sent to {invite.email}. It expires in 7 days.
        </p>
      </div>
    </div>
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
