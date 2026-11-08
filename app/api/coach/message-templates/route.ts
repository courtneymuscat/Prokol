import { NextRequest, NextResponse } from 'next/server'
import { requireCoach } from '@/lib/coach'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateMessageTemplates } from '@/lib/checkinMessages'
import { FLAG_CATEGORY_PRIORITY } from '@/lib/checkinFlags'

export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const templates = await getOrCreateMessageTemplates(admin, coachId)
  return NextResponse.json(templates)
}

export async function PUT(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    urgent_template?: string
    urgent_enabled?: boolean
    normal_template?: string
    lead_template?: string
    category_snippets?: Record<string, { reason?: string; tip?: string }>
    custom_categories?: { id?: string; label?: string }[]
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.urgent_template === 'string') patch.urgent_template = body.urgent_template
  if (typeof body.urgent_enabled === 'boolean') patch.urgent_enabled = body.urgent_enabled
  if (typeof body.normal_template === 'string') patch.normal_template = body.normal_template
  if (typeof body.lead_template === 'string') patch.lead_template = body.lead_template

  // Custom categories — ids must look like the slug this route generates
  // client-side (lowercase, alnum + underscore) so a tampered request
  // can't smuggle arbitrary jsonb keys in.
  let customCategories: { id: string; label: string }[] = []
  if (Array.isArray(body.custom_categories)) {
    customCategories = body.custom_categories
      .filter((c): c is { id: string; label: string } => typeof c?.id === 'string' && typeof c?.label === 'string' && /^[a-z0-9_]+$/.test(c.id) && c.label.trim().length > 0)
      .map((c) => ({ id: c.id, label: c.label.trim() }))
    patch.custom_categories = customCategories
  }

  if (body.category_snippets && typeof body.category_snippets === 'object') {
    const allowedIds = new Set([...FLAG_CATEGORY_PRIORITY, ...customCategories.map((c) => c.id)])
    const clean: Record<string, { reason: string; tip: string }> = {}
    for (const id of allowedIds) {
      const snippet = body.category_snippets[id]
      if (snippet && (typeof snippet.reason === 'string' || typeof snippet.tip === 'string')) {
        clean[id] = { reason: snippet.reason ?? '', tip: snippet.tip ?? '' }
      }
    }
    patch.category_snippets = clean
  }

  const admin = createAdminClient()
  // Make sure the row exists first (first save before any GET — unlikely
  // but cheap to guard against).
  await getOrCreateMessageTemplates(admin, coachId)
  const { error } = await admin
    .from('coach_message_templates')
    .update(patch)
    .eq('coach_id', coachId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
