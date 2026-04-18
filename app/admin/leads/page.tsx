'use client'

import { useEffect, useState } from 'react'

type Lead = {
  id: string
  name: string
  email: string | null
  phone: string | null
  source: string
  status: string
  notes: string | null
  follow_up_done: boolean
  follow_up_date: string | null
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-900 text-blue-300',
  contacted: 'bg-yellow-900 text-yellow-300',
  follow_up: 'bg-orange-900 text-orange-300',
  qualified: 'bg-purple-900 text-purple-300',
  won: 'bg-green-900 text-green-300',
  lost: 'bg-zinc-700 text-zinc-400',
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  follow_up: 'Follow Up',
  qualified: 'Qualified',
  won: 'Won',
  lost: 'Lost',
}

const SOURCES = ['instagram', 'facebook', 'referral', 'website', 'cold_outreach', 'event', 'other']
const SOURCE_LABELS: Record<string, string> = {
  instagram: 'Instagram', facebook: 'Facebook', referral: 'Referral',
  website: 'Website', cold_outreach: 'Cold Outreach', event: 'Event', other: 'Other',
}

const EMPTY_FORM = {
  name: '', email: '', phone: '', source: 'other', status: 'new',
  notes: '', follow_up_done: false, follow_up_date: '',
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Lead | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/leads')
      .then(r => r.json())
      .then(d => setLeads(d.leads ?? []))
      .finally(() => setLoading(false))
  }, [])

  function openAdd() {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setShowModal(true)
  }

  function openEdit(lead: Lead) {
    setEditing(lead)
    setForm({
      name: lead.name,
      email: lead.email ?? '',
      phone: lead.phone ?? '',
      source: lead.source,
      status: lead.status,
      notes: lead.notes ?? '',
      follow_up_done: lead.follow_up_done,
      follow_up_date: lead.follow_up_date ?? '',
    })
    setShowModal(true)
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const body = {
        ...form,
        email: form.email || null,
        phone: form.phone || null,
        notes: form.notes || null,
        follow_up_date: form.follow_up_date || null,
      }
      if (editing) {
        const r = await fetch(`/api/admin/leads/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const d = await r.json()
        setLeads(prev => prev.map(l => l.id === editing.id ? d.lead : l))
      } else {
        const r = await fetch('/api/admin/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const d = await r.json()
        setLeads(prev => [d.lead, ...prev])
      }
      setShowModal(false)
    } finally {
      setSaving(false)
    }
  }

  async function toggleFollowUp(lead: Lead) {
    const updated = { ...lead, follow_up_done: !lead.follow_up_done }
    setLeads(prev => prev.map(l => l.id === lead.id ? updated : l))
    await fetch(`/api/admin/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ follow_up_done: updated.follow_up_done }),
    })
  }

  async function deleteLead(lead: Lead) {
    if (!confirm(`Delete lead "${lead.name}"?`)) return
    setLeads(prev => prev.filter(l => l.id !== lead.id))
    await fetch(`/api/admin/leads/${lead.id}`, { method: 'DELETE' })
  }

  const filtered = filterStatus === 'all' ? leads : leads.filter(l => l.status === filterStatus)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Leads</h1>
          <p className="text-sm text-zinc-500 mt-1">{leads.length} total leads</p>
        </div>
        <button
          onClick={openAdd}
          className="text-xs font-medium bg-zinc-100 text-zinc-900 px-4 py-2 rounded-lg hover:bg-white transition-colors"
        >
          + Add Lead
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {['all', ...Object.keys(STATUS_LABELS)].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              filterStatus === s
                ? 'bg-zinc-100 text-zinc-900'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {s === 'all' ? 'All' : STATUS_LABELS[s]}
            {' '}
            <span className="opacity-60">
              ({s === 'all' ? leads.length : leads.filter(l => l.status === s).length})
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-zinc-500 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 text-sm">No leads yet. Add your first one.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Contact</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Source</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Follow-up</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Notes</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Added</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filtered.map(lead => (
                  <tr key={lead.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="px-4 py-3 font-medium text-zinc-200">{lead.name}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      {lead.email && <div>{lead.email}</div>}
                      {lead.phone && <div className="text-zinc-500">{lead.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{SOURCE_LABELS[lead.source] ?? lead.source}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[lead.status] ?? 'bg-zinc-800 text-zinc-400'}`}>
                        {STATUS_LABELS[lead.status] ?? lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleFollowUp(lead)}
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            lead.follow_up_done
                              ? 'bg-green-600 border-green-600 text-white'
                              : 'border-zinc-600 hover:border-zinc-400'
                          }`}
                        >
                          {lead.follow_up_done && <span className="text-xs leading-none">✓</span>}
                        </button>
                        {lead.follow_up_date && (
                          <span className="text-xs text-zinc-500">
                            {new Date(lead.follow_up_date).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs max-w-[200px] truncate">
                      {lead.notes ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">
                      {new Date(lead.created_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => openEdit(lead)}
                          className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors px-2 py-1 rounded hover:bg-zinc-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteLead(lead)}
                          className="text-xs text-zinc-600 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-zinc-700"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setShowModal(false)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-zinc-100 mb-5">
              {editing ? 'Edit Lead' : 'Add Lead'}
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-zinc-500 block mb-1">Name *</label>
                  <input
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Email</label>
                  <input
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="email@example.com"
                    type="email"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Phone</label>
                  <input
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+61 400 000 000"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Source</label>
                  <select
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
                    value={form.source}
                    onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                  >
                    {SOURCES.map(s => (
                      <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Status</label>
                  <select
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  >
                    {Object.entries(STATUS_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Follow-up Date</label>
                  <input
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
                    value={form.follow_up_date}
                    onChange={e => setForm(f => ({ ...f, follow_up_date: e.target.value }))}
                    type="date"
                  />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    id="fu-done"
                    type="checkbox"
                    checked={form.follow_up_done}
                    onChange={e => setForm(f => ({ ...f, follow_up_done: e.target.checked }))}
                    className="rounded border-zinc-600"
                  />
                  <label htmlFor="fu-done" className="text-xs text-zinc-400">Follow-up done</label>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-zinc-500 block mb-1">Notes</label>
                  <textarea
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 resize-none"
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Any notes about this lead…"
                    rows={3}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setShowModal(false)}
                className="text-sm text-zinc-400 hover:text-zinc-200 px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving || !form.name.trim()}
                className="text-sm font-medium bg-zinc-100 text-zinc-900 px-5 py-2 rounded-lg hover:bg-white disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
