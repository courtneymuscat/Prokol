'use client'

import { useState, useTransition } from 'react'
import {
  actionSetOrgTenantType,
  actionPublishTemplate,
  actionUnpublishTemplate,
  actionGrantMasterTemplateAccess,
  actionRevokeMasterTemplateAccess,
  actionRevokeWhiteLabel,
  actionReinstateWhiteLabel,
  actionRemoveWhiteLabelDomain,
  actionSetWhiteLabelDomain,
} from '@/app/actions/admin'
import type { OrgDetail, OrgMemberRow, PublicationWithGrants, ArchivedClientRow, PendingWhiteLabelApplication } from '@/lib/admin'
import type { OrgAnalytics, OrgLead } from '@/lib/org'
import AdminAnalyticsView from '../../AdminAnalyticsView'
import AdminOrgLeadsPanel from './AdminOrgLeadsPanel'

type PublishableTemplate = { id: string; name: string }

const TABS = [
  { id: 'org', label: 'Organisation' },
  { id: 'leads', label: 'Leads' },
  { id: 'archived', label: 'Archived' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'templates', label: 'Templates' },
] as const
type TabId = typeof TABS[number]['id']

export default function OrgDetailClient({
  org,
  members,
  publications,
  publishableTemplates,
  archivedClients,
  pendingWhiteLabelApplication,
  analytics,
  initialLeads,
}: {
  org: OrgDetail
  members: OrgMemberRow[]
  publications: PublicationWithGrants[]
  publishableTemplates: PublishableTemplate[]
  archivedClients: ArchivedClientRow[]
  pendingWhiteLabelApplication: PendingWhiteLabelApplication | null
  analytics: OrgAnalytics
  initialLeads: OrgLead[]
}) {
  const [activeTab, setActiveTab] = useState<TabId>('org')
  const [tenantType, setTenantType] = useState(org.tenant_type)
  const [tenantTypeSaving, startTenantTypeTransition] = useTransition()
  const [tenantTypeMsg, setTenantTypeMsg] = useState<string | null>(null)

  const [isWhiteLabel, setIsWhiteLabel] = useState(org.is_white_label)
  const [revokePending, startRevokeTransition] = useTransition()
  const [revokeError, setRevokeError] = useState<string | null>(null)

  const [reinstatePending, startReinstateTransition] = useTransition()
  const [reinstateError, setReinstateError] = useState<string | null>(null)

  const [customDomain, setCustomDomain] = useState(org.custom_domain)
  const [removeDomainPending, startRemoveDomainTransition] = useTransition()
  const [removeDomainError, setRemoveDomainError] = useState<string | null>(null)

  const [domainInput, setDomainInput] = useState('')
  const [setDomainPending, startSetDomainTransition] = useTransition()
  const [setDomainError, setSetDomainError] = useState<string | null>(null)

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

  function handleRevokeWhiteLabel() {
    if (!confirm(`Turn off white-label for ${org.name}? This won't delete their domain or branding — it can be re-approved later.`)) return
    setRevokeError(null)
    startRevokeTransition(async () => {
      const result = await actionRevokeWhiteLabel(org.id)
      if (result.error) {
        setRevokeError(result.error)
      } else {
        setIsWhiteLabel(false)
      }
    })
  }

  function handleReinstateWhiteLabel() {
    if (!confirm(`Turn white-label back on for ${org.name}? Their active clients will be emailed to re-add their home screen icon.`)) return
    setReinstateError(null)
    startReinstateTransition(async () => {
      const result = await actionReinstateWhiteLabel(org.id)
      if (result.error) {
        setReinstateError(result.error)
      } else {
        setIsWhiteLabel(true)
      }
    })
  }

  function handleSetDomain() {
    if (!domainInput.trim()) return
    setSetDomainError(null)
    startSetDomainTransition(async () => {
      const result = await actionSetWhiteLabelDomain(org.id, domainInput.trim())
      if (result.error) {
        setSetDomainError(result.error)
      } else {
        setCustomDomain(domainInput.trim().toLowerCase())
        setDomainInput('')
      }
    })
  }

  function handleRemoveDomain() {
    if (!customDomain) return
    if (!confirm(`Remove the custom domain ${customDomain} from ${org.name}? They'll fall back to their free ${org.slug}.prokol.io subdomain.`)) return
    setRemoveDomainError(null)
    startRemoveDomainTransition(async () => {
      const result = await actionRemoveWhiteLabelDomain(org.id)
      if (result.error) {
        setRemoveDomainError(result.error)
      } else {
        setCustomDomain(null)
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

  const [wlApp, setWlApp] = useState(pendingWhiteLabelApplication)
  const [wlPending, startWlTransition] = useTransition()
  const [wlRejectOpen, setWlRejectOpen] = useState(false)
  const [wlRejectReason, setWlRejectReason] = useState('')
  const [wlError, setWlError] = useState<string | null>(null)

  function handleApproveWhiteLabel() {
    if (!wlApp) return
    setWlError(null)
    startWlTransition(async () => {
      const res = await fetch(`/api/admin/white-label/${wlApp.id}/approve`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setWlApp(null)
        window.location.reload()
      } else {
        setWlError(data.error ?? 'Failed to approve')
      }
    })
  }

  function handleRejectWhiteLabel() {
    if (!wlApp || !wlRejectReason.trim()) return
    setWlError(null)
    startWlTransition(async () => {
      const res = await fetch(`/api/admin/white-label/${wlApp.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: wlRejectReason }),
      })
      const data = await res.json()
      if (data.success) {
        setWlApp(null)
        setWlRejectOpen(false)
      } else {
        setWlError(data.error ?? 'Failed to reject')
      }
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
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-zinc-800 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === t.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'org' && (
      <>
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

      {/* White-label */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-300">White-label</h2>
          <div className="flex items-center gap-3">
            {customDomain && (
              <button
                onClick={handleRemoveDomain}
                disabled={removeDomainPending}
                className="text-xs font-medium text-amber-400 hover:text-amber-300 disabled:opacity-50 transition-colors"
              >
                {removeDomainPending ? 'Removing…' : 'Remove domain'}
              </button>
            )}
            {isWhiteLabel ? (
              <button
                onClick={handleRevokeWhiteLabel}
                disabled={revokePending}
                className="text-xs font-medium text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
              >
                {revokePending ? 'Turning off…' : 'Turn off white-label'}
              </button>
            ) : (
              <button
                onClick={handleReinstateWhiteLabel}
                disabled={reinstatePending}
                className="text-xs font-medium text-green-400 hover:text-green-300 disabled:opacity-50 transition-colors"
              >
                {reinstatePending ? 'Reinstating…' : 'Reinstate white-label'}
              </button>
            )}
          </div>
        </div>
        {revokeError && <p className="text-xs text-red-400">{revokeError}</p>}
        {reinstateError && <p className="text-xs text-red-400">{reinstateError}</p>}
        {removeDomainError && <p className="text-xs text-red-400">{removeDomainError}</p>}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <p className="text-zinc-500 mb-1">Status</p>
            <p className="text-zinc-200">{isWhiteLabel ? 'White-labelled' : 'Standard branding'}</p>
          </div>
          <div>
            <p className="text-zinc-500 mb-1">Tier</p>
            <p className="text-zinc-200">{org.white_label_tier ?? '—'}</p>
          </div>
          <div>
            <p className="text-zinc-500 mb-1">Custom domain</p>
            <p className="text-zinc-200">{customDomain ?? '— (optional)'}</p>
          </div>
          <div>
            <p className="text-zinc-500 mb-1">Domain verified</p>
            <p className="text-zinc-200">{customDomain ? (org.custom_domain_verified ? 'Yes' : 'No') : '—'}</p>
          </div>
        </div>

        {!customDomain && (
          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              placeholder="app.theirgym.com"
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={handleSetDomain}
              disabled={setDomainPending || !domainInput.trim()}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-800 text-blue-200 hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {setDomainPending ? 'Setting…' : 'Set custom domain'}
            </button>
          </div>
        )}
        {setDomainError && <p className="text-xs text-red-400">{setDomainError}</p>}

        {isWhiteLabel && (
          <div className="bg-green-900/15 border border-green-800/60 rounded-lg px-4 py-2.5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold text-green-400 uppercase tracking-wide">Free subdomain — live instantly, no DNS needed</p>
              <a
                href={`https://${org.slug}.prokol.io`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-green-300 hover:underline"
              >
                {org.slug}.prokol.io ↗
              </a>
            </div>
          </div>
        )}

        {wlApp && (
          <div className="bg-amber-900/15 border border-amber-800/60 rounded-lg px-4 py-3 space-y-3">
            <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide">Pending white-label application</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <p className="text-zinc-500 mb-1">App name</p>
                <p className="text-zinc-200">{wlApp.app_name}</p>
              </div>
              <div>
                <p className="text-zinc-500 mb-1">Domain</p>
                <p className="text-zinc-200 font-mono">{wlApp.custom_domain}</p>
              </div>
              <div>
                <p className="text-zinc-500 mb-1">Requested tier</p>
                <p className="text-zinc-200">{wlApp.requested_tier}</p>
              </div>
              <div>
                <p className="text-zinc-500 mb-1">Submitted</p>
                <p className="text-zinc-200">{wlApp.submitted_at ? new Date(wlApp.submitted_at).toLocaleDateString() : '—'}</p>
              </div>
            </div>
            {wlError && <p className="text-xs text-red-400">{wlError}</p>}
            {!wlRejectOpen ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleApproveWhiteLabel}
                  disabled={wlPending}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-800 text-green-200 hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {wlPending ? 'Approving…' : 'Approve'}
                </button>
                <button
                  onClick={() => { setWlRejectOpen(true); setWlRejectReason('') }}
                  disabled={wlPending}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-900/50 text-red-300 hover:bg-red-800/60 disabled:opacity-50 transition-colors"
                >
                  Reject
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  placeholder="Reason for rejection (sent to org owner)…"
                  value={wlRejectReason}
                  onChange={(e) => setWlRejectReason(e.target.value)}
                  rows={2}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRejectWhiteLabel}
                    disabled={wlPending || !wlRejectReason.trim()}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {wlPending ? 'Rejecting…' : 'Confirm reject'}
                  </button>
                  <button
                    onClick={() => setWlRejectOpen(false)}
                    className="text-xs px-3 py-1.5 rounded-md text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {!wlApp && !isWhiteLabel && (
          <p className="text-xs text-zinc-500">No pending or active white-label setup for this org.</p>
        )}
      </div>
      </>
      )}

      {activeTab === 'leads' && (
        <AdminOrgLeadsPanel orgId={org.id} initialLeads={initialLeads} />
      )}

      {activeTab === 'analytics' && (
        <AdminAnalyticsView data={analytics} />
      )}

      {activeTab === 'archived' && (
      <>
      {/* Archived clients */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-zinc-300">Archived clients ({archivedClients.length})</h2>
        {archivedClients.length === 0 ? (
          <p className="text-xs text-zinc-500">No archived clients for this org&apos;s coaches.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500">
                  <th className="text-left py-2 pr-4 font-medium">Client</th>
                  <th className="text-left py-2 font-medium">Archived</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {archivedClients.map((c) => (
                  <tr key={c.client_id}>
                    <td className="py-2 pr-4">
                      <div className="text-zinc-200">{c.client_name ?? <span className="text-zinc-500 italic">No name</span>}</div>
                      <div className="text-zinc-500">{c.client_email ?? '—'}</div>
                    </td>
                    <td className="py-2 text-zinc-400">
                      {c.archived_at ? new Date(c.archived_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}

      {activeTab === 'templates' && (
      <>
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
      </>
      )}
    </div>
  )
}
