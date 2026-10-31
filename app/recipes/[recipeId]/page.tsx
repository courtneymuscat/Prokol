'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import LogMealModal from '@/app/components/LogMealModal'

type Ingredient = {
  food_id?: string | null
  food_name: string
  grams: number
  calories: number
  protein: number
  carbs: number
  fat: number
  link?: string | null
}

type Modification = { tag: string; note: string }

type RecipeDetail = {
  id: string
  name: string
  category: string | null
  instructions: string | null
  total_calories: number
  total_protein: number
  total_carbs: number
  total_fat: number
  diet_tags: string[]
  tier_tag: string | null
  ingredients: Ingredient[]
  modifications: Modification[]
}

const DIET_TAG_LABEL: Record<string, string> = { omnivore: 'Omnivore', vegan: 'Vegan', dairy_free: 'Dairy-free' }

const TIER_TAG_STYLE: Record<string, { label: string; className: string }> = {
  cal_conscious: { label: 'Cal Conscious', className: 'bg-teal-50 text-teal-700' },
  balanced:      { label: 'Balanced',      className: 'bg-indigo-50 text-indigo-700' },
  bigger:        { label: 'Bigger',        className: 'bg-fuchsia-50 text-fuchsia-700' },
  gainer:        { label: 'Gainer',        className: 'bg-rose-50 text-rose-700' },
}

const MOD_TAG_LABEL: Record<string, string> = {
  protein_up: 'Need more protein', protein_down: 'Need less protein',
  carbs_up: 'Need more carbs', carbs_down: 'Need less carbs',
  fat_up: 'Need more fat', fat_down: 'Need less fat',
  calories_up: 'Need more calories', calories_down: 'Need less calories',
  volume_up: 'Need more volume', general: 'General',
}

export default function ClientRecipeDetailPage({ params }: { params: Promise<{ recipeId: string }> }) {
  const { recipeId } = use(params)
  const router = useRouter()
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showLog, setShowLog] = useState(false)

  useEffect(() => {
    fetch(`/api/client/recipes/${recipeId}`)
      .then((r) => {
        if (!r.ok) throw new Error('Recipe not found')
        return r.json()
      })
      .then((data) => setRecipe(data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load recipe'))
      .finally(() => setLoading(false))
  }, [recipeId])

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white px-6 py-3.5 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-20">
        <button onClick={() => router.push('/recipes')} className="text-gray-400 hover:text-gray-700 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-[15px] font-bold tracking-tight text-gray-900 truncate">{recipe?.name ?? 'Recipe'}</span>
      </nav>

      <main className="max-w-lg mx-auto p-6 space-y-5">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
        ) : error || !recipe ? (
          <p className="text-sm text-gray-400 text-center py-8">{error ?? 'Recipe not found'}</p>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h1 className="text-xl font-bold text-gray-900">{recipe.name}</h1>
                {recipe.category && <p className="text-xs text-gray-400 capitalize flex-shrink-0 mt-1">{recipe.category}</p>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="text-xs font-semibold text-gray-700">{Math.round(recipe.total_calories)} kcal</span>
                <span className="text-xs text-blue-600">{Math.round(recipe.total_protein)}g P</span>
                <span className="text-xs text-orange-600">{Math.round(recipe.total_carbs)}g C</span>
                <span className="text-xs text-yellow-600">{Math.round(recipe.total_fat)}g F</span>
              </div>
              {((recipe.diet_tags && recipe.diet_tags.length > 0) || recipe.tier_tag) && (
                <div className="flex flex-wrap gap-1.5">
                  {recipe.tier_tag && (
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${TIER_TAG_STYLE[recipe.tier_tag]?.className ?? 'bg-purple-50 text-purple-700'}`}>
                      {TIER_TAG_STYLE[recipe.tier_tag]?.label ?? recipe.tier_tag}
                    </span>
                  )}
                  {recipe.diet_tags?.map((t) => (
                    <span key={t} className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {DIET_TAG_LABEL[t] ?? t}
                    </span>
                  ))}
                </div>
              )}
              <button
                onClick={() => setShowLog(true)}
                className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
              >
                + Log this meal
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
              <h2 className="font-semibold text-gray-900">Ingredients</h2>
              <ul className="divide-y divide-gray-50">
                {recipe.ingredients.map((i, idx) => (
                  <li key={idx} className="py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-gray-800">{i.food_name}</p>
                      <p className="text-xs text-gray-400 flex-shrink-0">{i.grams}g · {Math.round(i.calories)} kcal</p>
                    </div>
                    {i.link && (
                      <a
                        href={i.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full mt-1 hover:bg-blue-100 transition-colors"
                      >
                        🔗 View product
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {recipe.instructions && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2">
                <h2 className="font-semibold text-gray-900">How to make it</h2>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{recipe.instructions}</p>
              </div>
            )}

            {recipe.modifications.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                <h2 className="font-semibold text-gray-900">Adjusting this recipe</h2>
                <ul className="space-y-3">
                  {recipe.modifications.map((m, idx) => (
                    <li key={idx}>
                      <span className="inline-block text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full mb-1">
                        {MOD_TAG_LABEL[m.tag] ?? m.tag}
                      </span>
                      <p className="text-sm text-gray-700">{m.note}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </main>

      {showLog && recipe && (
        <LogMealModal
          slot={{
            label: recipe.name,
            foods: recipe.ingredients.map((i) => ({
              food_name: i.food_name,
              grams: i.grams,
              calories: i.calories,
              protein: i.protein,
              carbs: i.carbs,
              fat: i.fat,
            })),
          }}
          onClose={() => setShowLog(false)}
        />
      )}
    </div>
  )
}
