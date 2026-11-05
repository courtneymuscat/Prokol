'use client'

import { useState } from 'react'

type Announcement = {
  id: string
  title: string
  url: string | null
  note: string | null
  created_at: string
  archived_at: string | null
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AnnouncementsPanel({ orgId, initialAnnouncements }: { orgId: string; initialAnnouncements: Announcement[] }) {
  const [announcements, setAnnouncements] = useState(initialAnnouncements)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  async function handlePost() {
    if (!title.trim()) return
    setPosting(true)
    setError(null)
    const res = await fetch(`/api/admin/gyms/${orgId}/announcements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, url, note }),
    })
    const data = await res.json()
    setPosting(false)
    if (!res.ok) {
      setError(data.error ?? 'Failed to post announcement')
      return
    }
    setAnnouncements((prev) => [data, ...prev])
    setTitle('')
    setUrl('')
    setNote('')
  }

  async function handleRemove(id: string) {
    if (!confirm('Remove this announcement? Members will no longer see it.')) return
    setRemovingId(id)
    const res = await fetch(`/api/admin/gyms/${orgId}/announcements/${id}`, { method: 'DELETE' })
    setRemovingId(null)
    if (res.ok) setAnnouncements((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 max-w-xl">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">New announcement</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Every member of this gym sees this in their app automatically — nothing to add them to, they're already here because they joined through this gym's signup link.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. November webinar — Fuelling for strength"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">Link <span className="text-zinc-600 font-normal">(optional — e.g. your Loom recording)</span></label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.loom.com/share/…"
            type="url"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">Note <span className="text-zinc-600 font-normal">(optional)</span></label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="A line or two of context…"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          onClick={handlePost}
          disabled={posting || !title.trim()}
          className="text-sm font-semibold px-4 py-2 rounded-xl text-zinc-900 hover:opacity-90 disabled:opacity-50 transition-opacity"
          style={{ backgroundColor: 'var(--nc-primary)' }}
        >
          {posting ? 'Posting…' : 'Post announcement'}
        </button>
      </div>

      {announcements.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl divide-y divide-zinc-800 max-w-xl">
          {announcements.map((a) => (
            <div key={a.id} className="px-5 py-4 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-100">{a.title}</p>
                <button
                  onClick={() => handleRemove(a.id)}
                  disabled={removingId === a.id}
                  className="text-xs font-medium text-red-400 hover:text-red-300 disabled:opacity-50 flex-shrink-0"
                >
                  {removingId === a.id ? 'Removing…' : 'Remove'}
                </button>
              </div>
              {a.url && <p className="text-sm font-mono text-emerald-400 truncate">{a.url}</p>}
              {a.note && <p className="text-xs text-zinc-400">{a.note}</p>}
              <p className="text-xs text-zinc-600">{fmtDate(a.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
