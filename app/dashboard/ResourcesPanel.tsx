'use client'

import { useState, useEffect } from 'react'

type Resource = {
  id: string
  name: string
  description: string | null
  type: 'link' | 'video' | 'pdf' | 'document'
  url: string | null
  coach_resource_folders: { name: string; icon: string; color: string } | null
}

type Assignment = {
  id: string
  assigned_at: string
  coach_resources: Resource | null
}

const TYPE_META: Record<string, { icon: string; bg: string; text: string }> = {
  link:     { icon: '🔗', bg: 'bg-blue-50',   text: 'text-blue-700' },
  video:    { icon: '🎬', bg: 'bg-purple-50',  text: 'text-purple-700' },
  pdf:      { icon: '📄', bg: 'bg-red-50',     text: 'text-red-700' },
  document: { icon: '📝', bg: 'bg-gray-50',    text: 'text-gray-700' },
}

export default function ResourcesPanel() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/client/resources')
      .then(r => r.json())
      .then(d => setAssignments(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3 animate-pulse">
        <div className="h-4 w-32 bg-gray-100 rounded-full" />
        <div className="h-14 bg-gray-50 rounded-xl" />
        <div className="h-14 bg-gray-50 rounded-xl" />
      </div>
    )
  }

  if (assignments.length === 0) return null

  const resources = assignments.map(a => a.coach_resources).filter(Boolean) as Resource[]

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">Resources</h2>
        <p className="text-xs text-gray-400 mt-0.5">Materials from your coach</p>
      </div>
      <div className="p-4 grid grid-cols-1 gap-2.5">
        {resources.map(r => {
          const meta = TYPE_META[r.type] ?? TYPE_META.document
          return (
            <div key={r.id} className={`rounded-xl border p-3.5 flex items-start gap-3 ${meta.bg} border-gray-200`}>
              <span className="text-xl flex-shrink-0">{meta.icon}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${meta.text}`}>{r.name}</p>
                {r.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{r.description}</p>}
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {r.coach_resource_folders && (
                    <span className="text-[11px] text-gray-400">{r.coach_resource_folders.icon} {r.coach_resource_folders.name}</span>
                  )}
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noopener noreferrer"
                      className={`text-xs font-semibold underline ${meta.text} hover:opacity-80`}>
                      Open →
                    </a>
                  ) : (
                    <span className="text-[11px] text-gray-400 italic">Link coming soon</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
