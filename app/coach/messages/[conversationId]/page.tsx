import { requireCoach } from '@/lib/coach'
import { createClient } from '@/lib/supabase/server'
import { getOrgForUser } from '@/lib/org'
import { redirect } from 'next/navigation'
import ChatView from '@/app/components/ChatView'

export default async function CoachChatPage({
  params,
}: {
  params: Promise<{ conversationId: string }>
}) {
  const { conversationId } = await params
  const coachId = await requireCoach()
  if (!coachId) redirect('/dashboard')

  const supabase = await createClient()

  const { data: convo } = await supabase
    .from('conversations')
    .select('id, client_id')
    .eq('id', conversationId)
    .eq('coach_id', coachId)
    .single()

  if (!convo) redirect('/coach/messages')

  // conversations has no org_id column — a coach who owns more than one
  // org (gym org-switching) is still the same coach_id in every one of
  // them, so a direct URL visit to a conversation from a different org
  // must be blocked by checking the client actually belongs to the
  // currently active org via coach_clients.
  const membership = await getOrgForUser(coachId)
  if (membership) {
    const { data: rel } = await supabase
      .from('coach_clients')
      .select('client_id')
      .eq('coach_id', coachId)
      .eq('client_id', convo.client_id)
      .eq('org_id', membership.org_id)
      .maybeSingle()
    if (!rel) redirect('/coach/messages')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name, first_name')
    .eq('id', convo.client_id)
    .single()

  const otherName = profile?.full_name ?? profile?.first_name ?? profile?.email ?? 'Client'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ChatView
        conversationId={conversationId}
        currentUserId={coachId}
        otherName={otherName}
        backHref="/coach/messages"
        showBackOnDesktop={false}
      />
    </div>
  )
}
