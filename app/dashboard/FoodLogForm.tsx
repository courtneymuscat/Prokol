'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import FoodSearch, { type FoodResult } from './FoodSearch'
import { Card } from '@/components/ui/card'

export default function FoodLogForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [pending, setPending] = useState(false)
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [selectedFood, setSelectedFood] = useState<FoodResult | null>(null)

  function handleFoodSelect(food: FoodResult, grams: number) {
    const factor = grams / 100
    setSelectedFood(food)
    setCalories(Math.round(food.calories_per_100g * factor).toString())
    setProtein(Math.round(food.protein_per_100g * factor * 10) / 10 + '')
    setCarbs(Math.round(food.carbs_per_100g * factor * 10) / 10 + '')
    setFat(Math.round(food.fat_per_100g * factor * 10) / 10 + '')
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setPending(true)

    const formData = new FormData(e.currentTarget)
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      setError('Not authenticated')
      setPending(false)
      return
    }

    const { error } = await supabase.from('food_logs').insert({
      user_id: session.user.id,
      calories: Number(formData.get('calories')),
      protein: Number(formData.get('protein')),
      carbs: Number(formData.get('carbs')),
      fat: Number(formData.get('fat')),
      notes: (formData.get('notes') as string) || null,
    })

    if (error) {
      setError(error.message)
    } else {
      if (selectedFood) {
        await supabase.from('user_food_history').insert({
          user_id: session.user.id,
          food_id: selectedFood.id,
          name: selectedFood.name,
          calories_per_100g: selectedFood.calories_per_100g,
          protein_per_100g: selectedFood.protein_per_100g,
          carbs_per_100g: selectedFood.carbs_per_100g,
          fat_per_100g: selectedFood.fat_per_100g,
        })
      }
      setSuccess(true)
      setSelectedFood(null)
      setCalories('')
      setProtein('')
      setCarbs('')
      setFat('')
      ;(e.target as HTMLFormElement).reset()
      router.refresh()
    }

    setPending(false)
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-900">Log Food</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <FoodSearch onSelect={handleFoodSelect} />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Calories</label>
            <input
              name="calories"
              type="number"
              required
              min={0}
              placeholder="e.g. 500"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Protein (g)</label>
            <input
              name="protein"
              type="number"
              required
              min={0}
              step="any"
              placeholder="e.g. 30"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Carbs (g)</label>
            <input
              name="carbs"
              type="number"
              required
              min={0}
              step="any"
              placeholder="e.g. 50"
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Fat (g)</label>
            <input
              name="fat"
              type="number"
              required
              min={0}
              step="any"
              placeholder="e.g. 15"
              value={fat}
              onChange={(e) => setFat(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
          <textarea
            name="notes"
            rows={2}
            placeholder="e.g. Chicken salad lunch"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
        {success && (
          <p className="text-sm text-green-600 bg-green-50 rounded px-3 py-2">Food log saved!</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Saving...' : 'Save Food Log'}
        </button>
      </form>
    </Card>
  )
}
