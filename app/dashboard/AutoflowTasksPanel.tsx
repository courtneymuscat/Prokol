'use client'

import { useEffect, useState } from 'react'

type Task = {
  id: string
  label: string
  link_type?: string | null
  link_url?: string | null
  link_label?: string | null
  completed: boolean
}

type Resource = {
  id: string
  name: string
  type: string
  url: string | null
}

type DueStep = {
  flow_id: string
  flow_name: string
  step_number: number
  title: string
  due_date: string
  show_as_checkin_prompt: boolean
  tasks: Task[]
  resources: Resource[]
  linked_form: { id: string; title: string } | null
}

const RESOURCE_ICONS: Record<string, string> = {
  link: '🔗',
  video: '🎬',
  pdf: '📄',
  document: '📝',
}

export default function AutoflowTasksPanel() {
  const [steps, setSteps] = useState<DueStep[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    fetch('/api/client/autoflows/due')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setSteps(data)
      })
      .finally(() => setReady(true))
  }, [])

  // Only show steps that have tasks, resources, or a form
  const stepsWithContent = steps.filter(
    s => s.tasks.length > 0 || s.resources.length > 0 || s.linked_form
  )

  if (!ready || stepsWithContent.length === 0) return null

  return (
    <section>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Tasks &amp; Resources</p>
      <div className="space-y-3">
        {stepsWithContent.map(step => (
          <a
            key={`${step.flow_id}-${step.step_number}`}
            href={`/autoflows/${step.flow_id}/${step.step_number}`}
            className="block bg-white rounded-2xl border border-gray-100 px-5 py-4 space-y-3 hover:border-gray-300 hover:shadow-sm transition-all active:opacity-80"
          >
            {/* Step header */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-900">{step.title || `Step ${step.step_number}`}</p>
                <p className="text-xs text-gray-400 mt-0.5">{step.flow_name}</p>
              </div>
              <svg className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>

            {/* Tasks */}
            {step.tasks.length > 0 && (
              <div className="space-y-1.5">
                {step.tasks.map(task => (
                  <div key={task.id} className="flex items-start gap-2.5">
                    <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${task.completed ? 'bg-gray-900' : 'border-2 border-gray-300'}`}>
                      {task.completed && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <p className={`text-sm flex-1 min-w-0 ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                      {task.label}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Resources summary */}
            {step.resources.length > 0 && (
              <div className="flex items-center gap-1.5 pt-1 border-t border-gray-50">
                <span className="text-xs text-gray-400">{step.resources.length} resource{step.resources.length !== 1 ? 's' : ''} attached</span>
              </div>
            )}

            {/* Linked form indicator */}
            {step.linked_form && (
              <div className="flex items-center gap-1.5 pt-1 border-t border-gray-50">
                <span className="text-base">📋</span>
                <p className="text-xs text-gray-500 truncate">{step.linked_form.title}</p>
              </div>
            )}
          </a>
        ))}
      </div>
    </section>
  )
}
