'use server'

import { createClient } from '@/lib/supabase/server'
import { updateCoachTier, suspendAccount } from '@/lib/admin'

async function getAdminId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  if (profile?.role !== 'platform_admin') return null
  return session.user.id
}

export async function actionUpdateCoachTier(coachId: string, newTier: string) {
  const adminId = await getAdminId()
  if (!adminId) return { error: 'Unauthorized' }
  return updateCoachTier(coachId, newTier, adminId)
}

export async function actionSuspendAccount(userId: string, reason: string) {
  const adminId = await getAdminId()
  if (!adminId) return { error: 'Unauthorized' }
  return suspendAccount(userId, adminId, reason)
}
