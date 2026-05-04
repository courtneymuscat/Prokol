import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'

const MONTHLY_LIMIT = 50
// Alert Courtney when total platform scans this month cross this threshold
const PLATFORM_ALERT_THRESHOLD = 2000

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function resetDate() {
  const d = new Date()
  const first = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  return first.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
}

export async function POST(req: NextRequest) {
  // Auth — must be a logged-in client
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const month = currentMonth()

  // ── Check + increment usage ───────────────────────────────────────────────
  // Upsert the usage row (creates on first scan of the month, resets if month changed)
  const { data: existing } = await admin
    .from('ai_scan_usage')
    .select('scan_count, month_year')
    .eq('client_id', user.id)
    .maybeSingle()

  // Reset if it's a new month
  const currentCount = (existing?.month_year === month) ? (existing.scan_count ?? 0) : 0

  if (currentCount >= MONTHLY_LIMIT) {
    return NextResponse.json({
      error: 'scan_limit_reached',
      message: `You've used all ${MONTHLY_LIMIT} AI scans for this month. They reset on ${resetDate()}.`,
      scans_used: MONTHLY_LIMIT,
      scans_remaining: 0,
      resets_at: resetDate(),
    }, { status: 429 })
  }

  // ── Perform the scan ──────────────────────────────────────────────────────
  try {
    const { image, mimeType } = await req.json()

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              // 'auto' lets GPT-4o choose the right resolution — much better for food recognition than 'low'
              image_url: { url: `data:${mimeType};base64,${image}`, detail: 'auto' },
            },
            {
              type: 'text',
              text: `Analyze this meal photo and identify every distinct food item visible.

Return ONLY a valid JSON array — no explanation, no markdown:
[{"food_name":"string","grams":number,"calories":number,"protein":number,"carbs":number,"fat":number}]

Rules:
- Be specific (e.g. "Grilled chicken breast" not "meat")
- Estimate portion size visually in grams
- Round calories to nearest 5, macros to 1 decimal place
- If you cannot identify any food, return []`,
            },
          ],
        },
      ],
    })

    const text = response.choices[0].message.content ?? ''
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) {
      return NextResponse.json({
        items: [],
        scans_used: currentCount,
        scans_remaining: MONTHLY_LIMIT - currentCount,
      })
    }

    const items = JSON.parse(match[0])

    // ── Increment usage after a successful scan ────────────────────────────
    const newCount = currentCount + 1
    await admin
      .from('ai_scan_usage')
      .upsert(
        { client_id: user.id, month_year: month, scan_count: newCount, updated_at: new Date().toISOString() },
        { onConflict: 'client_id,month_year' }
      )

    // ── Platform-level monitoring — alert Courtney if threshold crossed ────
    // Fire-and-forget: sum all scans this month and alert if over threshold
    if (newCount === 1 || newCount % 10 === 0) {
      admin
        .from('ai_scan_usage')
        .select('scan_count', { count: 'exact' })
        .eq('month_year', month)
        .then(async ({ data: rows }) => {
          const totalScans = (rows ?? []).reduce((s, r) => s + (r.scan_count as number), 0)
          if (totalScans === PLATFORM_ALERT_THRESHOLD) {
            await sendEmail({
              to: 'court@prokol.io',
              subject: `⚠️ Prokol AI Scans: ${totalScans.toLocaleString()} scans used this month`,
              html: `
                <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;background:#fff;">
                  <p style="font-size:20px;font-weight:700;color:#111;margin:0 0 16px;">AI Scan Usage Alert</p>
                  <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 16px;">
                    Platform-wide AI meal scans hit <strong>${totalScans.toLocaleString()}</strong> for ${month}.
                    Estimated OpenAI cost: ~A$${(totalScans * 0.007).toFixed(2)}.
                  </p>
                  <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 24px;">
                    Check your OpenAI balance at <a href="https://platform.openai.com/account/billing">platform.openai.com/account/billing</a>.
                  </p>
                  <p style="font-size:13px;color:#888;">Prokol Health · Auto-alert at ${PLATFORM_ALERT_THRESHOLD.toLocaleString()} scans/month</p>
                </div>
              `,
            })
          }
        })
    }

    return NextResponse.json({
      items,
      scans_used: newCount,
      scans_remaining: MONTHLY_LIMIT - newCount,
    })
  } catch (err) {
    console.error('scan-meal error:', err)
    return NextResponse.json({ error: 'Failed to analyse image' }, { status: 500 })
  }
}
