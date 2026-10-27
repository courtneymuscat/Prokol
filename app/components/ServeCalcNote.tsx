'use client'

// Shared "how are these serves calculated" explainer for meal plans —
// used in both the coach editor (app/coach/meal-plans/[id]/MealPlanEditor)
// and the client view (app/dashboard/MealPlanView). Kept in one place so
// the two can't drift out of sync with each other, or with the actual
// formula in lib/autoAssignNutrition.ts.
//
// Styled to match the "How is this calculated?" breakdown on the Serve
// Guide (app/coach/clients/[clientId]/ClientServeGuide.tsx) — same
// per-serve-assumptions + worked-breakdown shape — but simpler, since a
// meal plan's protein/carb/fat grams are already the real totals from
// real ingredients. The Serve Guide has to reconcile a kcal gap because
// it works backward from a flat per-serve kcal assumption (to estimate a
// whole day from a TDEE target before any food is chosen); a meal plan
// has no such gap to explain — what you see is what's actually in it.

type ServeCalcNoteProps = {
  proteinG: number
  carbG: number
  fatG: number
  proteinServes: number
  carbServes: number
  fatServes: number
}

export default function ServeCalcNote({ proteinG, carbG, fatG, proteinServes, carbServes, fatServes }: ServeCalcNoteProps) {
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
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-1">This plan&apos;s breakdown</p>
          <table className="w-full text-[11px] text-amber-800">
            <tbody>
              <tr>
                <td className="py-0.5 pr-2 font-medium">Protein</td>
                <td className="py-0.5 pr-2 tabular-nums whitespace-nowrap">{proteinG.toFixed(1)}g ÷ 30g</td>
                <td className="py-0.5 tabular-nums font-semibold">= {proteinServes} serves</td>
              </tr>
              <tr>
                <td className="py-0.5 pr-2 font-medium">Carbs</td>
                <td className="py-0.5 pr-2 tabular-nums whitespace-nowrap">{carbG.toFixed(1)}g ÷ 20g</td>
                <td className="py-0.5 tabular-nums font-semibold">= {carbServes} serves</td>
              </tr>
              <tr>
                <td className="py-0.5 pr-2 font-medium">Fat</td>
                <td className="py-0.5 pr-2 tabular-nums whitespace-nowrap">{fatG.toFixed(1)}g ÷ 10g</td>
                <td className="py-0.5 tabular-nums font-semibold">= {fatServes} serves</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-amber-600 leading-snug">
          These are the plan&apos;s real macros from its real ingredients — not a flat per-serve kcal estimate like the Serve Guide uses for TDEE-based targets (which has no actual foods chosen yet). No &quot;mixed macro&quot; reconciliation needed here — the Total above already is the real number.
        </p>
        <p className="text-[10px] text-amber-600 leading-snug">
          Fruit and veg aren&apos;t capped by these serves — eat those freely alongside them. The total above is the sum of each meal&apos;s own serves (not a separate calculation), so it always matches what&apos;s shown per meal.
        </p>
      </div>
    </details>
  )
}
