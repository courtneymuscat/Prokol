'use client'

import { useState, useEffect } from 'react'

type Goals = {
  main_goal: string | null
  mini_goals: string[]
}

export default function GoalsPanel() {
  const [goals, setGoals] = useState<Goals | null>(null)

  useEffect(() => {
    fetch('/api/client/goals')
      .then((r) => r.json())
      .then((d) => setGoals(d))
  }, [])

  if (!goals) return null
  if (!goals.main_goal && goals.mini_goals.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border px-5 py-4 space-y-3">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">My Goals</p>

      {goals.main_goal && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-0.5">Main goal</p>
          <p className="text-sm font-semibold text-gray-900">{goals.main_goal}</p>
        </div>
      )}

      {goals.mini_goals.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">This week</p>
          <ul className="space-y-1.5">
            {goals.mini_goals.map((g, i) => (
              <li key={i} className="flex items-start gap-2 overflow-hidden">
                <span className="mt-0.5 w-4 h-4 rounded-full border-2 border-blue-300 flex-shrink-0" />
                <span className="text-sm text-gray-800 break-words overflow-hidden">{g}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
