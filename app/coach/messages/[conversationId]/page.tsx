import { requireCoach } from '@/lib/coach'
import { createClient } from '@/lib/supabase/server'
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', convo.client_id)
    .single()

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ChatView
        conversationId={conversationId}
        currentUserId={coachId}
        otherEmail={profile?.email ?? 'Client'}
        backHref="/coach/messages"
        showBackOnDesktop={false}
      />
    </div>
  )
}
