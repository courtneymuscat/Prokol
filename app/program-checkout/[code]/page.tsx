import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe'

// One-time-payment counterpart to app/checkout/page.tsx (which only ever
// creates mode: 'subscription' sessions) — for a priced org_signup_links
// row (a coach-sold program, see lib/coach.ts's acceptOrgSignupLink).
// Reached via the same post-email-confirmation redirect mechanism already
// used for paid platform plans (app/actions/auth.ts's checkoutPath), not a
// new flow of its own.
export default async function ProgramCheckoutPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params

  const supabase = await createClient()
  // getUser() rather than getSession() — same reasoning as app/checkout/page.tsx:
  // a stale cookie-derived session's user.id can end up empty in metadata,
  // and the webhook can't link the resulting payment back to a profile.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.id) {
    redirect(`/login?next=${encodeURIComponent(`/program-checkout/${code}`)}`)
  }

  const admin = createAdminClient()
  const { data: link } = await admin
    .from('org_signup_links')
    .select('id, is_active, price_cents, currency')
    .eq('code', code)
    .maybeSingle()

  if (!link || !link.is_active || !link.price_cents) {
    redirect(`/org/join/${code}`)
  }

  const { data: linkAutoflow } = await admin
    .from('org_signup_link_autoflows')
    .select('autoflow_id')
    .eq('link_id', link.id)
    .limit(1)
    .maybeSingle()
  const { data: autoflow } = linkAutoflow
    ? await admin.from('autoflow_templates').select('name').eq('id', linkAutoflow.autoflow_id).maybeSingle()
    : { data: null }

  const stripe = getStripe()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: user.email!,
    line_items: [
      {
        price_data: {
          currency: link.currency,
          unit_amount: link.price_cents,
          product_data: { name: autoflow?.name ?? 'Program' },
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId: user.id,
      signupLinkCode: code,
    },
    success_url: `${baseUrl}/dashboard?purchased=1`,
    cancel_url: `${baseUrl}/org/join/${code}`,
  })

  redirect(checkoutSession.url!)
}
