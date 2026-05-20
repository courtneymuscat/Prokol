'use client'

import { useState } from 'react'
import AutoflowTasksPanel from './AutoflowTasksPanel'
import ScheduledCheckIns from './ScheduledCheckIns'
import TodaysWorkoutCard from './TodaysWorkoutCard'

export default function CoachingSection() {
  const [tasksEmpty, setTasksEmpty] = useState<boolean | null>(null)
  const [checkInsEmpty, setCheckInsEmpty] = useState<boolean | null>(null)

  const bothLoaded = tasksEmpty !== null && checkInsEmpty !== null
  const bothEmpty = tasksEmpty === true && checkInsEmpty === true

  return (
    <>
      <TodaysWorkoutCard />
      <AutoflowTasksPanel onEmpty={setTasksEmpty} />
      <ScheduledCheckIns onEmpty={setCheckInsEmpty} />
      {bothLoaded && bothEmpty && (
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-6 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">You&apos;re all caught up!</p>
            <p className="text-xs text-gray-400 mt-0.5">No tasks or check-ins due right now.</p>
          </div>
        </div>
      )}
    </>
  )
}
