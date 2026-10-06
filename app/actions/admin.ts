'use server'

import { createClient } from '@/lib/supabase/server'
import {
  updateCoachTier,
  suspendAccount,
  setOrgTenantType,
  revokeWhiteLabel,
  reinstateWhiteLabel,
  removeWhiteLabelDomain,
  setWhiteLabelDomain,
  deleteWhiteLabelApplication,
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

export async function actionRemoveWhiteLabelDomain(orgId: string) {
  const adminId = await getAdminId()
  if (!adminId) return { error: 'Unauthorized' }
  return removeWhiteLabelDomain(orgId, adminId)
}

export async function actionSetWhiteLabelDomain(orgId: string, domain: string) {
  const adminId = await getAdminId()
  if (!adminId) return { error: 'Unauthorized' }
  return setWhiteLabelDomain(orgId, domain, adminId)
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
