import Link from 'next/link'
import { requirePlatformAdmin } from '@/lib/admin'
import NewGymForm from './NewGymForm'

export const dynamic = 'force-dynamic'

export default async function NewGymPage() {
  await requirePlatformAdmin()

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/gyms" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">← Gyms</Link>
        <h1 className="text-2xl font-bold text-zinc-100 mt-2">Add a gym</h1>
        <p className="text-sm text-zinc-500 mt-1">Creates a fully branded, white-labelled organisation — live instantly, no setup required on the gym's end.</p>
      </div>
      <NewGymForm />
    </div>
  )
}
