'use client'

import MealBuilder from './MealBuilder'

export default function MealSection({
  showMealBuilder = true,
}: {
  showMealBuilder?: boolean
}) {
  if (!showMealBuilder) return null

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Meal Builder</h3>
      <MealBuilder onSaved={() => {}} />
    </div>
  )
}
