// Shared "which week/day of an assigned training program is today" math.
// This exact formula is already duplicated across app/dashboard/
// TrainingCalendar.tsx, the coach's CalendarTab, TodaysWorkoutCard.tsx and
// app/api/cron/push-reminders/route.ts — none of them import from a
// shared place. New code (the autoflow program-link feature) uses this
// instead of adding a 5th copy; the existing 4 are left as-is for now.

function differenceInDays(a: Date, b: Date): number {
  const aUTC = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const bUTC = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((aUTC - bUTC) / 86400000)
}

export type ProgramWeek = { weekIdx: number; dayIdx: number }

// startDate/asOfDate are 'YYYY-MM-DD' strings (as stored in
// client_programs.start_date). Returns null if asOfDate is before
// startDate — the program hasn't started yet as of that date.
export function computeProgramWeek(startDate: string, asOfDate: string): ProgramWeek | null {
  // Parse using local time components to avoid UTC-midnight → local-yesterday shift.
  const start = new Date(startDate + 'T00:00:00')
  const asOf = new Date(asOfDate + 'T00:00:00')
  const dayOffset = differenceInDays(asOf, start)
  if (dayOffset < 0) return null
  return { weekIdx: Math.floor(dayOffset / 7), dayIdx: dayOffset % 7 }
}
