import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  // Use admin client so RLS on coach-managed tables doesn't block reads
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('checkin_schedules')
    .select('id, title, form_id, day_of_week, repeat_type, start_date')
    .eq('client_id', session.user.id)
    .eq('is_active', true)
    .not('form_id', 'is', null)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(data ?? [])
}
