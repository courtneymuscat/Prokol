import { redirect } from 'next/navigation'
import { requireCoach } from '@/lib/coach'
import ResourcesManager from './ResourcesManager'

export default async function ResourcesPage() {
  const coachId = await requireCoach()
  if (!coachId) redirect('/dashboard')
  return <ResourcesManager />
}
