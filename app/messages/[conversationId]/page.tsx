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
    .select('email, full_name, brand_name')
    .eq('id', convo.coach_id)
    .single()

  // Same display-name precedence used for the coach's own branding
  // elsewhere (e.g. invite emails) — a coach's brand_name wins over their
  // personal full_name, which wins over falling back to their raw email.
  const otherName = profile?.brand_name ?? profile?.full_name ?? profile?.email ?? 'Your Coach'

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh' }}>
      <ChatView
        conversationId={conversationId}
        currentUserId={session.user.id}
        otherName={otherName}
        backHref="/messages"
        hasBottomNav={true}
      />
    </div>
  )
}
