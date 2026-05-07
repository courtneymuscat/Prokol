'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { acceptInvite } from '@/lib/coach'
import { STARTER_NOTE_TEMPLATES } from '@/lib/noteTemplates'
import { sendEmail, sendConfirmationEmail } from '@/lib/email'

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
  coach_solo:                { user_type: 'coach', subscription_tier: 'coach_solo' },
  coach_pt_solo:             { user_type: 'coach', subscription_tier: 'coach_pt_solo' },
  coach_nutritionist_solo:   { user_type: 'coach', subscription_tier: 'coach_nutritionist_solo' },
  coach_pro:                 { user_type: 'coach', subscription_tier: 'coach_pro' },
  coach_business:            { user_type: 'coach', subscription_tier: 'coach_business' },
}

export async function signup(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const invite = (formData.get('invite') as string) || null
  const orgInvite = (formData.get('org_invite') as string) || null
  const planKey = (formData.get('planKey') as string) || ''
  const billing = (formData.get('billing') as string) || 'monthly'
  const typeParam = (formData.get('userType') as string) || 'individual'

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.prokol.io'

  // For paid plans, the confirmation email should take the user straight to checkout
  // so they complete payment before getting any access. Free/invite flows go to onboarding.
  const isPaidPlan = !!(planKey && !FREE_PLANS.includes(planKey))
  const intendedType = PLAN_TO_PROFILE[planKey]?.user_type ?? typeParam
  const checkoutPath = isPaidPlan
    ? `/checkout?plan=${planKey}&billing=${billing}&type=${intendedType}`
    : null

  const emailRedirectTo = orgInvite
    ? `${origin}/auth/callback?next=${encodeURIComponent('/org/invite/' + orgInvite)}`
    : invite
    ? `${origin}/auth/callback?next=/dashboard`
    : checkoutPath
    ? `${origin}/auth/callback?next=${encodeURIComponent(checkoutPath)}`
    : `${origin}/auth/callback?next=/onboarding`

  // Use admin.generateLink instead of supabase.auth.signUp so that Supabase does NOT send
  // its own confirmation email — we send a fully branded Prokol email via Resend instead.
  const admin = createAdminClient()
  const { data: linkData, error } = await admin.auth.admin.generateLink({
    type: 'signup',
    email,
    password,
    options: { redirectTo: emailRedirectTo },
  })

  // generateLink returns an error when the user already exists
  const emailAlreadyExists =
    error?.code === 'user_already_exists' ||
    error?.message?.toLowerCase().includes('already registered') ||
    error?.message?.toLowerCase().includes('already exists')

  if (error && !emailAlreadyExists) {
    return { error: error.message }
  }


  if (emailAlreadyExists) {
    // If signing up via an invite, this is likely a ghost user pre-created by the coach.
    // Activate them by setting their password and confirming their email.
    if (invite) {
      const { data: ghostProfile } = await admin
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single()
      if (ghostProfile?.id) {
        const { data: { user: ghostUser } } = await admin.auth.admin.getUserById(ghostProfile.id)
        if (ghostUser) {
          // Set password regardless of whether email is confirmed.
          // If unconfirmed: also confirm now. If already confirmed (clicked Supabase
          // confirmation link first): just set the password so they can log in.
          const updatePayload = ghostUser.email_confirmed_at
            ? { password }
            : { password, email_confirm: true }
          await admin.auth.admin.updateUserById(ghostProfile.id, updatePayload)

          const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
          if (!signInErr && signInData.session?.user) {
            await admin.from('profiles').upsert(
              {
                id: signInData.session.user.id,
                email,
                role: 'client',
                user_type: 'individual',
                subscription_tier: 'individual_free',
                terms_accepted_at: new Date().toISOString(),
                terms_version: 'april_2026',
              },
              { onConflict: 'id' }
            )
            await acceptInvite(invite, signInData.session.user.id)
            redirect('/dashboard')
          }
          // Password was set via admin — sign-in may have failed due to propagation
          // delay. Redirect to login; the user can sign in immediately with their password.
          redirect(`/login?invite=${encodeURIComponent(invite)}&msg=account_ready`)
        }
      }
    }
    return { error: 'EMAIL_ALREADY_EXISTS' }
  }

  const user = linkData?.user ?? null
  if (user) {
    // Derive intended user_type and tier from planKey.
    const profileAttrs = PLAN_TO_PROFILE[planKey] ?? (
      typeParam === 'coach'
        ? { user_type: 'coach', subscription_tier: 'coach_solo' }
        : { user_type: 'individual', subscription_tier: 'individual_free' }
    )
    const intendedUserType = profileAttrs.user_type

    // For paid plans, always create the profile as individual_free.
    // Access is only granted after Stripe checkout succeeds (webhook / success page).
    // This prevents confirmation-email clicks granting paid access before payment.
    const profileTier = isPaidPlan ? 'individual_free' : profileAttrs.subscription_tier
    const profileUserType = isPaidPlan ? 'individual' : intendedUserType
    const profileRole = profileUserType === 'coach' ? 'coach' : 'client'

    // Use admin client so profile creation is never blocked by RLS
    await admin.from('profiles').upsert(
      {
        id: user.id,
        email: user.email,
        role: profileRole,
        user_type: profileUserType,
        subscription_tier: profileTier,
        terms_accepted_at: new Date().toISOString(),
        terms_version: 'april_2026',
      },
      { onConflict: 'id' }
    )
    // Pre-seed note templates for intended coaches (available immediately after payment)
    if (intendedUserType === 'coach') {
      await admin.from('note_templates').insert(
        STARTER_NOTE_TEMPLATES.map((t) => ({ coach_id: user.id, name: t.name, body: t.body }))
      )
    }
    if (invite) await acceptInvite(invite, user.id)

    // Send branded confirmation email via Resend (bypasses Supabase's default template)
    // Build the confirmation URL directly using hashed_token so the user's browser
    // doesn't need a PKCE code_verifier (which only exists when signUp() is called
    // client-side). Pointing straight at /auth/callback lets verifyOtp() handle it.
    const props = linkData?.properties as Record<string, unknown> | undefined
    const hashedToken = props?.hashed_token as string | null ?? null
    const nextParam = new URL(emailRedirectTo).searchParams.get('next') ?? '/dashboard'
    const confirmationLink = hashedToken
      ? `${origin}/auth/callback?token_hash=${hashedToken}&type=email&next=${encodeURIComponent(nextParam)}`
      : (props?.action_link as string | null ?? null)
    if (confirmationLink) {
      await sendConfirmationEmail(email, confirmationLink)
    }
  }

  // For paid plans, show the "check your inbox" screen with a next param so that
  // logging in manually after confirming also lands them on checkout.
  if (isPaidPlan && checkoutPath) {
    redirect(`/login?msg=verify_email&next=${encodeURIComponent(checkoutPath)}`)
  }

  // Email confirmation required — show "check your inbox" message on login page
  redirect('/login?msg=verify_email')
}

