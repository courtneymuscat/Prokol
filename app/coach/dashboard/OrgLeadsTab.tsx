'use client'

import { useEffect, useState } from 'react'

type Lead = {
  id: string; name: string; email: string | null; phone: string | null
  source: string; status: string; notes: string | null
  follow_up_done: boolean; follow_up_date: string | null; created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700', contacted: 'bg-yellow-100 text-yellow-700',
  follow_up: 'bg-orange-100 text-orange-700', qualified: 'bg-purple-100 text-purple-700',
  won: 'bg-green-100 text-green-700', lost: 'bg-gray-100 text-gray-500',
}
const STATUS_LABELS: Record<string, string> = {
  new: 'New', contacted: 'Contacted', follow_up: 'Follow Up',
  qualified: 'Qualified', won: 'Won', lost: 'Lost',
}
const SOURCES = ['instagram', 'facebook', 'referral', 'website', 'cold_outreach', 'event', 'other']
const SOURCE_LABELS: Record<string, string> = {
  instagram: 'Instagram', facebook: 'Facebook', referral: 'Referral',
  website: 'Website', cold_outreach: 'Cold Outreach', event: 'Event', other: 'Other',
}
const EMPTY = { name: '', email: '', phone: '', source: 'other', status: 'new', notes: '', follow_up_done: false, follow_up_date: '' }

export default function OrgLeadsTab() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Lead | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/org/leads').then(r => r.json()).then(d => setLeads(d.leads ?? [])).finally(() => setLoading(false))
  }, [])

  function openAdd() { setEditing(null); setForm({ ...EMPTY }); setShowModal(true) }
  function openEdit(l: Lead) {
    setEditing(l)
    setForm({ name: l.name, email: l.email ?? '', phone: l.phone ?? '', source: l.source, status: l.status, notes: l.notes ?? '', follow_up_done: l.follow_up_done, follow_up_date: l.follow_up_date ?? '' })
    setShowModal(true)
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    const body = { ...form, email: form.email || null, phone: form.phone || null, notes: form.notes || null, follow_up_date: form.follow_up_date || null }
    if (editing) {
      const r = await fetch(`/api/org/leads/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json()
      setLeads(p => p.map(l => l.id === editing.id ? d.lead : l))
    } else {
      const r = await fetch('/api/org/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json()
      setLeads(p => [d.lead, ...p])
    }
    setSaving(false); setShowModal(false)
  }

  async function toggleFollowUp(lead: Lead) {
    const updated = { ...lead, follow_up_done: !lead.follow_up_done }
    setLeads(p => p.map(l => l.id === lead.id ? updated : l))
    await fetch(`/api/org/leads/${lead.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ follow_up_done: updated.follow_up_done }) })
  }

  async function deleteLead(lead: Lead) {
    if (!confirm(`Delete "${lead.name}"?`)) return
    setLeads(p => p.filter(l => l.id !== lead.id))
    await fetch(`/api/org/leads/${lead.id}`, { method: 'DELETE' })
  }

  const filtered = filterStatus === 'all' ? leads : leads.filter(l => l.status === filterStatus)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{leads.length} lead{leads.length !== 1 ? 's' : ''}</p>
        <button onClick={openAdd} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700 transition-colors">+ Add Lead</button>
      </div>

      {/* Status filter pills */}
      <div className="flex gap-2 flex-wrap">
        {['all', ...Object.keys(STATUS_LABELS)].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors border ${filterStatus === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
            {s === 'all' ? 'All' : STATUS_LABELS[s]} <span className="opacity-50">({s === 'all' ? leads.length : leads.filter(l => l.status === s).length})</span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">No leads yet. Add your first prospect.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50">
                  {['Name', 'Contact', 'Source', 'Status', 'Follow-up', 'Notes', 'Added', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(lead => (
                  <tr key={lead.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{lead.name}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {lead.email && <div>{lead.email}</div>}
                      {lead.phone && <div className="text-gray-400">{lead.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{SOURCE_LABELS[lead.source] ?? lead.source}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[lead.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {STATUS_LABELS[lead.status] ?? lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleFollowUp(lead)}
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${lead.follow_up_done ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-gray-400'}`}>
                          {lead.follow_up_done && <span className="text-[10px] leading-none">✓</span>}
                        </button>
                        {lead.follow_up_date && (
                          <span className="text-xs text-gray-400">{new Date(lead.follow_up_date).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-[180px] truncate">{lead.notes ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(lead.created_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => openEdit(lead)} className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors">Edit</button>
                        <button onClick={() => deleteLead(lead)} className="text-xs text-gray-300 hover:text-red-500 px-2 py-1 rounded hover:bg-red-50 transition-colors">Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-gray-900 mb-5">{editing ? 'Edit Lead' : 'Add Lead'}</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 block mb-1">Name *</label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Email</label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" type="email" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Phone</label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+61 400 000 000" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Source</label>
                  <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                    {SOURCES.map(s => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Status</label>
                  <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Follow-up Date</label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.follow_up_date} onChange={e => setForm(f => ({ ...f, follow_up_date: e.target.value }))} type="date" />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input id="fu" type="checkbox" checked={form.follow_up_done} onChange={e => setForm(f => ({ ...f, follow_up_done: e.target.checked }))} className="rounded border-gray-300" />
                  <label htmlFor="fu" className="text-xs text-gray-600">Follow-up done</label>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 block mb-1">Notes</label>
                  <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes about this lead…" rows={3} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={save} disabled={saving || !form.name.trim()} className="text-sm font-medium bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
