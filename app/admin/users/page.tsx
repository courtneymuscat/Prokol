import { requirePlatformAdmin, getAllUsers } from '@/lib/admin'
import UsersTable from './UsersTable'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const admin = await requirePlatformAdmin()
  const users = await getAllUsers()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">All Users</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {users.length} accounts across the whole platform
        </p>
      </div>
      <UsersTable users={users} currentAdminId={admin.id} />
    </div>
  )
}
