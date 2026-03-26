import { redirect } from 'next/navigation'
import { requireCoach } from '@/lib/coach'
import { createClient } from '@/lib/supabase/server'
import ClientTabs from './ClientTabs'
import MessageButton from './MessageButton'
import RemoveClientButton from './RemoveClientButton'

export default async function ClientProfilePage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) redirect('/dashboard')

  const supabase = await createClient()

  const { data: rel } = await supabase
    .from('coach_clients')
    .select('accepted_at')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .single()

  if (!rel) redirect('/coach/clients')

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, subscription_tier')
    .eq('id', clientId)
    .single()

  const tierLabel: Record<string, string> = { tier_1: 'Free', tier_2: 'Pro', tier_3: 'Elite', coached: 'Coached' }
  const tierColor: Record<string, string> = {
    tier_1: 'bg-gray-100 text-gray-500',
    tier_2: 'bg-blue-100 text-blue-600',
    tier_3: 'bg-purple-100 text-purple-600',
    coached: 'bg-green-100 text-green-600',
  }
  const tier = profile?.subscription_tier ?? 'tier_1'

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
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-bold text-blue-600">
              {(profile?.email ?? '?')[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-gray-900 truncate">{profile?.email ?? 'Client'}</h1>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tierColor[tier]}`}>
                {tierLabel[tier]}
              </span>
            </div>
            {rel.accepted_at && (
              <p className="text-xs text-gray-400 mt-0.5">
                Client since {new Date(rel.accepted_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <RemoveClientButton clientId={clientId} />
            <MessageButton coachId={coachId} clientId={clientId} />
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 max-w-4xl w-full">
        <ClientTabs clientId={clientId} />
      </div>
    </main>
  )
}
