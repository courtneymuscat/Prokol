// Serve exchange system
// 1 protein serve = 30g protein  (half serve threshold: 15g)
// 1 carb serve    = 20g carbs    (half serve threshold: 10g)
// 1 fat serve     = 10g fat      (half serve threshold: 5g)
// 1 fruit serve   = 20g carbs    (same as carb — category determines bucket)

export type Serves = {
  protein: number
  carb: number
  fruit: number
  fat: number
}

export type ServeTargets = {
  protein_serves: number
  carb_serves: number
  fat_serves: number
  fruit_serves: number
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
  if (category === null) return { protein: 0, carb: 0, fruit: 0, fat: 0 }

  const isFruit = category === 'fruit'
  const carbVal = toHalfServes(carbs_g, 20, 10)

  if (category && !['veg', 'free', 'condiment'].includes(category)) {
    const sec = new Set(secondary ?? [])

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
        category === 'protein' || sec.has('protein')
          ? proteinServes
          : sec.has('protein_half')
          ? Math.min(proteinServes, 0.5)
          : 0,
      carb:
        !isFruit && (category === 'carb' || sec.has('carb') || sec.has('carb_half'))
          ? carbServes
          : 0,
      fruit: isFruit ? carbServes : 0,
      fat:
        category === 'fat' || sec.has('fat') || sec.has('fat_half')
          ? fatServes
          : 0,
    }
  }

  // Default: count all macros (untagged food from regular food logger)
  return {
    protein: toHalfServes(protein_g, 30, 15),
    carb: isFruit ? 0 : carbVal,
    fruit: isFruit ? carbVal : 0,
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
        fruit: acc.fruit + s.fruit,
        fat: acc.fat + s.fat,
      }
    },
    { protein: 0, carb: 0, fruit: 0, fat: 0 }
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
