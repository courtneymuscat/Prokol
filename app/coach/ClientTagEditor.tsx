'use client'

import { useEffect, useRef, useState } from 'react'
import { useClientTags, type ClientTag } from './ClientTagsContext'

const PALETTE = ['#EF4444', '#F97316', '#F59E0B', '#22C55E', '#14B8A6', '#3B82F6', '#6366F1', '#A855F7', '#EC4899', '#6B7280']

function ColorSwatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="w-5 h-5 rounded-full flex-shrink-0 transition-transform"
          style={{ backgroundColor: c, outline: value === c ? `2px solid ${c}` : 'none', outlineOffset: 2, transform: value === c ? 'scale(1.1)' : undefined }}
          aria-label={c}
        />
      ))}
    </div>
  )
}

function TagRow({ tag, assigned, onToggle }: { tag: ClientTag; assigned: boolean; onToggle: () => void }) {
  const { renameTag, deleteTag } = useClientTags()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(tag.name)
  const [color, setColor] = useState(tag.color)
  const [busy, setBusy] = useState(false)

  if (editing) {
    return (
      <div className="px-3 py-2 space-y-2 bg-gray-50 rounded-lg">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <ColorSwatches value={color} onChange={setColor} />
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={async () => {
              if (!confirm(`Delete the "${tag.name}" tag? It'll be removed from every client it's on.`)) return
              setBusy(true)
              await deleteTag(tag.id)
              setBusy(false)
            }}
            disabled={busy}
            className="text-xs text-red-500 hover:text-red-600 disabled:opacity-50"
          >
            Delete tag
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
            <button
              onClick={async () => {
                if (!name.trim()) return
                setBusy(true)
                const ok = await renameTag(tag.id, name.trim(), color)
                setBusy(false)
                if (ok) setEditing(false)
              }}
              disabled={busy || !name.trim()}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-1 py-1 rounded-lg hover:bg-gray-50">
      <button onClick={onToggle} className="flex items-center gap-2 flex-1 min-w-0 text-left">
        <span
          className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 border-2"
          style={{ borderColor: tag.color, backgroundColor: assigned ? tag.color : 'transparent' }}
        >
          {assigned && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>
        <span className="text-sm text-gray-800 truncate">{tag.name}</span>
      </button>
      <button onClick={() => setEditing(true)} className="text-gray-300 hover:text-gray-500 flex-shrink-0 p-0.5">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
    </div>
  )
}

export default function ClientTagEditor({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const { allTags, byClient, assignTag, unassignTag, createTag } = useClientTags()
  const ref = useRef<HTMLDivElement>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PALETTE[0])
  const [busy, setBusy] = useState(false)

  const assignedIds = new Set((byClient[clientId] ?? []).map((t) => t.id))

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  async function handleToggle(tagId: string) {
    if (assignedIds.has(tagId)) await unassignTag(clientId, tagId)
    else await assignTag(clientId, tagId)
  }

  async function handleCreate() {
    if (!newName.trim()) return
    setBusy(true)
    const tag = await createTag(newName.trim(), newColor)
    if (tag) await assignTag(clientId, tag.id)
    setBusy(false)
    setNewName('')
    setCreating(false)
  }

  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      className="absolute z-30 mt-1 w-64 bg-white rounded-2xl border border-gray-200 shadow-lg p-2"
    >
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-2 pt-1 pb-1.5">Tags</p>
      <div className="max-h-56 overflow-y-auto space-y-0.5">
        {allTags.length === 0 && !creating && (
          <p className="text-xs text-gray-400 px-2 py-2">No tags yet — create one below.</p>
        )}
        {allTags.map((tag) => (
          <TagRow key={tag.id} tag={tag} assigned={assignedIds.has(tag.id)} onToggle={() => handleToggle(tag.id)} />
        ))}
      </div>

      <div className="border-t border-gray-100 mt-1.5 pt-1.5 px-1">
        {creating ? (
          <div className="space-y-2 px-1 pb-1">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Tag name…"
              className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <ColorSwatches value={newColor} onChange={setNewColor} />
            <div className="flex items-center justify-end gap-2 pt-0.5">
              <button onClick={() => setCreating(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
              <button
                onClick={handleCreate}
                disabled={busy || !newName.trim()}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50"
              >
                {busy ? 'Creating…' : 'Create & apply'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="w-full flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 px-2 py-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New tag
          </button>
        )}
      </div>
    </div>
  )
}
