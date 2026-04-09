import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('client_autoflows')
    .select(`
      id, name, start_date, status, created_at,
      autoflow_templates ( type, total_steps ),
      autoflow_responses ( step_number )
    `)
    .eq('client_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  return Response.json(data ?? [])
}
