import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe, OVERAGE_PRICE_IDS } from '@/lib/stripe'
import { resolveTierFromPrice, syncProfileFromStripe } from '@/lib/billing'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * GET /api/admin/stripe-debug-user?email=info@betteru.net.au
 *
 * Shows the full picture for a given user:
 *  - Their profile row
 *  - Their Stripe customer (looked up by stored id OR by email)
 *  - Every subscription they have, with status + the tier it resolves to
 *  - Recent checkout sessions for that customer (last 10), with metadata
 *    and what tier each one's price would map to
 *  - The most recent `checkout.session.completed` events that mention
 *    them, so we can see what the webhook actually received
 *
 * Run this after a failed sign-up to find out exactly where the chain broke.
 *
 * Auth: profiles.role in ('admin', 'platform_admin') OR ADMIN_EMAILS env.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const admin = createAdminClient()
  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role, email')
    .eq('id', session.user.id)
    .single()
  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const adminRoles = new Set(['admin', 'platform_admin'])
  const isAdmin = adminRoles.has(callerProfile?.role ?? '') || adminEmails.includes(callerProfile?.email as string)
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email query param required' }, { status: 400 })

  const stripe = getStripe()
  const out: Record<string, unknown> = { email, stripe_mode: (process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_live_') ? 'live' : 'test' }

  // 1. Profile
  const { data: profile } = await admin
    .from('profiles')
    .select('id, email, user_type, subscription_tier, stripe_customer_id, stripe_subscription_id, role, org_id, coach_grace_until, created_at')
    .ilike('email', email)
    .maybeSingle()
  out.profile = profile ?? null

  // 2. Stripe customer (by stored id, then by email)
  let customer: { id: string; email: string | null } | null = null
  if (profile?.stripe_customer_id) {
    try {
      const cust = await stripe.customers.retrieve(profile.stripe_customer_id as string)
      if (!('deleted' in cust) || !cust.deleted) {
        customer = { id: cust.id, email: (cust as { email: string | null }).email }
      }
    } catch { /* fall through to email lookup */ }
  }
  if (!customer) {
    try {
      const list = await stripe.customers.list({ email, limit: 5 })
      if (list.data.length) customer = { id: list.data[0].id, email: list.data[0].email }
      out.stripe_customers_matching_email = list.data.map((c) => ({ id: c.id, created: c.created }))
    } catch (err) {
      out.stripe_customer_lookup_error = err instanceof Error ? err.message : String(err)
    }
  }
  out.stripe_customer = customer

  if (customer) {
    // 3. Subscriptions for the customer
    try {
      const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 10, expand: ['data.items.data.price.product'] })
      out.subscriptions = await Promise.all(subs.data.map(async (s) => {
        const flat = s.items.data.find((i) => !OVERAGE_PRICE_IDS.has(i.price.id))
        const tier = await resolveTierFromPrice(flat?.price)
        return {
          id: s.id,
          status: s.status,
          created: new Date(s.created * 1000).toISOString(),
          cancel_at_period_end: s.cancel_at_period_end,
          trial_end: s.trial_end ? new Date(s.trial_end * 1000).toISOString() : null,
          flat_price_id: flat?.price?.id ?? null,
          flat_product_id: typeof flat?.price?.product === 'string' ? flat.price.product : flat?.price?.product?.id ?? null,
          flat_product_name: typeof flat?.price?.product === 'object' ? (flat?.price?.product as { name?: string }).name : null,
          flat_product_metadata: typeof flat?.price?.product === 'object' ? (flat?.price?.product as { metadata?: Record<string, string> }).metadata : null,
          resolved_tier: tier ?? null,
          metadata: s.metadata,
        }
      }))
    } catch (err) {
      out.subscriptions_error = err instanceof Error ? err.message : String(err)
    }

    // 4. Recent checkout sessions for the customer
    try {
      const sessions = await stripe.checkout.sessions.list({ customer: customer.id, limit: 10 })
      out.checkout_sessions = sessions.data.map((s) => ({
        id: s.id,
        status: s.status,
        payment_status: s.payment_status,
        mode: s.mode,
        created: new Date(s.created * 1000).toISOString(),
        subscription_id: s.subscription,
        metadata: s.metadata,
      }))
    } catch (err) {
      out.checkout_sessions_error = err instanceof Error ? err.message : String(err)
    }

    // 5. Recent webhook events for this customer (search by customer id in event data)
    try {
      const events = await stripe.events.list({ type: 'checkout.session.completed', limit: 10 })
      out.recent_checkout_completed_events = events.data
        .filter((e) => {
          const obj = e.data.object as { customer?: string }
          return obj.customer === customer.id
        })
        .map((e) => ({
          id: e.id,
          created: new Date(e.created * 1000).toISOString(),
          object_id: (e.data.object as { id: string }).id,
          object_metadata: (e.data.object as { metadata?: Record<string, string> }).metadata,
        }))
    } catch (err) {
      out.events_error = err instanceof Error ? err.message : String(err)
    }
  }

  // 6. Optionally run the same reconcile the dashboard runs, and report the
  //    actual result + any error. Visit with &run_sync=1 to both fix the user
  //    AND see what syncProfileFromStripe returns.
  if (req.nextUrl.searchParams.get('run_sync') === '1' && profile?.id) {
    try {
      const result = await syncProfileFromStripe(profile.id as string)
      out.sync_result = result
      const { data: postProfile } = await admin
        .from('profiles')
        .select('user_type, subscription_tier, stripe_customer_id, stripe_subscription_id')
        .eq('id', profile.id as string)
        .single()
      out.profile_after_sync = postProfile
    } catch (err) {
      out.sync_error = err instanceof Error ? err.message : String(err)
      out.sync_stack = err instanceof Error ? err.stack : undefined
    }
  }

  return NextResponse.json(out, { status: 200 })
}
