import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

// Bulk "mark as reviewed" for the Prokol Method check-ins tab. Flagged
// rows are skipped unless confirmFlagged is true — the one-tap "I've
// looked into this" the coach tab shows before resubmitting with
// confirmFlagged — so a flag can never be cleared as a side effect of a
// careless multi-select. Clearing sets cleared_at/cleared_by but never
// deletes the flag row, so the reason stays in history either way.
export async function POST(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { responseIds: rawIds, confirmFlagged } = (await req.json()) as { responseIds?: string[]; confirmFlagged?: boolean }
  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    return Response.json({ error: 'responseIds required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const reviewed: string[] = []
  const skippedFlagged: string[] = []

  // Rows for a "missed check-in" (no submission exists) are prefixed
  // missed-<flagId> by the list endpoint — there's no autoflow_responses
  // row to mark reviewed, just the flag itself to clear, gated by the same
  // confirmFlagged rule as any other flagged row.
  const missedFlagIds = rawIds.filter((id) => id.startsWith('missed-')).map((id) => id.slice('missed-'.length))
  const responseIds = rawIds.filter((id) => !id.startsWith('missed-'))

  if (missedFlagIds.length > 0) {
    if (!confirmFlagged) {
      skippedFlagged.push(...missedFlagIds.map((id) => `missed-${id}`))
    } else {
      const { data: ownedMissed } = await admin
        .from('autoflow_response_flags')
        .select('id')
        .in('id', missedFlagIds)
        .eq('coach_id', coachId)
        .is('cleared_at', null)
      const ownedMissedIds = (ownedMissed ?? []).map((f) => f.id as string)
      if (ownedMissedIds.length > 0) {
        await admin
          .from('autoflow_response_flags')
          .update({ cleared_at: new Date().toISOString(), cleared_by: coachId, cleared_note: "I've looked into this" })
          .in('id', ownedMissedIds)
        reviewed.push(...ownedMissedIds.map((id) => `missed-${id}`))
      }
    }
  }

  if (responseIds.length > 0) {
    // Ownership check — only responses belonging to this coach's own clients.
    const { data: owned } = await admin
      .from('autoflow_responses')
      .select('id, client_autoflow_id, client_autoflows!inner(coach_id)')
      .in('id', responseIds)
      .eq('client_autoflows.coach_id', coachId)

    const ownedIds = new Set((owned ?? []).map((r) => r.id as string))

    if (ownedIds.size > 0) {
      const { data: openFlags } = await admin
        .from('autoflow_response_flags')
        .select('response_id')
        .in('response_id', [...ownedIds])
        .is('cleared_at', null)
      const flaggedIds = new Set((openFlags ?? []).map((f) => f.response_id as string))

      const toReview: string[] = []
      for (const id of ownedIds) {
        if (flaggedIds.has(id) && !confirmFlagged) skippedFlagged.push(id)
        else toReview.push(id)
      }

      if (toReview.length > 0) {
        await admin
          .from('autoflow_responses')
          .update({ reviewed_by_coach: true, reviewed_at: new Date().toISOString(), reviewed_by: coachId })
          .in('id', toReview)
        reviewed.push(...toReview)
      }

      // Only clear flags for the ones actually confirmed-and-reviewed this call.
      const toClear = toReview.filter((id) => flaggedIds.has(id))
      if (toClear.length > 0) {
        await admin
          .from('autoflow_response_flags')
          .update({ cleared_at: new Date().toISOString(), cleared_by: coachId, cleared_note: "I've looked into this" })
          .in('response_id', toClear)
          .is('cleared_at', null)
      }
    }
  }

  return Response.json({ reviewed, skippedFlagged })
}
