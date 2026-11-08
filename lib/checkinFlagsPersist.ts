import type { SupabaseClient } from '@supabase/supabase-js'
import { computeCheckinFlags, pickAutomatedMessages, requiredHistoryLength, type CheckinAnswers, type CheckinQuestion, type FlagCategory } from '@/lib/checkinFlags'
import { getOrCreateMessageTemplates, renderTemplate, combineCategorySnippets, sendAutomatedCheckinMessage } from '@/lib/checkinMessages'
import { sendEmail } from '@/lib/email'

/**
 * Scores a just-submitted autoflow step's answers against that step's
 * questions (core + step-specific, respecting include_core_questions) and
 * persists any resulting flags — platform-wide, any coach's autoflow, not
 * scoped to one template. Called right after the response upsert succeeds
 * in app/api/client/autoflows/[flowId]/[step]/route.ts.
 *
 * On top of the flag rows themselves: emails the coach for any 'urgent'
 * flag, and sends at most one automated in-app message (plus push) from
 * the coach's own account to the client — see pickAutomatedMessages for
 * the priority/suppression rules and lib/checkinMessages.ts for the
 * actual templates.
 */
export async function computeAndStoreCheckinFlags(params: {
  admin: SupabaseClient
  flowId: string
  coachId: string
  clientId: string
  stepNumber: number
  responseId: string
  answers: CheckinAnswers
}) {
  const { admin, flowId, coachId, clientId, stepNumber, responseId, answers } = params

  const { data: flow } = await admin
    .from('client_autoflows')
    .select('template_id, autoflow_templates(core_questions)')
    .eq('id', flowId)
    .single()
  if (!flow) return

  const { data: step } = await admin
    .from('autoflow_template_steps')
    .select('questions, include_core_questions')
    .eq('template_id', flow.template_id)
    .eq('step_number', stepNumber)
    .maybeSingle()
  if (!step) return

  const tpl = flow.autoflow_templates as unknown as { core_questions: CheckinQuestion[] } | null
  const coreQuestions = step.include_core_questions === false ? [] : (tpl?.core_questions ?? [])
  const stepQuestions = Array.isArray(step.questions) ? (step.questions as CheckinQuestion[]) : []
  const questions: CheckinQuestion[] = [...coreQuestions, ...stepQuestions]

  // Fetch exactly as much prior history as the longest flag condition on
  // this step's questions needs, rather than a fixed window — a coach
  // might configure a flag that needs more than the old hardcoded 2 prior
  // submissions.
  const historyNeeded = requiredHistoryLength(questions) - 1
  const { data: history } = historyNeeded > 0
    ? await admin
        .from('autoflow_responses')
        .select('step_number, answers')
        .eq('client_autoflow_id', flowId)
        .lt('step_number', stepNumber)
        .order('step_number', { ascending: true })
    : { data: [] }

  // Build history from the last N PRIOR submissions, then append the
  // just-submitted answers directly (rather than trusting a read-back of
  // the row we just upserted, which could race under eventual consistency).
  const priorAnswers: CheckinAnswers[] = ((history ?? []) as { step_number: number; answers: CheckinAnswers }[])
    .slice(-historyNeeded)
    .map((h) => h.answers ?? {})
  const recentAnswers: CheckinAnswers[] = [...priorAnswers, answers]

  const flags = computeCheckinFlags({ questions, recentAnswers })
  if (flags.length === 0) return

  await admin.from('autoflow_response_flags').insert(
    flags.map((f) => ({
      response_id: responseId,
      client_autoflow_id: flowId,
      step_number: stepNumber,
      client_id: clientId,
      coach_id: coachId,
      rule_key: f.ruleKey,
      severity: f.severity,
      reason: f.reason,
    })),
  )

  const [{ data: coachProfile }, { data: clientProfile }] = await Promise.all([
    admin.from('profiles').select('email, full_name, first_name').eq('id', coachId).maybeSingle(),
    admin.from('profiles').select('full_name, first_name, email').eq('id', clientId).maybeSingle(),
  ])
  const clientDisplayName = clientProfile?.full_name ?? clientProfile?.first_name ?? clientProfile?.email ?? 'A client'
  const clientFirstName = clientProfile?.first_name ?? clientProfile?.full_name?.split(' ')[0] ?? 'there'
  const coachDisplayName = coachProfile?.first_name ?? coachProfile?.full_name ?? 'your coach'

  // Email the coach for any urgent flag — unchanged from before, always
  // on regardless of the automated client-message toggle below.
  const urgent = flags.filter((f) => f.severity === 'urgent')
  if (urgent.length > 0 && coachProfile?.email) {
    await sendEmail({
      to: coachProfile.email,
      subject: `Urgent flag on ${clientDisplayName}'s check-in`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;background:#fff;">
          <p style="font-size:20px;font-weight:700;color:#B3261E;margin:0 0 16px;">Urgent check-in flag</p>
          <p style="font-size:15px;color:#333;line-height:1.6;margin:0 0 16px;"><strong>${clientDisplayName}</strong> just submitted a check-in that needs your direct attention:</p>
          <ul style="font-size:14px;color:#333;line-height:1.6;">
            ${urgent.map((f) => `<li>${f.reason}</li>`).join('')}
          </ul>
          <p style="font-size:13px;color:#888;margin-top:24px;">Open their Check-ins tab in Prokol to review the full submission.</p>
        </div>
      `,
    })
  }

  // Automated client-facing message — at most one, per pickAutomatedMessages'
  // priority rules (Urgent > Normal; Urgent suppresses Lead; Lead can send
  // alongside Normal otherwise). Category priority comes from the coach's
  // own list (renamable/deletable from Check-ins > Message templates),
  // not a fixed global order.
  if (!flags.some((f) => f.sendAutomatedMessage)) return

  const templates = await getOrCreateMessageTemplates(admin, coachId)
  const picked = pickAutomatedMessages(flags, templates.custom_categories.map((c) => c.id))
  if (!picked.urgent && !picked.normal && !picked.lead) return

  const vars = { first_name: clientFirstName, coach_name: coachDisplayName }

  if (picked.urgent) {
    if (templates.urgent_enabled) {
      await sendAutomatedCheckinMessage(admin, { coachId, clientId, body: renderTemplate(templates.urgent_template, vars) })
    }
    return
  }

  if (picked.normal) {
    const categories = picked.normal.flags.map((f) => f.category as FlagCategory)
    const { reason, tip } = combineCategorySnippets(categories, templates.category_snippets)
    await sendAutomatedCheckinMessage(admin, {
      coachId,
      clientId,
      body: renderTemplate(templates.normal_template, { ...vars, flag_reason: reason, flag_tip: tip }),
    })
  }

  if (picked.lead) {
    await sendAutomatedCheckinMessage(admin, { coachId, clientId, body: renderTemplate(templates.lead_template, vars) })
  }
}
