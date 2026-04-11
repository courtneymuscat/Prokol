import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Use admin client — client_resource_access may not have an RLS policy for client reads
  const admin = createAdminClient()
  const { data } = await admin
    .from('client_resource_access')
    .select('id, assigned_at, coach_resources(id, name, description, type, url, coach_resource_folders(id, name, color, icon))')
    .eq('client_id', user.id)
    .order('assigned_at', { ascending: false })

  return Response.json(data ?? [])
}
