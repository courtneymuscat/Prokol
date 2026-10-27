'use client'

// Shared "how are these serves calculated" explainer for meal plans —
// used in both the coach editor (app/coach/meal-plans/[id]/MealPlanEditor)
// and the client view (app/dashboard/MealPlanView). Kept in one place so
// the two can't drift out of sync with each other, or with the actual
// formula in lib/autoAssignNutrition.ts.

export default function ServeCalcNote() {
  return (
    <details className="group mt-1.5">
      <summary className="text-[10px] text-gray-400 underline cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">How are these serves calculated?</span>
        <span className="hidden group-open:inline">Hide</span>
      </summary>
      <div className="mt-1.5 text-[10px] text-gray-400 space-y-1 leading-relaxed max-w-md">
        <p>1 serve = 30g protein, 20g carbs, or 10g fat — the same standard used across the app (Food Cheat Sheet, Serve Guide).</p>
        <p>Carbs includes fruit — a fruit serve is just 20g carbs, the same as any other carb source.</p>
        <p>Fruit and veg aren&apos;t capped by these serves — eat those freely alongside them.</p>
        <p>The day&apos;s total is the sum of each meal&apos;s own serves (not a separate calculation on the day&apos;s combined grams), so it always matches what&apos;s shown per meal.</p>
      </div>
    </details>
  )
}
