import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PATH_KEYS } from '@/lib/autoflowPaths'
import type { NextRequest } from 'next/server'

// PUT /api/client/autoflows/[flowId]/path — lets a client change their
// path on this flow anytime (e.g. Foundations' Plan & Swap / Track
// Serves / Protein + Calories). Uses the admin client to write — a
// client has no UPDATE permission on client_autoflows under RLS (only
// the coach does) — but only after confirming this flow is actually
// theirs via the session-scoped select below.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ flowId: string }> }) {
  const { flowId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: flow } = await supabase
    .from('client_autoflows')
    .select('id')
    .eq('id', flowId)
    .eq('client_id', user.id)
    .single()
  if (!flow) return Response.json({ error: 'Not found' }, { status: 404 })

  const { path } = await req.json()
  if (!PATH_KEYS.includes(path)) return Response.json({ error: 'Invalid path' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('client_autoflows').update({ selected_path: path }).eq('id', flowId)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
