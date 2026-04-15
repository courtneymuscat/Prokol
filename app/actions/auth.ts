'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { acceptInvite } from '@/lib/coach'
import { STARTER_NOTE_TEMPLATES } from '@/lib/noteTemplates'

type AuthState = { error?: string; success?: boolean } | null

const FREE_PLANS = ['', 'individual_tier_1']

// Canonical mapping: planKey → { user_type, subscription_tier }
const PLAN_TO_PROFILE: Record<string, { user_type: string; subscription_tier: string }> = {
  individual_tier_1:    { user_type: 'individual', subscription_tier: 'individual_free' },
  individual_tier_2:    { user_type: 'individual', subscription_tier: 'individual_optimiser' },
  individual_tier_3:    { user_type: 'individual', subscription_tier: 'individual_elite' },
  individual_free:      { user_type: 'individual', subscription_tier: 'individual_free' },
  individual_optimiser: { user_type: 'individual', subscription_tier: 'individual_optimiser' },
  individual_elite:     { user_type: 'individual', subscription_tier: 'individual_elite' },
  coach_solo:           { user_type: 'coach', subscription_tier: 'coach_solo' },
  coach_pro:            { user_type: 'coach', subscription_tier: 'coach_pro' },
  coach_business:       { user_type: 'coach', subscription_tier: 'coach_business' },
}

export async function signup(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const invite = (formData.get('invite') as string) || null
  const planKey = (formData.get('planKey') as string) || ''
  const billing = (formData.get('billing') as string) || 'monthly'
  const typeParam = (formData.get('userType') as string) || 'individual'

  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) return { error: error.message }

  // data.user is set even when email confirmation is required; data.session may be null
  const user = data.session?.user ?? data.user
  if (user) {
    // Derive user_type and subscription_tier from planKey.
    // Fall back to the ?type param: coach → coach_solo, anything else → individual_free.
    const profileAttrs = PLAN_TO_PROFILE[planKey] ?? (
      typeParam === 'coach'
        ? { user_type: 'coach', subscription_tier: 'coach_solo' }
        : { user_type: 'individual', subscription_tier: 'individual_free' }
    )
    const resolvedUserType = profileAttrs.user_type
    const resolvedTier = profileAttrs.subscription_tier

    // Use admin client so profile creation is never blocked by RLS
    const admin = createAdminClient()
    await admin.from('profiles').upsert(
      {
        id: user.id,
        email: user.email,
        role: resolvedUserType === 'coach' ? 'coach' : 'client',
        user_type: resolvedUserType,
        subscription_tier: resolvedTier,
      },
      { onConflict: 'id' }
    )
    if (resolvedUserType === 'coach') {
      await admin.from('note_templates').insert(
        STARTER_NOTE_TEMPLATES.map((t) => ({ coach_id: user.id, name: t.name, body: t.body }))
      )
    }
    if (invite) await acceptInvite(invite, user.id)
  }

  // If a paid plan was selected, redirect to Stripe checkout.
  // Only go directly to /checkout if we have a live session (email confirmation off).
  // If email confirmation is on, data.session is null — send to login with a next param
  // so that after they confirm + log in, they land on checkout automatically.
  if (planKey && !FREE_PLANS.includes(planKey)) {
    const resolvedType = PLAN_TO_PROFILE[planKey]?.user_type ?? typeParam
    const checkoutPath = `/checkout?plan=${planKey}&billing=${billing}&type=${resolvedType}`
    if (data.session) {
      redirect(checkoutPath)
    } else {
      redirect(`/login?next=${encodeURIComponent(checkoutPath)}`)
    }
  }

  if (invite) {
    redirect('/onboarding/coached')
  }

  redirect('/onboarding')
}

export async function login(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const invite = (formData.get('invite') as string) || null
  const next = (formData.get('next') as string) || null

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }

  if (invite && data.session?.user) {
    await acceptInvite(invite, data.session.user.id)
    redirect('/onboarding/coached')
  }

  if (next) redirect(next)

  // Check if onboarding has been completed
  if (data.session?.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_completed, user_type, subscription_tier, is_suspended, suspended_reason')
      .eq('id', data.session.user.id)
      .single()

    // Suspended accounts cannot log in
    if (profile?.is_suspended) {
      await supabase.auth.signOut()
      return { error: 'Your account has been suspended. Contact support at support@prokol.io' }
    }

    // Profile missing (signup completed but profile creation failed) — create it now
    if (!profile) {
      const admin = createAdminClient()
      await admin.from('profiles').upsert(
        { id: data.session.user.id, email: data.session.user.email, user_type: 'individual', role: 'client' },
        { onConflict: 'id' }
      )
      redirect('/onboarding')
    }

    if (!profile.onboarding_completed) {
      if (profile.subscription_tier === 'coached') {
        redirect('/onboarding/coached')
      }
      redirect('/onboarding')
    }
  }

  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function forgotPassword(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get('email') as string
  const supabase = await createClient()
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  })
  if (error) return { error: error.message }
  return { success: true }
}

export async function resetPassword(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const password = formData.get('password') as string
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }
  redirect('/dashboard')
}
