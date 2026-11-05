import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function AnnouncementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('org_id').eq('id', user.id).maybeSingle()
  if (!profile?.org_id) redirect('/more')

  const { data } = await admin
    .from('org_announcements')
    .select('id, title, url, note, created_at')
    .eq('org_id', profile.org_id)
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  const announcements = data ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white px-6 py-3.5 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-20">
        <a href="/more" className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </a>
        <h1 className="text-[15px] font-bold text-gray-900">Announcements</h1>
      </nav>
      <main className="max-w-lg mx-auto p-4 space-y-3">
        {announcements.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-12">Nothing posted yet.</p>
        )}
        {announcements.map((a) => (
          <div key={a.id} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
            <p className="text-sm font-semibold text-gray-900">{a.title}</p>
            {a.note && <p className="text-sm text-gray-600">{a.note}</p>}
            {a.url && (
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
              >
                Watch
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6v6M20 4L10 14" />
                </svg>
              </a>
            )}
            <p className="text-xs text-gray-400">{fmtDate(a.created_at)}</p>
          </div>
        ))}
      </main>
    </div>
  )
}
