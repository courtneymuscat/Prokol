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
          <div
            key={`${step.flow_id}-${step.step_number}`}
            className="bg-white rounded-2xl border border-gray-100 px-5 py-4 space-y-3"
          >
            {/* Step header */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-900">{step.title || `Step ${step.step_number}`}</p>
                <p className="text-xs text-gray-400 mt-0.5">{step.flow_name}</p>
              </div>
              <a
                href={`/autoflows/${step.flow_id}/${step.step_number}`}
                className="flex-shrink-0 text-xs font-medium text-gray-500 hover:text-gray-900 underline underline-offset-2 transition-colors"
              >
                View step →
              </a>
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
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                        {task.label}
                      </p>
                      {task.link_type && task.link_url && !task.completed && (
                        <a
                          href={task.link_url}
                          target={task.link_type === 'form' ? '_self' : '_blank'}
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 underline mt-0.5"
                        >
                          {task.link_type === 'resource' ? '📚' : task.link_type === 'form' ? '📋' : '🔗'}
                          {task.link_label || task.link_url}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Resources — link to the resources section */}
            {step.resources.length > 0 && (
              <div className="pt-1 border-t border-gray-50">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Resources</p>
                  <a href="/resources" className="text-xs font-medium text-blue-600 hover:text-blue-800 underline">
                    View all →
                  </a>
                </div>
                {step.resources.map(r => (
                  <a key={r.id} href="/resources" className="flex items-center gap-2 py-0.5 hover:opacity-75 transition-opacity">
                    <span className="text-base flex-shrink-0">{RESOURCE_ICONS[r.type] ?? '📝'}</span>
                    <p className="flex-1 text-sm text-gray-800 truncate">{r.name}</p>
                    <span className="flex-shrink-0 text-xs text-blue-600">Open →</span>
                  </a>
                ))}
              </div>
            )}

            {/* Linked form */}
            {step.linked_form && (
              <div className="flex items-center gap-2 pt-1 border-t border-gray-50">
                <span className="text-base flex-shrink-0">📋</span>
                <p className="flex-1 text-sm text-gray-800 truncate">{step.linked_form.title}</p>
                <a
                  href={`/forms/${step.linked_form.id}`}
                  className="flex-shrink-0 text-xs font-semibold text-amber-600 hover:text-amber-800 underline"
                >
                  Fill in →
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
