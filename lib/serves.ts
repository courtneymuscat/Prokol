// Serve exchange system
// 1 protein serve = 30g protein  (half serve threshold: 15g)
// 1 carb serve    = 20g carbs    (half serve threshold: 10g)
// 1 fat serve     = 10g fat      (half serve threshold: 5g)
//
// Fruit used to be tracked as its own bucket, but it's measured in the
// same unit as carbs (20g = 1 serve) and was already summing into the
// same macro total — it added a 4th number without changing what's
// actually being counted. Fruit foods are tagged 'carb' now; if a coach
// wants a client to get some of their carb serves from fruit
// specifically, that's a line in the free-text notes, not a separate
// target.

export type Serves = {
  protein: number
  carb: number
  fat: number
}

export type ServeTargets = {
  protein_serves: number
  carb_serves: number
  fat_serves: number
  veg_unlimited: boolean
  notes: string | null
}

function toHalfServes(grams: number, perServe: number, halfThreshold: number): number {
  if (grams < halfThreshold) return 0
  const full = Math.floor(grams / perServe)
  const remainder = grams % perServe
  return full + (remainder >= halfThreshold ? 0.5 : 0)
}

// Round a serve count to the nearest 0.5
function roundToHalfServe(n: number): number {
  return Math.round(n * 2) / 2
}

// Direct calculation using per-serve values from the cheat sheet.
// More accurate than threshold-based toHalfServes when exact per-serve macros are known.
function servesFromPerServe(logged: number, perServe: number | null): number {
  if (!perServe || perServe <= 0 || logged <= 0) return 0
  return roundToHalfServe(logged / perServe)
}

// When a food has a tagged category, only count serves for that category (+ secondaries).
// Pass perServe values from the cheat sheet for exact calculation; falls back to thresholds.
// category === null  → explicitly no category (cheat-sheet lookup done, not found) → zero serves
// category === undefined → unknown (legacy / general food log) → use macro thresholds
export function calcServes(
  protein_g: number,
  carbs_g: number,
  fat_g: number,
  category?: string | null,
  secondary?: string[] | null,
  perServe?: { protein?: number | null; carbs?: number | null; fat?: number | null } | null,
): Serves {
  // Explicitly not a cheat-sheet food — don't count any serves
  if (category === null) return { protein: 0, carb: 0, fat: 0 }

  // 'fruit' is a defensive alias for 'carb' — foods are tagged 'carb' going
  // forward, but this keeps any not-yet-migrated tag working identically
  // rather than silently dropping those serves.
  const normalisedCategory = category === 'fruit' ? 'carb' : category
  const normalisedSecondary = (secondary ?? []).map((s) => (s === 'fruit' ? 'carb' : s))
  const carbVal = toHalfServes(carbs_g, 20, 10)

  if (normalisedCategory && !['veg', 'free', 'condiment'].includes(normalisedCategory)) {
    const sec = new Set(normalisedSecondary)

    // Use exact per-serve division when cheat sheet values are available
    const proteinServes = perServe?.protein
      ? servesFromPerServe(protein_g, perServe.protein)
      : toHalfServes(protein_g, 30, 15)
    const carbServes = perServe?.carbs
      ? servesFromPerServe(carbs_g, perServe.carbs)
      : carbVal
    const fatServes = perServe?.fat
      ? servesFromPerServe(fat_g, perServe.fat)
      : toHalfServes(fat_g, 10, 5)

    return {
      protein:
        normalisedCategory === 'protein' || sec.has('protein')
          ? proteinServes
          : sec.has('protein_half')
          ? Math.min(proteinServes, 0.5)
          : 0,
      carb:
        normalisedCategory === 'carb' || sec.has('carb') || sec.has('carb_half')
          ? carbServes
          : 0,
      fat:
        normalisedCategory === 'fat' || sec.has('fat') || sec.has('fat_half')
          ? fatServes
          : 0,
    }
  }

  // Default: count all macros (untagged food from regular food logger)
  return {
    protein: toHalfServes(protein_g, 30, 15),
    carb: carbVal,
    fat: toHalfServes(fat_g, 10, 5),
  }
}

export function sumServes(
  logs: Array<{
    protein: number; carbs: number; fat: number
    serve_category?: string | null
    secondary_categories?: string[] | null
    protein_per_serve?: number | null
    carbs_per_serve?: number | null
    fat_per_serve?: number | null
  }>
): Serves {
  return logs.reduce(
    (acc, l) => {
      const perServe = (l.protein_per_serve != null || l.carbs_per_serve != null || l.fat_per_serve != null)
        ? { protein: l.protein_per_serve, carbs: l.carbs_per_serve, fat: l.fat_per_serve }
        : null
      const s = calcServes(l.protein, l.carbs, l.fat, l.serve_category, l.secondary_categories, perServe)
      return {
        protein: acc.protein + s.protein,
        carb: acc.carb + s.carb,
        fat: acc.fat + s.fat,
      }
    },
    { protein: 0, carb: 0, fat: 0 }
  )
}

export function fmt(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1)
}

// Keyword-based fruit detection fallback when no coach tag exists
const FRUIT_KEYWORDS = [
  'apple', 'banana', 'orange', 'mango', 'pear', 'peach', 'plum', 'cherry',
  'apricot', 'kiwi', 'grape', 'watermelon', 'melon', 'rockmelon', 'honeydew',
  'pineapple', 'strawberry', 'raspberry', 'blueberry', 'blackberry', 'berry',
  'mandarin', 'tangerine', 'lemon', 'lime', 'grapefruit', 'fig', 'date',
  'passionfruit', 'guava', 'papaya', 'lychee', 'pomegranate', 'nectarine',
]

export function isFruitByName(name: string): boolean {
  const lower = name.toLowerCase()
  return FRUIT_KEYWORDS.some((k) => lower.includes(k))
}
