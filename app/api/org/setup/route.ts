import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { slugify } from '@/lib/org'
import type { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const userId = session.user.id
  const admin = createAdminClient()

  // Must be on coach_business tier
  const { data: profile } = await admin
    .from('profiles')
    .select('subscription_tier, org_id')
    .eq('id', userId)
    .single()

  if (profile?.subscription_tier !== 'coach_business') {
    return Response.json({ error: 'Requires coach_business subscription' }, { status: 403 })
  }

  if (profile?.org_id) {
    return Response.json({ error: 'Organisation already set up' }, { status: 409 })
  }

  const { name } = await req.json() as { name: string }
  if (!name?.trim()) return Response.json({ error: 'Organisation name is required' }, { status: 400 })

  // Generate a unique slug
  let slug = slugify(name.trim())
  const { data: existing } = await admin
    .from('organisations')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existing) {
    // Append random 4-char suffix to avoid collision
    slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`
  }

  // Create organisation
  const { data: org, error: orgError } = await admin
    .from('organisations')
    .insert({
      name: name.trim(),
      slug,
      owner_id: userId,
      subscription_tier: 'org_enterprise',
    })
    .select('id, slug')
    .single()

  if (orgError || !org) {
    return Response.json({ error: orgError?.message ?? 'Failed to create organisation' }, { status: 500 })
  }

  // Create owner membership
  await admin.from('org_members').insert({
    org_id: org.id,
    user_id: userId,
    role: 'owner',
    accepted_at: new Date().toISOString(),
    is_active: true,
  })

  // Update coach profile — keep user_type as 'coach', only set org_id
  await admin.from('profiles').update({
    org_id: org.id,
  }).eq('id', userId)

  return Response.json({ org_id: org.id, slug: org.slug })
}
