'use client'

// Shared "how is TDEE calculated" explainer + meal-plan-target clarity note
// for the "TDEE & Targets" card — used in both
// app/coach/clients/[clientId]/TDEESection.tsx and the separate (duplicate)
// card in ClientTabs.tsx, kept in one place so the two copy don't drift.

export function TDEECalcExplainer() {
  return (
    <details className="group">
      <summary className="text-[11px] text-gray-400 underline cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">How is this calculated?</span>
        <span className="hidden group-open:inline">Hide calculation</span>
      </summary>
      <div className="mt-2 space-y-1.5 bg-blue-50/60 rounded-lg p-2.5 border border-blue-100 text-[11px] text-blue-800 leading-relaxed">
        <p><span className="font-semibold">BMR</span> — Mifflin-St Jeor: 10 × weight(kg) + 6.25 × height(cm) − 5 × age, +5 for male / −161 for female.</p>
        <p><span className="font-semibold">+ NEAT</span> — everyday movement, estimated at 15% of BMR.</p>
        <p><span className="font-semibold">+ Steps</span> — logged daily step count converted to calories.</p>
        <p><span className="font-semibold">+ Exercise</span> — each logged activity&apos;s MET value, body weight, duration and weekly frequency, averaged to a daily figure.</p>
        <p><span className="font-semibold">× 1.10</span> — a buffer for everyday activity the other inputs don&apos;t fully capture (TEF, fidgeting, etc).</p>
        <p className="pt-1.5 border-t border-blue-100">The daily target then applies the goal&apos;s calorie adjustment (deficit for fat loss, surplus for muscle gain, maintenance otherwise) and a protein/fat-per-kg split, with carbs filling the remainder.</p>
      </div>
    </details>
  )
}

export function MealPlanDrivenNote() {
  return (
    <p className="text-xs text-blue-700 font-medium bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-2 leading-relaxed">
      These numbers come from the client&apos;s active meal plan, not the TDEE calculation above — this is exactly what the client sees in their app.
    </p>
  )
}
