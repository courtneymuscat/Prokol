import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChatView from '@/app/components/ChatView'

export default async function ClientChatPage({
  params,
}: {
  params: Promise<{ conversationId: string }>
}) {
  const { conversationId } = await params
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: convo } = await supabase
    .from('conversations')
    .select('id, coach_id')
    .eq('id', conversationId)
    .eq('client_id', session.user.id)
    .single()

  if (!convo) redirect('/messages')

  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', convo.coach_id)
    .single()

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh' }}>
      <ChatView
        conversationId={conversationId}
        currentUserId={session.user.id}
        otherEmail={profile?.email ?? 'Your Coach'}
        backHref="/messages"
        hasBottomNav={true}
      />
    </div>
  )
}
