import { createClient } from '@/lib/supabase/server'
import CoachSidebar from './CoachSidebar'

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  let unread = 0
  let unreadMessages = 0
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const [formsResult, convosResult] = await Promise.all([
        supabase
          .from('form_submissions')
          .select('id', { count: 'exact', head: true })
          .eq('coach_id', session.user.id)
          .eq('viewed_by_coach', false),
        supabase
          .from('conversations')
          .select('id')
          .eq('coach_id', session.user.id),
      ])
      unread = formsResult.count ?? 0

      const convoIds = (convosResult.data ?? []).map((c) => c.id)
      if (convoIds.length) {
        const { count } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .in('conversation_id', convoIds)
          .neq('sender_id', session.user.id)
          .is('read_at', null)
        unreadMessages = count ?? 0
      }
    }
  } catch {
    // silently fall back to 0
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <CoachSidebar unreadCount={unread} unreadMessages={unreadMessages} />
      <div className="flex-1 min-w-0 flex flex-col">
        {children}
      </div>
    </div>
  )
}
