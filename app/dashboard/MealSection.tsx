'use client'

import Link from 'next/link'
import MealBuilder from './MealBuilder'

export default function MealSection({
  showMealBuilder = true,
}: {
  showMealBuilder?: boolean
}) {
  if (!showMealBuilder) return null

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">Meal Builder</h3>
      <p className="text-xs text-gray-400 mb-4">
        This saves as a one-off meal to log today. Building something you&apos;ll reuse across meals or portion
        out later — a cake, a batch of bolognese — build a{' '}
        <Link href="/recipes/mine/new" className="text-blue-600 hover:underline">Recipe</Link> instead.
      </p>
      <MealBuilder onSaved={() => {}} />
    </div>
  )
}
