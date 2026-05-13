import { requireCoach } from '@/lib/coach'
import { redirect } from 'next/navigation'
import CheatSheetEditor from './CheatSheetEditor'

export default async function CheatSheetPage() {
  const coachId = await requireCoach()
  if (!coachId) redirect('/dashboard')

  return (
    <main className="flex-1 p-6 space-y-6 w-full">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Food Cheat Sheet</h1>
          <p className="text-sm text-gray-500 mt-1">
            Your serve-based food exchange list. Clients see this as a simple reference guide.
          </p>
        </div>
        <a
          href="/print/cheat-sheet"
          target="_blank"
          rel="noopener noreferrer"
          className="border border-gray-200 text-gray-700 bg-white px-3 py-2 rounded-xl text-xs font-semibold hover:bg-gray-50 transition-colors flex items-center gap-1.5"
          title="Open a printable view and save as PDF"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          Download PDF
        </a>
      </div>
      <CheatSheetEditor />
    </main>
  )
}
