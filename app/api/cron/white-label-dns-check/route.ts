import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { attemptDomainVerification } from '@/lib/whitelabel'
import { sendEmail } from '@/lib/email'

/**
 * Runs once a day via Vercel Cron (Hobby plan caps cron frequency at daily —
 * same constraint as app/api/cron/push-reminders/route.ts). Finds every
 * white-label org whose custom domain hasn't verified yet, retries DNS
 * verification, and emails the owner the moment it goes live — so going
 * live on a custom domain no longer depends on the org owner remembering to
 * come back and click "Check DNS" themselves. The manual button still
 * exists for anyone who wants to confirm immediately rather than wait for
 * the next daily run.
 *
 * Secured by CRON_SECRET, same pattern as push-reminders.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const supabase = createServiceClient()
  let checked = 0
  let verified = 0

  const { data: pendingOrgs } = await supabase
    .from('organisations')
    .select('id, name, owner_id, custom_domain')
    .eq('is_white_label', true)
    .eq('custom_domain_verified', false)
    .not('custom_domain', 'is', null)

  for (const org of pendingOrgs ?? []) {
    if (!org.custom_domain) continue
    checked++

    try {
      const result = await attemptDomainVerification(org.id, org.custom_domain)
      if (!result.verified) continue

      verified++

      const { data: owner } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', org.owner_id)
        .single()

      if (owner?.email) {
        await sendEmail({
          to: owner.email,
          subject: `${org.custom_domain} is live!`,
          html: `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;background:#fff;">
              <p style="font-size:20px;font-weight:700;color:#111;margin:0 0 16px;">Your domain is live 🎉</p>
              <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 16px;">
                Hi ${owner.full_name ?? 'there'}, we detected your DNS change for <strong>${org.custom_domain}</strong> and it's now live — your clients can use it right away.
              </p>
              <a href="https://${org.custom_domain}" style="display:inline-block;background:#1D9E75;color:#fff;font-weight:700;font-size:15px;padding:12px 28px;border-radius:10px;text-decoration:none;">Visit ${org.custom_domain} →</a>
            </div>
          `,
        }).catch(() => {/* silent — don't fail the run over one bad email */})
      }
    } catch (err) {
      console.error(`[cron] white-label-dns-check failed for org ${org.id}:`, err)
    }
  }

  return Response.json({ ok: true, checked, verified })
}
