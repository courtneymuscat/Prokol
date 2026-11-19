import { createClient } from '@/lib/supabase/server'

// GET /api/client/messages/unread-count — lean count for the bottom-nav
// Messages badge (see ClientBottomNav.tsx). Deliberately separate from
// /api/client/messages/list, which also fetches profiles and latest
// message previews for the full inbox view — overkill for a nav badge
// that polls on every page.
export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ count: 0 })

  const { data: convos } = await supabase
    .from('conversations')
    .select('id')
    .eq('client_id', session.user.id)
  const convoIds = (convos ?? []).map((c) => c.id)
  if (!convoIds.length) return Response.json({ count: 0 })

  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .in('conversation_id', convoIds)
    .neq('sender_id', session.user.id)
    .is('read_at', null)

  return Response.json({ count: count ?? 0 })
}