export async function login(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const invite = (formData.get('invite') as string) || null
  const next = (formData.get('next') as string) || null

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    const msg = error.message.toLowerCase().includes('invalid') || error.message.toLowerCase().includes('credentials')
      ? 'Incorrect email or password. If you\'re having trouble, use "Forgot password?" to reset it.'
      : error.message
    return { error: msg }
  }

  if (invite && data.session?.user) {
    await acceptInvite(invite, data.session.user.id)
    redirect('/dashboard')
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
      return { error: 'Your account has been suspended. Contact support at info@prokol.io' }
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
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // Generate the reset link via admin (no email sent by Supabase)
  // then send via Resend for reliable inbox delivery
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${origin}/reset-password` },
  })

  if (error) {
    // Silently succeed even if email not found — prevents email enumeration
    return { success: true }
  }

  const resetLink = data.properties.action_link

  await sendEmail({
    to: email,
    subject: 'Reset your Prokol password',
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;background:#fff;">
        <p style="font-size:22px;font-weight:700;color:#111;margin:0 0 8px;">Reset your password</p>
        <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 28px;">
          We received a request to reset the password for your Prokol account. Click the button below to choose a new one.
        </p>
        <a href="${resetLink}"
           style="display:inline-block;background:#F5C842;color:#111;font-weight:700;font-size:15px;text-decoration:none;padding:13px 28px;border-radius:10px;margin-bottom:28px;">
          Reset password
        </a>
        <p style="font-size:13px;color:#888;line-height:1.6;margin:0 0 24px;">
          This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password won't change.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:0 0 20px;" />
        <p style="font-size:12px;color:#bbb;margin:0;">
          Prokol Health &middot; <a href="${origin}" style="color:#bbb;text-decoration:none;">prokol.io</a>
        </p>
      </div>
    `,
  })

  return { success: true }
}

export async function resetPassword(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const password = formData.get('password') as string
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }
  redirect('/dashboard')
}
