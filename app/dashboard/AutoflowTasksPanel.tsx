'use client'

import { useEffect, useState } from 'react'
import { PATH_KEYS, PATH_LABELS, type PathKey } from '@/lib/autoflowPaths'

type Props = { onEmpty?: (empty: boolean) => void }

type Task = {
  id: string
  label: string
  link_type?: 'resource' | 'form' | 'url' | null
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
  selected_path: PathKey | null
  step_number: number
  title: string
  due_date: string
  show_as_checkin_prompt: boolean
  tasks: Task[]
  resources: Resource[]
  linked_form: { id: string; title: string } | null
  protocol_section: { title: string; content: string } | null
  unlocks_next_step: boolean
}


export default function AutoflowTasksPanel({ onEmpty }: Props) {
  const [steps, setSteps] = useState<DueStep[]>([])
  const [ready, setReady] = useState(false)
  const [pathSaving, setPathSaving] = useState(false)

  useEffect(() => {
    fetch('/api/client/autoflows/due')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setSteps(data)
      })
      .finally(() => setReady(true))
  }, [])

  async function changePath(flowId: string, path: PathKey) {
    setPathSaving(true)
    const res = await fetch(`/api/client/autoflows/${flowId}/path`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    })
    if (res.ok) {
      setSteps(prev => prev.map(s => s.flow_id === flowId ? { ...s, selected_path: path } : s))
    }
    setPathSaving(false)
  }

  // Only show steps that have tasks, resources, a form, or a protocol note
  const stepsWithContent = steps.filter(
    s => s.tasks.length > 0 || s.resources.length > 0 || s.linked_form || s.protocol_section
  )

  // Path belongs to the whole autoflow, not a single step — surface it once,
  // from whichever due step happens to carry it, rather than repeating it
  // per card.
  const pathStep = stepsWithContent.find(s => s.selected_path)

  useEffect(() => {
    if (ready) onEmpty?.(stepsWithContent.length === 0)
  }, [ready, stepsWithContent.length]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) {
    return (
      <section>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Tasks &amp; Resources</p>
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 space-y-3 animate-pulse">
          <div className="h-4 w-2/3 bg-gray-100 rounded-full" />
          <div className="h-3 w-1/3 bg-gray-50 rounded-full" />
          <div className="space-y-1.5 pt-1">
            <div className="h-3.5 w-full bg-gray-50 rounded-full" />
            <div className="h-3.5 w-5/6 bg-gray-50 rounded-full" />
          </div>
        </div>
      </section>
    )
  }

  if (stepsWithContent.length === 0) return null

  return (
    <section>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Tasks &amp; Resources</p>
      {pathStep && (
        <div className="mb-3 flex items-center justify-between gap-3 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Your path</p>
            <p className="text-[11px] text-gray-400 truncate">Sets which protocol &amp; habit notes you see below</p>
          </div>
          <select
            value={pathStep.selected_path!}
            onChange={e => changePath(pathStep.flow_id, e.target.value as PathKey)}
            disabled={pathSaving}
            className="text-xs font-medium border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 disabled:opacity-50 flex-shrink-0"
          >
            {PATH_KEYS.map(k => <option key={k} value={k}>{PATH_LABELS[k]}</option>)}
          </select>
        </div>
      )}
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

            {/* Protocol note for this step */}
            {step.protocol_section && (
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  {step.protocol_section.title || 'Protocol'}
                </p>
                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{step.protocol_section.content}</p>
              </div>
            )}

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
                      {/* Not a clickable link here — the whole card already opens the
                          step page, where this resolves to a real, tappable link. */}
                      {task.link_type && task.link_url && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {task.link_type === 'resource' ? '📚' : task.link_type === 'form' ? '📋' : '🔗'} {task.link_label || task.link_url}
                        </p>
                      )}
                    </div>
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

            {/* Reminder to mark the step complete to unlock the next one */}
            {step.unlocks_next_step && (
              <div className="flex items-center gap-1.5 pt-1 border-t border-gray-50">
                <svg className="w-3 h-3 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-amber-600 font-medium">Tick off this step to unlock the next one</p>
              </div>
            )}
          </a>
        ))}
      </div>
    </section>
  )
}
