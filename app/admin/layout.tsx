import { requirePlatformAdmin } from '@/lib/admin'
import Link from 'next/link'
import { logout } from '@/app/actions/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePlatformAdmin()

  const navLinks = [
    { href: '/admin', label: 'Overview' },
    { href: '/admin/coaches', label: 'Coaches' },
    { href: '/admin/orgs', label: 'Organisations' },
    { href: '/admin/leads', label: 'Leads' },
    { href: '/admin/archived', label: 'Archived' },
    { href: '/admin/analytics', label: 'Analytics' },
    { href: '/admin/white-label', label: 'White-label' },
    { href: '/admin/features', label: 'Features' },
    { href: '/admin/audit', label: 'Audit Log' },
  ]

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top bar */}
      <header className="bg-zinc-900 border-b border-zinc-700 px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-6">
          <span className="text-xs font-bold tracking-widest text-red-400 uppercase">
            ⚠ ADMIN MODE
          </span>
          <nav className="flex items-center gap-1">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-xs font-medium text-zinc-400 hover:text-zinc-100 px-3 py-1.5 rounded-md hover:bg-zinc-800 transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-zinc-400">
            {admin.full_name ?? admin.email}
          </span>
          <Link
            href="/dashboard"
            className="text-xs font-medium text-zinc-400 hover:text-zinc-100 px-3 py-1.5 rounded-md hover:bg-zinc-800 transition-colors"
          >
            ← Back to app
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="text-xs font-medium text-zinc-400 hover:text-red-400 px-3 py-1.5 rounded-md hover:bg-zinc-800 transition-colors"
            >
              Log out
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
