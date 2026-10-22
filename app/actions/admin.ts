'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  updateCoachTier,
  suspendAccount,
  setOrgTenantType,
  revokeWhiteLabel,
  reinstateWhiteLabel,
  deleteWhiteLabelApplication,
  createGymOrg,
  enterGymOrg,
  exitToHomeOrg,
  type CreateGymOrgParams,
} from '@/lib/admin'
import {
  publishMasterTemplate,
  unpublishMasterTemplate,
  grantMasterTemplateAccess,
  revokeMasterTemplateAccess,
  type MasterLibraryTable,
} from '@/lib/org'

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

export async function actionSetOrgTenantType(orgId: string, tenantType: 'coaching_business' | 'gym') {
  const adminId = await getAdminId()
  if (!adminId) return { error: 'Unauthorized' }
  return setOrgTenantType(orgId, tenantType, adminId)
}

export async function actionCreateGymOrg(params: CreateGymOrgParams) {
  const adminId = await getAdminId()
  if (!adminId) return { error: 'Unauthorized' }
  return createGymOrg(params, adminId)
}

/**
 * Makes the admin "enter" a gym she owns — becomes its real owner-coach for
 * the rest of this session, reusing the entire coach dashboard. Redirects
 * itself on success so this can be used directly as a <form action={...}>
 * target with no client-side handling needed — a bare `<form>` action must
 * return void/Promise<void>, so failures (ownership check, DB error) are
 * logged server-side rather than returned; the only realistic failure mode
 * is an infra error, since the UI that calls this only ever lists orgs the
 * admin already owns.
 */
export async function actionEnterGymOrg(gymOrgId: string): Promise<void> {
  const adminId = await getAdminId()
  if (!adminId) { console.error('actionEnterGymOrg: unauthorized'); return }
  const result = await enterGymOrg(gymOrgId, adminId)
  if (result.error) { console.error('actionEnterGymOrg:', result.error); return }
  redirect('/coach/dashboard')
}

/** Reverses actionEnterGymOrg — back to the admin's own home organisation. */
export async function actionExitToHomeOrg(): Promise<void> {
  const adminId = await getAdminId()
  if (!adminId) { console.error('actionExitToHomeOrg: unauthorized'); return }
  const result = await exitToHomeOrg(adminId)
  if (result.error) { console.error('actionExitToHomeOrg:', result.error); return }
  redirect('/admin/gyms')
}

export async function actionRevokeWhiteLabel(orgId: string) {
  const adminId = await getAdminId()
  if (!adminId) return { error: 'Unauthorized' }
  return revokeWhiteLabel(orgId, adminId)
}

export async function actionReinstateWhiteLabel(orgId: string) {
  const adminId = await getAdminId()
  if (!adminId) return { error: 'Unauthorized' }
  return reinstateWhiteLabel(orgId, adminId)
}

export async function actionDeleteWhiteLabelApplication(orgId: string) {
  const adminId = await getAdminId()
  if (!adminId) return { error: 'Unauthorized' }
  return deleteWhiteLabelApplication(orgId, adminId)
}

export async function actionPublishTemplate(templateId: string, templateTable: MasterLibraryTable, orgId: string) {
  const adminId = await getAdminId()
  if (!adminId) return { error: 'Unauthorized' }
  return publishMasterTemplate(adminId, templateId, templateTable, orgId)
}

export async function actionUnpublishTemplate(publicationId: string) {
  const adminId = await getAdminId()
  if (!adminId) return { error: 'Unauthorized' }
  return unpublishMasterTemplate(adminId, publicationId)
}

export async function actionGrantMasterTemplateAccess(
  templateId: string,
  templateTable: MasterLibraryTable,
  orgId: string,
  coachId: string,
) {
  const adminId = await getAdminId()
  if (!adminId) return { error: 'Unauthorized' }
  return grantMasterTemplateAccess(adminId, templateId, templateTable, orgId, coachId)
}

export async function actionRevokeMasterTemplateAccess(
  templateId: string,
  templateTable: MasterLibraryTable,
  orgId: string,
  coachId: string,
) {
  const adminId = await getAdminId()
  if (!adminId) return { error: 'Unauthorized' }
  return revokeMasterTemplateAccess(adminId, templateId, templateTable, orgId, coachId)
}
