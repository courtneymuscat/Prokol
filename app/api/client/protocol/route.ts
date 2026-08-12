import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('client_protocol')
    .select('sections')
    .eq('client_id', session.user.id)
    .maybeSingle()

  const allSections = Array.isArray(data?.sections) ? data.sections : []
  const visible = allSections.filter((s: Record<string, unknown>) => !s.hidden)
  return Response.json({ sections: visible })
}
