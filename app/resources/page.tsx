import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type Resource = {
  id: string
  name: string
  description: string | null
  type: 'link' | 'video' | 'pdf' | 'document' | 'image'
  url: string | null
  coach_resource_folders: { name: string; icon: string; color: string } | null
}

type Assignment = {
  id: string
  assigned_at: string
  coach_resources: Resource | null
}

const TYPE_META: Record<string, { icon: string; label: string; bg: string; text: string; border: string }> = {
  link:     { icon: '🔗', label: 'Link',     bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-100' },
  video:    { icon: '🎬', label: 'Video',    bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-100' },
  pdf:      { icon: '📄', label: 'PDF',      bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-100' },
  document: { icon: '📝', label: 'Document', bg: 'bg-gray-50',   text: 'text-gray-700',   border: 'border-gray-200' },
  image:    { icon: '🖼️', label: 'Image',    bg: 'bg-gray-50',   text: 'text-gray-700',   border: 'border-gray-200' },
}

const FOLDER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
  green:  { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200' },
  red:    { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200' },
  gray:   { bg: 'bg-gray-100',  text: 'text-gray-600',   border: 'border-gray-200' },
}

export default async function ResourcesPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  // Use admin client — client_resource_access may not have an RLS policy for client reads
  const admin = createAdminClient()
  const { data } = await admin
    .from('client_resource_access')
    .select('id, assigned_at, coach_resources(id, name, description, type, url, coach_resource_folders(id, name, color, icon))')
    .eq('client_id', session.user.id)
    .order('assigned_at', { ascending: false })

  const assignments: Assignment[] = (data ?? []) as unknown as Assignment[]
  const resources = assignments.map(a => a.coach_resources).filter(Boolean) as Resource[]

  // Group by folder
  const folders = new Map<string, { name: string; icon: string; color: string; resources: Resource[] }>()
  const unfiled: Resource[] = []

  for (const r of resources) {
    if (r.coach_resource_folders) {
      const key = r.coach_resource_folders.name
      if (!folders.has(key)) {
        folders.set(key, { ...r.coach_resource_folders, resources: [] })
      }
      folders.get(key)!.resources.push(r)
    } else {
      unfiled.push(r)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white px-6 py-3.5 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-20">
        <a href="/settings" className="text-gray-400 hover:text-gray-700 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </a>
        <span className="text-[15px] font-bold tracking-tight text-gray-900">My Resources</span>
      </nav>

      <main className="max-w-lg mx-auto p-6 space-y-6">
        {resources.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed p-8 text-center">
            <p className="text-2xl mb-2">📚</p>
            <p className="text-sm font-semibold text-gray-700">No resources yet</p>
            <p className="text-xs text-gray-400 mt-1">Your coach will share guides, videos, and links here.</p>
          </div>
        ) : (
          <>
            {Array.from(folders.values()).map(folder => {
              const colors = FOLDER_COLORS[folder.color] ?? FOLDER_COLORS.gray
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

            {unfiled.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 mb-3">Other</h2>
                <div className="space-y-2">
                  {unfiled.map(r => <ResourceCard key={r.id} resource={r} />)}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function ResourceCard({ resource: r }: { resource: Resource }) {
  const meta = TYPE_META[r.type] ?? TYPE_META.document

  // Image type gets a full-bleed preview card
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
