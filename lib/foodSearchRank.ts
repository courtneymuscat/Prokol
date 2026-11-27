// Preparation preference for food search results.
//
// The food database stores one row per preparation — "Chicken breast lean
// flesh raw", "… baked no added fat", "… fried no added fat", "… skin & fat
// raw" — so an alphabetical list put baked, casseroled and fried above raw,
// and a client logging plain chicken had to read past four wrong rows.
// Clients weigh and log food raw far more often than they log it crumbed, so
// raw and lean cuts rank first.
//
// These adjustments are deliberately smaller than the exact/prefix match
// bonuses in the relevance score. A branded search like "bulla cottage
// cheese" must put the matching product first; it would be worse to drag a
// generic raw ingredient above the thing the client actually scanned off a
// tub.

const COOKED = [
  'baked', 'fried', 'grilled', 'boiled', 'casseroled', 'microwaved', 'roasted',
  'stewed', 'poached', 'steamed', 'simmered', 'braised', 'barbecued',
]

const PROCESSED = [
  'crumbed', 'battered', 'coated', 'takeaway', 'fast food', 'seasoned',
  'marinated', 'smoked', 'canned', 'pickled', 'flavoured',
]

// "lean flesh" beats "lean flesh skin & fat" for the same cut.
const FATTY = ['skin & fat', 'skin and fat', 'untrimmed', 'added fat']

/**
 * Returns a bonus/penalty to add to a food's relevance score, favouring the
 * raw, lean form of an ingredient over its cooked or processed variants.
 */
export function preparationBonus(name: string): number {
  const n = name.toLowerCase()
  let s = 0

  if (/\braw\b/.test(n)) s += 18
  if (/\bfresh\b/.test(n)) s += 5
  if (/\blean\b/.test(n)) s += 10

  if (COOKED.some((w) => n.includes(w))) s -= 14
  if (PROCESSED.some((w) => n.includes(w))) s -= 16
  if (FATTY.some((w) => n.includes(w))) s -= 16

  return s
}

/**
 * How well a food name answers the query, before preparation preference.
 * Exact and prefix matches dominate so a branded product search still wins.
 */
export function matchScore(name: string, query: string, terms: string[]): number {
  const n = name.toLowerCase().trim()
  const q = query.toLowerCase().trim()
  let s = 0

  if (n === q) s += 200
  else if (n.startsWith(q)) s += 120
  else if (n.includes(q)) s += 70

  let all = true
  for (const t of terms) {
    if (n.includes(t)) s += 6
    else all = false
  }
  if (all) s += 25

  // Prefer the plainer entry of two equally matching names.
  s -= Math.max(0, n.length - q.length) * 0.25

  return s
}

/** Full ranking score: how well it matches, then how it's prepared. */
export function rankFood(name: string, query: string, terms: string[]): number {
  return matchScore(name, query, terms) + preparationBonus(name)
}
