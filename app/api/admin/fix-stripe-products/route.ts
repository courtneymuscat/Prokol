import { requirePlatformAdmin } from '@/lib/admin'
import { getStripe } from '@/lib/stripe'
import { INCLUDED_SEATS, CLIENT_OVERAGE_PRICE } from '@/lib/billing'

const PLAN_LABELS: Record<string, string> = {
  coach_solo:              'Coach Solo',
  coach_pt_solo:           'Coach Solo (PT)',
  coach_nutritionist_solo: 'Coach Solo (Nutritionist)',
  coach_pro:               'Coach Pro',
  coach_business:          'Coach Business',
}

// All coach plan keys that have an overage price env var
const COACH_OVERAGE_PLANS = [
  'coach_solo',
  'coach_pt_solo',
  'coach_nutritionist_solo',
  'coach_pro',
  'coach_business',
]

export async function POST() {
  const adminId = await requirePlatformAdmin()
  if (!adminId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const stripe = getStripe()
  const results: { plan: string; status: string; name?: string }[] = []

  for (const plan of COACH_OVERAGE_PLANS) {
    const envKey = `STRIPE_PRICE_${plan.toUpperCase()}_OVERAGE`
    const priceId = process.env[envKey]

    if (!priceId) {
      results.push({ plan, status: 'skipped — no env var' })
      continue
    }

    try {
      const price = await stripe.prices.retrieve(priceId, { expand: ['product'] })
      const product = price.product as { id: string; name: string; active: boolean }

      if (!product?.active) {
        results.push({ plan, status: 'skipped — product inactive' })
        continue
      }

      const includedSeats = INCLUDED_SEATS[plan] ?? 0
      const overageRate = CLIENT_OVERAGE_PRICE[plan] ?? 0
      const planLabel = PLAN_LABELS[plan] ?? plan
      const newName = `Extra clients — A$${overageRate}/client/month`
      const newDescription = `${planLabel} includes ${includedSeats} clients. Each additional client beyond ${includedSeats} is charged at A$${overageRate}/month, added automatically to the next invoice.`

      await stripe.products.update(product.id, {
        name: newName,
        description: newDescription,
      })

      results.push({ plan, status: 'updated', name: newName })
    } catch (err) {
      results.push({ plan, status: `error: ${err instanceof Error ? err.message : String(err)}` })
    }
  }

  return Response.json({ ok: true, results })
}
