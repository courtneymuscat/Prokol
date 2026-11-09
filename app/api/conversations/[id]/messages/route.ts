import { createClient } from '@/lib/supabase/server'
import { sendPushToUser } from '@/lib/push'
import type { NextRequest } from 'next/server'

async function verifyAccess(supabase: Awaited<ReturnType<typeof createClient>>, conversationId: string, userId: string) {
  const { data } = await supabase
    .from('conversations')
    .select('id, coach_id, client_id')
    .eq('id', conversationId)
    .or(`coach_id.eq.${userId},client_id.eq.${userId}`)
    .single()
  return data
}

/** GET — fetch messages for a conversation */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  if (!(await verifyAccess(supabase, id, session.user.id))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: messages } = await supabase
    .from('messages')
    .select('id, sender_id, body, created_at, read_at, attachment_url, attachment_type, is_automated')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })
    .limit(100)

  return Response.json(messages ?? [])
}

/** POST — send a message */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const convo = await verifyAccess(supabase, id, session.user.id)
  if (!convo) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { body, attachment_url, attachment_type } = await req.json()
  if (!body?.trim() && !attachment_url) return Response.json({ error: 'Message body or attachment required' }, { status: 400 })

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: id,
      sender_id: session.user.id,
      body: body?.trim() ?? '',
      ...(attachment_url ? { attachment_url, attachment_type } : {}),
    })
    .select('id, sender_id, body, created_at, read_at, attachment_url, attachment_type')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Update last_message_at on conversation
  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', id)

  // Push notification to the recipient
  const recipientId = session.user.id === convo.coach_id ? convo.client_id : convo.coach_id
  if (recipientId) {
    // Get sender name for notification body
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('first_name, full_name')
      .eq('id', session.user.id)
      .single()
    const senderName = senderProfile?.first_name ?? senderProfile?.full_name ?? 'Someone'
    const preview = body?.trim()
      ? body.trim().slice(0, 80) + (body.trim().length > 80 ? '…' : '')
      : 'Sent an attachment'

    const isRecipientCoach = recipientId === convo.coach_id
    const notifUrl = isRecipientCoach
      ? `/coach/messages/${id}`
      : `/messages/${id}`

    sendPushToUser(recipientId, {
      title: senderName,
      body: preview,
      url: notifUrl,
      icon: '/icons/icon-192.png',
      tag: `message-${id}`,
    }).catch(() => {/* silent */})
  }

  return Response.json(message, { status: 201 })
}
