// Hardcoded ids for the two Prokol Method autoflows (both owned by Court's
// own coach account) — used only to auto-pair them on enrolment: assigning
// the lesson autoflow to a client also enrols them in the check-in
// autoflow, same Day 1 start date, fully independent otherwise (no shared
// state, no cross-reads — see app/api/coach/clients/[clientId]/autoflows/route.ts).
export const PROKOL_METHOD_LESSON_TEMPLATE_ID = '8ba68ce0-1f5c-439b-9bf9-5c4ccde0cdf0'
export const PROKOL_METHOD_CHECKIN_TEMPLATE_ID = 'bb5a3567-5b4f-4311-8e31-8afab023f0aa'
