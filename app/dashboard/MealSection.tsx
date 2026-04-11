'use client'

import { useState } from 'react'
import MealBuilder from './MealBuilder'
import SavedMeals from './SavedMeals'

export default function MealSection({
  showMealBuilder = true,
  showSavedMeals = true,
}: {
  showMealBuilder?: boolean
  showSavedMeals?: boolean
}) {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-6 items-start">
      {/* Meal Builder — 2/3 width */}
      {showMealBuilder && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Meal Builder</h3>
          <MealBuilder onSaved={() => setRefreshKey((k) => k + 1)} />
        </div>
      )}

      {/* Saved Meals — 1/3 width */}
      {showSavedMeals && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Saved Meals</h3>
          <SavedMeals refreshKey={refreshKey} />
        </div>
      )}
    </div>
  )
}
