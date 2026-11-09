import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ResourcesList from './ResourcesList'
import ResourcesTourStep from './ResourcesTourStep'

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
      <ResourcesTourStep hasResources={resources.length > 0} />
      <nav className="bg-white px-6 py-3.5 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-20">
        <a href="/settings" className="text-gray-400 hover:text-gray-700 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </a>
        <span className="text-[15px] font-bold tracking-tight text-gray-900">My Resources</span>
      </nav>

      <main className="max-w-lg mx-auto p-6">
        {resources.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed p-8 text-center">
            <p className="text-2xl mb-2">📚</p>
            <p className="text-sm font-semibold text-gray-700">No resources yet</p>
            <p className="text-xs text-gray-400 mt-1">Your coach will share guides, videos, and links here.</p>
          </div>
        ) : (
          <ResourcesList folders={Array.from(folders.values())} unfiled={unfiled} />
        )}
      </main>
    </div>
  )
}
