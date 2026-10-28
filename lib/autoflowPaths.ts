// A step's habit / protocol_section / individual tasks can optionally
// differ per client "path" (e.g. Foundations' Plan & Swap / Track Serves
// / Protein + Calories). No schema change needed for this — the jsonb
// columns already accept either a flat value (same for every client) or
// a { ps, ts, pc } keyed object; this resolves whichever was authored
// down to the one value for a given client.

export type PathKey = 'ps' | 'ts' | 'pc'
export const PATH_KEYS: PathKey[] = ['ps', 'ts', 'pc']
export const PATH_LABELS: Record<PathKey, string> = {
  ps: 'Plan & Swap',
  ts: 'Track Serves',
  pc: 'Protein + Calories',
}

type PerPath<T> = T | Partial<Record<PathKey, T>>

function isPerPathObject<T>(value: unknown): value is Partial<Record<PathKey, T>> {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false
  const keys = Object.keys(value as Record<string, unknown>)
  return keys.length > 0 && keys.every((k) => PATH_KEYS.includes(k as PathKey))
}

// Falls back to 'ps' (Plan & Swap — the stated default for beginners)
// when the client hasn't picked a path yet, or the author didn't define
// a variant for the client's specific path.
export function resolveForPath<T>(value: PerPath<T> | null | undefined, path: PathKey | null): T | null {
  if (value == null) return null
  if (isPerPathObject<T>(value)) {
    const effective = path ?? 'ps'
    return value[effective] ?? value.ps ?? null
  }
  return value as T
}

// A task can carry an optional `paths` allowlist — present only for
// clients on one of those paths; absent/empty means "show everyone".
export function taskAppliesToPath(task: { paths?: PathKey[] | null }, path: PathKey | null): boolean {
  if (!task.paths || task.paths.length === 0) return true
  return task.paths.includes(path ?? 'ps')
}

// Reserved question id a program uses to let the client pick their path
// (e.g. Foundations' Week 0 Day 1 "choose your path" question) — answering
// it auto-sets client_autoflows.selected_path, no separate picker screen
// needed. The option label is matched verbatim against PATH_LABELS, so an
// autoflow step's question options must use these exact strings for the
// ones intended to set a path.
export const PATH_CHOICE_QUESTION_ID = 'path_choice'

export function pathFromChoiceLabel(label: string | undefined): PathKey | null {
  if (!label) return null
  const entry = (Object.entries(PATH_LABELS) as [PathKey, string][]).find(([, l]) => l === label)
  return entry?.[0] ?? null
}
