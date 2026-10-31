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
      <p className="text-xs text-gray-400 mb-3">This saves as a one-off meal to log today.</p>

      <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4">
        <p className="flex-1 text-xs text-blue-900">
          Building something you&apos;ll reuse across meals or portion out later — a cake, a batch of bolognese?
        </p>
        <Link
          href="/recipes/mine/new"
          className="flex-shrink-0 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
        >
          Build a Recipe →
        </Link>
      </div>

      <MealBuilder onSaved={() => {}} />
    </div>
  )
}
