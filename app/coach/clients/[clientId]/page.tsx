import { redirect } from 'next/navigation'
import { requireCoach } from '@/lib/coach'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ClientTabs from './ClientTabs'
import MessageButton from './MessageButton'
import RemoveClientButton from './RemoveClientButton'
import CopyInviteLink from './CopyInviteLink'
import RevokeInviteButton from './RevokeInviteButton'

export default async function ClientProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { clientId } = await params
  const sp = await searchParams
  const initialTab = (typeof sp.tab === 'string' ? sp.tab : 'overview') as string
  const coachId = await requireCoach()
  if (!coachId) redirect('/dashboard')

  const supabase = await createClient()

  const { data: rel } = await supabase
    .from('coach_clients')
    .select('accepted_at, status')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .in('status', ['active', 'archived', 'pending_invite'])
    .single()

  if (!rel) redirect('/coach/clients')

  // Use admin client to bypass RLS — coach-client relationship already verified above
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('email, subscription_tier, timezone, full_name, date_of_birth, phone')
    .eq('id', clientId)
    .single()

  // If invite pending, fetch the invite link so coach can resend/copy it
  let inviteUrl: string | null = null
  let inviteToken: string | null = null
  if (rel.status === 'pending_invite' && profile?.email) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const { data: inv } = await admin
      .from('coach_invites')
      .select('token')
      .eq('coach_id', coachId)
      .eq('email', profile.email)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (inv?.token) {
      inviteToken = inv.token
      inviteUrl = `${baseUrl}/invite/${inv.token}`
    }
  }

  const tierLabel: Record<string, string> = {
    individual_free:      'Free',
    individual_optimiser: 'Optimiser',
    individual_elite:     'Elite',
    coached:              'Coached',
    coach_solo:           'Solo',
    coach_pro:            'Pro',
    coach_business:       'Business',
  }
  const tierColor: Record<string, string> = {
    individual_free:      'bg-gray-100 text-gray-500',
    individual_optimiser: 'bg-blue-100 text-blue-600',
    individual_elite:     'bg-purple-100 text-purple-600',
    coached:              'bg-green-100 text-green-600',
    coach_solo:           'bg-gray-100 text-gray-500',
    coach_pro:            'bg-blue-100 text-blue-600',
    coach_business:       'bg-indigo-100 text-indigo-600',
  }
  const tier = profile?.subscription_tier ?? 'individual_free'

  return (
    <main className="flex-1 flex flex-col min-h-0">
      {/* Profile header */}
      <div className="bg-white border-b px-6 py-5">
        <div className="max-w-4xl w-full flex items-center gap-4">
          <a href="/coach/clients" className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          {(() => {
            const displayName = (profile as Record<string, unknown>)?.full_name as string | null
            const initial = displayName ? displayName[0].toUpperCase() : (profile?.email ?? '?')[0].toUpperCase()
            const dob = (profile as Record<string, unknown>)?.date_of_birth as string | null
            const phone = (profile as Record<string, unknown>)?.phone as string | null
            const age = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null
            return (
              <>
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-bold text-blue-600">{initial}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg font-bold text-gray-900 truncate">
                      {displayName ?? profile?.email ?? 'Client'}
                    </h1>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tierColor[tier]}`}>
                      {tierLabel[tier]}
                    </span>
                    {rel.status === 'archived' && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                        Archived
                      </span>
                    )}
                    {rel.status === 'pending_invite' && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                        Invite pending
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap mt-0.5">
                    <p className="text-xs text-gray-400">{profile?.email}</p>
                    {phone && <p className="text-xs text-gray-400">{phone}</p>}
                    {age !== null && <p className="text-xs text-gray-400">Age {age}</p>}
                    {rel.accepted_at && (
                      <p className="text-xs text-gray-400">
                        Client since {new Date(rel.accepted_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </p>
                    )}
                    {profile?.timezone && (
                      <p className="text-xs text-gray-400">
                        🕐 {profile.timezone.replace(/_/g, ' ')}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )
          })()}
          {rel.status === 'active' && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <RemoveClientButton clientId={clientId} />
              <MessageButton coachId={coachId} clientId={clientId} />
            </div>
          )}
        </div>
      </div>

      {rel.status === 'pending_invite' && inviteUrl && inviteToken && (
        <InvitePendingBanner inviteUrl={inviteUrl} token={inviteToken} />
      )}

      <div className="flex-1 p-6 max-w-4xl w-full">
        <ClientTabs clientId={clientId} initialTab={initialTab} />
      </div>
    </main>
  )
}

function InvitePendingBanner({ inviteUrl, token }: { inviteUrl: string; token: string }) {
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
      <div className="max-w-4xl w-full flex items-center gap-3 flex-wrap">
        <p className="text-sm text-amber-800 flex-1">
          This client hasn&apos;t accepted their invite yet. You can start building their profile now.
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <input
            readOnly
            value={inviteUrl}
            className="text-xs border border-amber-200 bg-white rounded-lg px-3 py-1.5 text-amber-700 w-64 truncate focus:outline-none"
          />
          <CopyInviteLink url={inviteUrl} />
          <RevokeInviteButton token={token} />
        </div>
      </div>
    </div>
  )
}

