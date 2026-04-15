import { requirePlatformAdmin } from '@/lib/admin'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function AdminAuditPage() {
  await requirePlatformAdmin()

  const admin = createAdminClient()
  const { data: logs } = await admin
    .from('admin_audit_log')
    .select(`
      id,
      action,
      old_value,
      new_value,
      created_at,
      admin:profiles!admin_audit_log_admin_id_fkey(full_name, email),
      target:profiles!admin_audit_log_target_user_id_fkey(full_name, email)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Audit Log</h1>
        <p className="text-sm text-zinc-500 mt-1">Last 100 admin actions — read only</p>
      </div>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Time</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Admin</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Action</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Target</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Old value</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">New value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {(logs ?? []).map(log => {
                const adminProfile = Array.isArray(log.admin) ? log.admin[0] : log.admin
                const targetProfile = Array.isArray(log.target) ? log.target[0] : log.target
                return (
                  <tr key={log.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">
                      {log.created_at
                        ? new Date(log.created_at).toLocaleString()
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-300 text-xs">
                      {(adminProfile as { full_name?: string; email?: string } | null)?.full_name
                        ?? (adminProfile as { full_name?: string; email?: string } | null)?.email
                        ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <ActionBadge action={log.action} />
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      {(targetProfile as { full_name?: string; email?: string } | null)?.full_name
                        ?? (targetProfile as { full_name?: string; email?: string } | null)?.email
                        ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs font-mono">{log.old_value ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-300 text-xs font-mono">{log.new_value ?? '—'}</td>
                  </tr>
                )
              })}
              {(logs ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-zinc-500 text-center text-xs">
                    No audit log entries yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ActionBadge({ action }: { action: string }) {
  const colors: Record<string, string> = {
    update_coach_tier: 'bg-blue-900 text-blue-300',
    suspend_account: 'bg-red-900 text-red-300',
  }
  const cls = colors[action] ?? 'bg-zinc-700 text-zinc-300'
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {action.replace(/_/g, ' ')}
    </span>
  )
}
