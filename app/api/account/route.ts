import { createClient } from '@/lib/supabase/server'
import { deleteUserCompletely } from '@/lib/deleteUser'

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const { error } = await deleteUserCompletely(user.id)
  if (error) return Response.json({ error }, { status: 500 })

  return Response.json({ ok: true })
}
