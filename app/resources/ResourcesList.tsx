'use client'

import { useMemo, useState } from 'react'

type Resource = {
  id: string
  name: string
  description: string | null
  type: 'link' | 'video' | 'pdf' | 'document' | 'image'
  url: string | null
}

type Folder = { name: string; icon: string; color: string; resources: Resource[] }

const TYPE_META: Record<string, { icon: string; label: string; bg: string; text: string; border: string }> = {
  link:     { icon: '🔗', label: 'Link',     bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-100' },
  video:    { icon: '🎬', label: 'Video',    bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-100' },
  pdf:      { icon: '📄', label: 'PDF',      bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-100' },
  document: { icon: '📝', label: 'Document', bg: 'bg-gray-50',   text: 'text-gray-700',   border: 'border-gray-200' },
  image:    { icon: '🖼️', label: 'Image',    bg: 'bg-gray-50',   text: 'text-gray-700',   border: 'border-gray-200' },
}

const FOLDER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
  green:  { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200' },
  teal:   { bg: 'bg-teal-50',   text: 'text-teal-700',   border: 'border-teal-200' },
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200' },
  red:    { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200' },
  gray:   { bg: 'bg-gray-100',  text: 'text-gray-600',   border: 'border-gray-200' },
}
function normaliseFolderColor(name: string): string {
  return name === 'purple' ? 'teal' : name
}

function ResourceCard({ resource: r }: { resource: Resource }) {
  const meta = TYPE_META[r.type] ?? TYPE_META.document

  if (r.type === 'image' && r.url) {
    return (
      <a href={r.url} target="_blank" rel="noopener noreferrer" className="block rounded-2xl border border-gray-200 overflow-hidden hover:opacity-90 active:opacity-80 transition-opacity">
        <img src={r.url} alt={r.name} className="w-full object-cover max-h-64" />
        {(r.name || r.description) && (
          <div className="px-4 py-3 bg-white">
            <p className="text-sm font-semibold text-gray-800">{r.name}</p>
            {r.description && <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>}
          </div>
        )}
      </a>
    )
  }

  const inner = (
    <div className={`rounded-2xl border p-4 flex items-start gap-3.5 transition-colors ${meta.bg} ${meta.border} ${r.url ? 'hover:opacity-90 cursor-pointer active:opacity-80' : ''}`}>
      <span className="text-2xl flex-shrink-0 mt-0.5">{meta.icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${meta.text}`}>{r.name}</p>
        {r.description && (
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{r.description}</p>
        )}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[11px] font-medium text-gray-400">{meta.label}</span>
          {r.url ? (
            <span className={`text-xs font-semibold ${meta.text}`}>Tap to open →</span>
          ) : (
            <span className="text-[11px] text-gray-400 italic">Link coming soon</span>
          )}
        </div>
      </div>
    </div>
  )

  if (r.url) {
    return (
      <a href={r.url} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    )
  }
  return inner
}

export default function ResourcesList({ folders, unfiled }: { folders: Folder[]; unfiled: Resource[] }) {
  const [query, setQuery] = useState('')
  const [activeType, setActiveType] = useState<string | null>(null)

  const allResources = useMemo(() => [...folders.flatMap(f => f.resources), ...unfiled], [folders, unfiled])
  const availableTypes = useMemo(
    () => Array.from(new Set(allResources.map(r => r.type))).filter(t => TYPE_META[t]),
    [allResources],
  )

  const q = query.trim().toLowerCase()
  function matches(r: Resource) {
    if (activeType && r.type !== activeType) return false
    if (!q) return true
    return r.name.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q)
  }

  const filteredFolders = folders
    .map(f => ({ ...f, resources: f.resources.filter(matches) }))
    .filter(f => f.resources.length > 0)
  const filteredUnfiled = unfiled.filter(matches)
  const hasAnyResults = filteredFolders.length > 0 || filteredUnfiled.length > 0
  const isFiltering = q.length > 0 || !!activeType

  return (
    <div className="space-y-6">
      {/* Search + filter */}
      <div className="space-y-3">
        <div id="tour-resources-search" className="relative">
          <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search resources…"
            className="w-full bg-white border border-gray-200 rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          />
        </div>
        {availableTypes.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <button
              onClick={() => setActiveType(null)}
              className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                activeType === null ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              All
            </button>
            {availableTypes.map(t => {
              const meta = TYPE_META[t]
              const isActive = activeType === t
              return (
                <button
                  key={t}
                  onClick={() => setActiveType(isActive ? null : t)}
                  className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5 ${
                    isActive ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  <span>{meta.icon}</span>
                  {meta.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {!hasAnyResults && isFiltering && (
        <div className="bg-white rounded-2xl border border-dashed p-8 text-center">
          <p className="text-2xl mb-2">🔍</p>
          <p className="text-sm font-semibold text-gray-700">No matches</p>
          <p className="text-xs text-gray-400 mt-1">Try a different search or filter.</p>
        </div>
      )}

      {filteredFolders.map(folder => {
        const colors = FOLDER_COLORS[normaliseFolderColor(folder.color)] ?? FOLDER_COLORS.gray
        return (
          <section key={folder.name}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">{folder.icon}</span>
              <h2 className="text-sm font-semibold text-gray-700">{folder.name}</h2>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>
                {folder.resources.length}
              </span>
            </div>
            <div className="space-y-2">
              {folder.resources.map(r => <ResourceCard key={r.id} resource={r} />)}
            </div>
          </section>
        )
      })}

      {filteredUnfiled.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 mb-3">Other</h2>
          <div className="space-y-2">
            {filteredUnfiled.map(r => <ResourceCard key={r.id} resource={r} />)}
          </div>
        </section>
      )}
    </div>
  )
}
