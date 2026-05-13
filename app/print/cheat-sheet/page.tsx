import { requireCoach } from '@/lib/coach'
import { redirect } from 'next/navigation'
import PrintCheatSheet from './PrintCheatSheet'

export default async function CheatSheetPrintPage() {
  const coachId = await requireCoach()
  if (!coachId) redirect('/dashboard')

  return <PrintCheatSheet />
}
