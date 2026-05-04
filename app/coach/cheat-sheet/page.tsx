import { requireCoach } from '@/lib/coach'
import { redirect } from 'next/navigation'
import CheatSheetEditor from './CheatSheetEditor'

export default async function CheatSheetPage() {
  const coachId = await requireCoach()
  if (!coachId) redirect('/dashboard')

  return (
    <main className="flex-1 p-6 space-y-6 w-full">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Food Cheat Sheet</h1>
        <p className="text-sm text-gray-500 mt-1">
          Your serve-based food exchange list. Clients see this as a simple reference guide.
        </p>
      </div>
      <CheatSheetEditor />
    </main>
  )
}
