import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'

// Lets the recipe editor's "Publish to platform" toggle decide whether to
// render itself — same invisible-unless-authorized pattern as
// ProgramLinkPanel.tsx (fetch, check the status, render nothing on a
// non-200). The real authorization boundary is server-side in the
// POST/PATCH routes, which silently drop is_global for anyone but
// platform_admin regardless of what this endpoint or the client renders.
export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = await createClient()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', coachId).single()
  if (profile?.role !== 'platform_admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  return Response.json({ isPlatformAdmin: true })
}
