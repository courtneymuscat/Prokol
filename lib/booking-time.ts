// Booking timezone utilities. All booking start_at values are stored as
// UTC timestamptz. Coach and client viewers each see times in their own
// IANA timezone, snapshotted on the booking row so historical bookings
// stay readable even if a profile's timezone changes later.

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function formatInTz(
  iso: string | Date,
  tz: string,
  opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
): string {
  const d = iso instanceof Date ? iso : new Date(iso)
  return new Intl.DateTimeFormat(undefined, { ...opts, timeZone: tz }).format(d)
}

// Convert a local wall-clock date+time string (yyyy-mm-dd, hh:mm) in a
// given IANA timezone into a UTC Date. Used when the coach picks "3pm on
// Tuesday" — they mean 3pm in their tz, which we then store as UTC.
export function localWallTimeToUtc(date: string, time: string, tz: string): Date {
  // Parse parts
  const [y, m, d] = date.split('-').map((n) => parseInt(n, 10))
  const [hh, mm] = time.split(':').map((n) => parseInt(n, 10))
  // First-pass: pretend it's UTC, then subtract the tz offset for that instant.
  const utcGuess = Date.UTC(y, m - 1, d, hh, mm, 0)
  const offsetMin = tzOffsetMinutes(new Date(utcGuess), tz)
  return new Date(utcGuess - offsetMin * 60 * 1000)
}

// Minutes east of UTC for an instant in a tz (e.g. Sydney AEST = +600).
export function tzOffsetMinutes(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at)
  const lookup = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value])) as Record<string, string>
  const tzUtcMs = Date.UTC(
    parseInt(lookup.year, 10),
    parseInt(lookup.month, 10) - 1,
    parseInt(lookup.day, 10),
    parseInt(lookup.hour === '24' ? '0' : lookup.hour, 10),
    parseInt(lookup.minute, 10),
    parseInt(lookup.second, 10),
  )
  return Math.round((tzUtcMs - at.getTime()) / 60000)
}

// "YYYY-MM-DD" for a given date in a tz (used as a stable day key).
export function dateKeyInTz(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const y = parts.find((p) => p.type === 'year')?.value ?? '0000'
  const m = parts.find((p) => p.type === 'month')?.value ?? '00'
  const day = parts.find((p) => p.type === 'day')?.value ?? '00'
  return `${y}-${m}-${day}`
}
