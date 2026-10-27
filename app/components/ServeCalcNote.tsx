'use client'

// Shared "how are these serves calculated" explainer for meal plans —
// used in both the coach editor (app/coach/meal-plans/[id]/MealPlanEditor)
// and the client view (app/dashboard/MealPlanView). Kept in one place so
// the two can't drift out of sync with each other, or with the actual
// formula in lib/autoAssignNutrition.ts.
//
// Only the Carbs total uses the veg reservation (same formula as the
// Serve Guide — holds back ~38g carbs/~150 kcal before converting the
// rest to carb serves), not Protein or Fat. Without it, a client could
// fully use every carb serve shown here AND treat veg as genuinely free
// on top of it, landing in a real surplus with nothing warning them.
// Each individual meal's carb serves (mealMacrosToServes) do NOT reserve
// this — a whole-day reservation applied per meal zeroes out almost
// every meal's carb serves, which is a worse problem than the carb total
// not exactly matching the literal sum of its meals. Protein and Fat
// totals have no such adjustment, so they always exactly match the sum
// of what's shown per meal.

const VEG_RESERVE_KCAL = 150
const VEG_RESERVE_G = Math.round(VEG_RESERVE_KCAL / 4)

type ServeCalcNoteProps = {
  proteinG: number
  carbG: number
  fatG: number
  proteinServes: number
  carbServes: number
  fatServes: number
}

export default function ServeCalcNote({ proteinG, carbG, fatG, proteinServes, carbServes, fatServes }: ServeCalcNoteProps) {
  const carbAfterVeg = Math.max(0, carbG - VEG_RESERVE_G)
  return (
    <details className="group mt-1.5">
      <summary className="text-[10px] text-gray-400 underline cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">How are these serves calculated?</span>
        <span className="hidden group-open:inline">Hide calculation</span>
      </summary>
      <div className="mt-2 space-y-2.5 bg-amber-50/60 rounded-lg p-2.5 border border-amber-100 max-w-md">
        <div>
          <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-1">Per-serve assumptions</p>
          <ul className="text-[11px] text-amber-800 space-y-0.5">
            <li><span className="font-semibold">Protein:</span> 30g protein = 1 serve</li>
            <li><span className="font-semibold">Carbs:</span> 20g carbs = 1 serve (includes fruit — same unit)</li>
            <li><span className="font-semibold">Fats:</span> 10g fat = 1 serve</li>
            <li><span className="font-semibold">Veg (∞):</span> ~{VEG_RESERVE_G}g carbs (~{VEG_RESERVE_KCAL} kcal) held back from Carbs below, same as the Serve Guide</li>
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-1">This plan&apos;s total</p>
          <table className="w-full text-[11px] text-amber-800">
            <tbody>
              <tr>
                <td className="py-0.5 pr-2 font-medium align-top">Protein</td>
                <td className="py-0.5 pr-2 tabular-nums whitespace-nowrap align-top">{proteinG.toFixed(1)}g ÷ 30g</td>
                <td className="py-0.5 tabular-nums font-semibold align-top">= {proteinServes} serves</td>
              </tr>
              <tr>
                <td className="py-0.5 pr-2 font-medium align-top">Carbs</td>
                <td className="py-0.5 pr-2 tabular-nums whitespace-nowrap align-top">
                  {carbG.toFixed(1)}g − {VEG_RESERVE_G}g (veg) = {carbAfterVeg.toFixed(1)}g ÷ 20g
                </td>
                <td className="py-0.5 tabular-nums font-semibold align-top">= {carbServes} serves</td>
              </tr>
              <tr>
                <td className="py-0.5 pr-2 font-medium align-top">Fat</td>
                <td className="py-0.5 pr-2 tabular-nums whitespace-nowrap align-top">{fatG.toFixed(1)}g ÷ 10g</td>
                <td className="py-0.5 tabular-nums font-semibold align-top">= {fatServes} serves</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-amber-600 leading-snug">
          The protein/carb/fat grams above are the plan&apos;s real totals from its real ingredients — not a flat per-serve kcal estimate like the Serve Guide uses before any food is chosen. But the Carbs serve count still reserves veg headroom the same way the Serve Guide does, so a client who fully uses every carb serve here still has real room for veg on top, instead of just being told it&apos;s &quot;free&quot; with nothing backing that up.
        </p>
        <p className="text-[10px] text-amber-600 leading-snug">
          Because of that, this Carbs total will usually read a little lower than simply adding up the carb serves shown on each meal above (those don&apos;t reserve anything — a whole-day reservation applied per meal would zero out almost every meal&apos;s carb serves). That gap is the built-in veg margin, not an error. Protein and Fat have no such adjustment, so those two always exactly match the sum of what&apos;s shown per meal.
        </p>
      </div>
    </details>
  )
}
