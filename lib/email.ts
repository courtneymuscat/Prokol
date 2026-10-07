import { Resend } from 'resend'

const FROM_ADDRESS = 'noreply@prokol.io'
const FROM = `Prokol <${FROM_ADDRESS}>`

export async function sendEmail({
  to,
  subject,
  html,
  fromName,
}: {
  to: string
  subject: string
  html: string
  // Shows a white-labelled org's own name in the inbox instead of "Prokol"
  // (e.g. "Court's Gym <noreply@prokol.io>") — the address itself can't be
  // the org's own subdomain without per-org DKIM/SPF DNS records, which is
  // real infrastructure this doesn't build; the display name is what most
  // people actually notice in their inbox anyway.
  fromName?: string
}): Promise<void> {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const from = fromName ? `${fromName} <${FROM_ADDRESS}>` : FROM
    const { error } = await resend.emails.send({ from, to, subject, html })
    if (error) {
      console.error('Resend error:', error)
    }
  } catch (err) {
    console.error('sendEmail unexpected error:', err)
  }
}

export async function sendConfirmationEmail(to: string, confirmationLink: string): Promise<void> {
  await sendEmail({
    to,
    subject: 'Confirm your Prokol account',
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;background:#fff;">
        <p style="font-size:22px;font-weight:700;color:#111;margin:0 0 4px;">Prokol</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0 28px;" />
        <p style="font-size:22px;font-weight:700;color:#111;margin:0 0 8px;">Confirm your email</p>
        <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 28px;">
          Thanks for signing up! Click the button below to confirm your email address and get started.
        </p>
        <a href="${confirmationLink}"
           style="display:inline-block;background:#1D9E75;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:13px 28px;border-radius:10px;margin-bottom:28px;">
          Confirm your email →
        </a>
        <p style="font-size:13px;color:#888;line-height:1.6;margin:0 0 24px;">
          If you didn't create a Prokol account, you can safely ignore this email.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:0 0 20px;" />
        <p style="font-size:12px;color:#bbb;margin:0;">
          Prokol Health &middot; <a href="https://www.prokol.io" style="color:#bbb;text-decoration:none;">prokol.io</a>
        </p>
      </div>
    `,
  })
}
