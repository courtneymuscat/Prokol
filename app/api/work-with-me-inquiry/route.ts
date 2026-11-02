import type { NextRequest } from 'next/server'
import { sendEmail } from '@/lib/email'

const TO_ADDRESS = 'info@prokol.io'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return Response.json({ error: 'Invalid request' }, { status: 400 })

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : ''
  const email = typeof body.email === 'string' ? body.email.trim().slice(0, 200) : ''
  const service = typeof body.service === 'string' ? body.service.trim().slice(0, 200) : ''
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 4000) : ''
  const questions = typeof body.questions === 'string' ? body.questions.trim().slice(0, 4000) : ''

  if (!name || !email || !message) {
    return Response.json({ error: 'Name, email, and a short message are required.' }, { status: 400 })
  }
  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: 'That email address doesn’t look right.' }, { status: 400 })
  }

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;background:#fff;">
      <p style="font-size:20px;font-weight:700;color:#111;margin:0 0 4px;">New enquiry${service ? ` — ${escapeHtml(service)}` : ''}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0 24px;" />
      <p style="font-size:14px;color:#555;margin:0 0 16px;"><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
      ${service ? `<p style="font-size:14px;color:#555;margin:0 0 16px;"><strong>Service:</strong> ${escapeHtml(service)}</p>` : ''}
      <p style="font-size:14px;color:#333;line-height:1.6;margin:0 0 16px;white-space:pre-wrap;"><strong>Why they're reaching out:</strong><br/>${escapeHtml(message)}</p>
      ${questions ? `<p style="font-size:14px;color:#333;line-height:1.6;margin:0 0 16px;white-space:pre-wrap;"><strong>Questions:</strong><br/>${escapeHtml(questions)}</p>` : ''}
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0 16px;" />
      <p style="font-size:12px;color:#bbb;margin:0;">Sent from the Work With Me enquiry form on prokol.io</p>
    </div>
  `

  await sendEmail({
    to: TO_ADDRESS,
    subject: `New enquiry${service ? ` — ${service}` : ''} — ${name}`,
    html,
    fromName: name,
    replyTo: email,
  })

  return Response.json({ ok: true })
}
