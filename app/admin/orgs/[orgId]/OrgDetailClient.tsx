'use client'

import { useState, useTransition } from 'react'
import {
  actionSetOrgTenantType,
  actionPublishTemplate,
  actionUnpublishTemplate,
  actionGrantMasterTemplateAccess,
  actionRevokeMasterTemplateAccess,
} from '@/app/actions/admin'
import type { OrgDetail, OrgMemberRow, PublicationWithGrants } from '@/lib/admin'

type PublishableTemplate = { id: string; name: string }

export default function OrgDetailClient({
  org,
  members,
  publications,
  publishableTemplates,
}: {
  org: OrgDetail
  members: OrgMemberRow[]
  publications: PublicationWithGrants[]
  publishableTemplates: PublishableTemplate[]
}) {
  const [tenantType, setTenantType] = useState(org.tenant_type)
  const [tenantTypeSaving, startTenantTypeTransition] = useTransition()
  const [tenantTypeMsg, setTenantTypeMsg] = useState<string | null>(null)

  const [pubList, setPubList] = useState(publications)
  const [selectedTemplateId, setSelectedTemplateId] = useState(publishableTemplates[0]?.id ?? '')
  const [publishPending, startPublishTransition] = useTransition()
  const [publishError, setPublishError] = useState<string | null>(null)
  const [unpublishingId, setUnpublishingId] = useState<string | null>(null)

  const templateNameById = Object.fromEntries(publishableTemplates.map((t) => [t.id, t.name]))

  function handleTenantTypeChange(next: 'coaching_business' | 'gym') {
    setTenantType(next)
    setTenantTypeMsg(null)
    startTenantTypeTransition(async () => {
      const result = await actionSetOrgTenantType(org.id, next)
      if (result.error) {
        setTenantType(org.tenant_type) // revert on failure
        setTenantTypeMsg(result.error)
      } else {
        setTenantTypeMsg('Saved.')
      }
    })
  }

  function handlePublish() {
    if (!selectedTemplateId) return
    setPublishError(null)
    startPublishTransition(async () => {
      const result = await actionPublishTemplate(selectedTemplateId, 'autoflow_templates', org.id)
      if (result.error) {
        setPublishError(result.error)
      } else if (result.data) {
        setPubList((prev) => [
          { id: result.data!.id, template_id: selectedTemplateId, template_table: 'autoflow_templates', published_at: new Date().toISOString(), grantedCoachIds: [] },
          ...prev,
        ])
      }
    })
  }

  function handleUnpublish(publicationId: string) {
    setUnpublishingId(publicationId)
    startPublishTransition(async () => {
      const result = await actionUnpublishTemplate(publicationId)
      if (!result.error) {
        setPubList((prev) => prev.filter((p) => p.id !== publicationId))
      }
      setUnpublishingId(null)
    })
  }

  const [togglingKey, setTogglingKey] = useState<string | null>(null)

  function handleToggleCoachAccess(pub: PublicationWithGrants, coachId: string, currentlyGranted: boolean) {
    const key = `${pub.id}:${coachId}`
    setTogglingKey(key)
    // Optimistic update
    setPubList((prev) => prev.map((p) => {
      if (p.id !== pub.id) return p
      const grantedCoachIds = currentlyGranted
        ? p.grantedCoachIds.filter((id) => id !== coachId)
        : [...p.grantedCoachIds, coachId]
      return { ...p, grantedCoachIds }
    }))
    startPublishTransition(async () => {
      const result = currentlyGranted
        ? await actionRevokeMasterTemplateAccess(pub.template_id, 'autoflow_templates', org.id, coachId)
        : await actionGrantMasterTemplateAccess(pub.template_id, 'autoflow_templates', org.id, coachId)
      if (result.error) {
        // Revert on failure
        setPubList((prev) => prev.map((p) => {
          if (p.id !== pub.id) return p
          const grantedCoachIds = currentlyGranted
            ? [...p.grantedCoachIds, coachId]
            : p.grantedCoachIds.filter((id) => id !== coachId)
          return { ...p, grantedCoachIds }
        }))
      }
      setTogglingKey(null)
    })
  }

  return (
    <div className="space-y-6">
      {/* Org info + tenant type */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-300">Organisation</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <p className="text-zinc-500 mb-1">Subscription tier</p>
            <p className="text-zinc-200">{org.subscription_tier}</p>
          </div>
          <div>
            <p className="text-zinc-500 mb-1">Billing status</p>
            <p className="text-zinc-200">{org.billing_status}</p>
          </div>
          <div>
            <p className="text-zinc-500 mb-1">Status</p>
            <p className="text-zinc-200">{org.is_active ? 'Active' : 'Inactive'}</p>
          </div>
          <div>
            <p className="text-zinc-500 mb-1">Created</p>
            <p className="text-zinc-200">{org.created_at ? new Date(org.created_at).toLocaleDateString() : '—'}</p>
          </div>
        </div>
        <div className="pt-2 border-t border-zinc-800">
          <p className="text-zinc-500 text-xs mb-2">Tenant type</p>
          <div className="flex items-center gap-3">
            <select
              value={tenantType}
              onChange={(e) => handleTenantTypeChange(e.target.value as 'coaching_business' | 'gym')}
              disabled={tenantTypeSaving}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="coaching_business">Coaching business</option>
              <option value="gym">Gym</option>
            </select>
            {tenantTypeSaving && <span className="text-xs text-zinc-500">Saving…</span>}
            {!tenantTypeSaving && tenantTypeMsg && (
              <span className={`text-xs ${tenantTypeMsg === 'Saved.' ? 'text-green-400' : 'text-red-400'}`}>{tenantTypeMsg}</span>
            )}
          </div>
          <p className="text-zinc-600 text-[11px] mt-2">
            Gym tenants never get health-data visibility for their staff, regardless of any permission toggle — this is enforced in code, not just here.
          </p>
        </div>
      </div>

      {/* Members */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-zinc-300">Members ({members.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500">
                <th className="text-left py-2 pr-4 font-medium">Name</th>
                <th className="text-left py-2 pr-4 font-medium">Email</th>
                <th className="text-left py-2 pr-4 font-medium">Role</th>
                <th className="text-left py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="py-2 pr-4 text-zinc-200">{m.full_name ?? '—'}</td>
                  <td className="py-2 pr-4 text-zinc-400">{m.email ?? '—'}</td>
                  <td className="py-2 pr-4 text-zinc-400 capitalize">{m.role}</td>
                  <td className="py-2">
                    <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${m.is_active ? 'bg-green-900 text-green-300' : 'bg-zinc-700 text-zinc-400'}`}>
                      {m.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-zinc-500">No members yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Master templates published to this org */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-300">Master templates published to this org</h2>

        {publishableTemplates.length > 0 ? (
          <div className="flex items-center gap-2">
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {publishableTemplates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button
              onClick={handlePublish}
              disabled={publishPending || !selectedTemplateId}
              className="text-xs font-semibold px-4 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Publish
            </button>
          </div>
        ) : (
          <p className="text-xs text-zinc-500">You don&apos;t have any autoflow templates in your own organisation to publish yet.</p>
        )}
        {publishError && <p className="text-xs text-red-400">{publishError}</p>}

        <div className="divide-y divide-zinc-800/60">
          {pubList.map((p) => (
            <div key={p.id} className="py-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-200">{templateNameById[p.template_id] ?? p.template_id}</p>
                  <p className="text-[11px] text-zinc-500">Published {new Date(p.published_at).toLocaleDateString()}</p>
                </div>
                <button
                  onClick={() => handleUnpublish(p.id)}
                  disabled={publishPending && unpublishingId === p.id}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                >
                  {publishPending && unpublishingId === p.id ? 'Removing…' : 'Unpublish'}
                </button>
              </div>

              <div className="bg-zinc-800/50 rounded-lg px-3 py-2.5 space-y-1.5">
                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">
                  Who can see &amp; assign this (off by default)
                </p>
                {members.length === 0 && (
                  <p className="text-[11px] text-zinc-600">No coaches in this org yet.</p>
                )}
                {members.map((m) => {
                  const granted = p.grantedCoachIds.includes(m.user_id)
                  const key = `${p.id}:${m.user_id}`
                  return (
                    <div key={m.user_id} className="flex items-center justify-between">
                      <p className="text-xs text-zinc-300">
                        {m.full_name ?? m.email ?? m.user_id} <span className="text-zinc-500 capitalize">· {m.role}</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => handleToggleCoachAccess(p, m.user_id, granted)}
                        disabled={togglingKey === key}
                        role="switch"
                        aria-checked={granted}
                        className={[
                          'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50',
                          granted ? 'bg-indigo-600' : 'bg-zinc-700',
                        ].join(' ')}
                      >
                        <span className={['inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200', granted ? 'translate-x-4' : 'translate-x-0'].join(' ')} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {pubList.length === 0 && (
            <p className="text-xs text-zinc-500 py-2">Nothing published to this org yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
