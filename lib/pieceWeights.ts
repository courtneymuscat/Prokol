// Approximate weight (grams) of a single typical piece/unit of a common
// whole food — used to auto-fill a sensible default when someone picks
// "1 piece" as the serving unit for something like an apple or an onion,
// instead of weighing it or typing a guess every time. Values are
// medium/typical-size approximations (USDA FoodData Central "1 medium"
// where available, or the most common single-unit a person would
// actually log — e.g. "1 floret" for broccoli, "1 slice" for
// watermelon/pineapple), not exact — always overridable.
//
// Matched by regex against the food's name, first match wins, so a more
// specific pattern (sweet potato) must come before the more general one
// (potato) it would otherwise be caught by.
export const PIECE_WEIGHTS: Array<[RegExp, number]> = [
  [/\begg\b/i, 50],
  [/\bsweet potato\b/i, 130],
  [/\bpotato\b/i, 150],
  [/\bapple\b/i, 182],
  [/\bbanana\b/i, 118],
  [/\borange\b/i, 131],
  [/\btomato\b/i, 123],
  [/\bstrawberr/i, 12],
  [/\bcarrot\b/i, 61],
  [/\bslice\b|\btoast\b/i, 28],
  // Fruit
  [/\bpear\b/i, 178],
  [/\blemon\b/i, 58],
  [/\blime\b/i, 44],
  [/\bavocado\b/i, 150],
  [/\bkiwi/i, 69],
  [/\bpeach\b/i, 150],
  [/\bplum\b/i, 66],
  [/\bmango\b/i, 207],
  [/\bgrapefruit\b/i, 230],
  [/\bnectarine\b/i, 142],
  [/\bapricot\b/i, 35],
  [/\bfig\b/i, 50],
  [/\bcherr(y|ies)\b/i, 8],
  [/\bdate\b/i, 24],
  [/\bmandarin\b|\btangerine\b|\bclementine\b/i, 74],
  [/\bgrape\b/i, 5],
  [/\bwatermelon\b/i, 286],
  [/\bpineapple\b/i, 84],
  // Vegetables — spring onion must come before the generic onion pattern,
  // same reason sweet potato comes before potato above.
  [/\bspring onion\b|\bscallion\b/i, 15],
  [/\bonion\b/i, 110],
  [/\bcucumber\b/i, 301],
  [/\bcapsicum\b|\bbell pepper\b/i, 119],
  [/\bzucchini\b|\bcourgette\b/i, 196],
  [/\bmushroom\b/i, 18],
  [/\bgarlic\b/i, 3],
  [/\bcelery\b/i, 40],
  [/\bbroccoli\b/i, 11],
  [/\bcauliflower\b/i, 13],
  [/\blettuce\b/i, 8],
]

export function getPieceWeight(name: string): number | null {
  for (const [re, g] of PIECE_WEIGHTS) {
    if (re.test(name)) return g
  }
  return null
}
