'use client'

import { useState, useEffect } from 'react'

type Sex = 'male' | 'female' | ''

type InitialData = {
  full_name: string | null
  date_of_birth: string | null
  phone: string | null
  sex: string | null
  cycle_reminders: boolean
}

// initialData, when provided by a server component that already has the
// profile row, seeds state directly and skips the GET entirely — the
// Settings page passes it so this doesn't duplicate the page's own fetch.
// Falls back to the original self-fetch when omitted.
export default function ProfileDetails({ initialData }: { initialData?: InitialData }) {
  const [fullName, setFullName] = useState(initialData?.full_name ?? '')
  const [dob, setDob] = useState(initialData?.date_of_birth ?? '')
  const [phone, setPhone] = useState(initialData?.phone ?? '')
  const [sex, setSex] = useState<Sex>((initialData?.sex as Sex) ?? '')
  const [cycleReminders, setCycleReminders] = useState(initialData?.cycle_reminders ?? true)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [loaded, setLoaded] = useState(!!initialData)

  useEffect(() => {
    if (initialData) return
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => {
        if (d.full_name) setFullName(d.full_name)
        if (d.date_of_birth) setDob(d.date_of_birth)
        if (d.phone) setPhone(d.phone)
        if (d.sex) setSex(d.sex as Sex)
        setCycleReminders(d.cycle_reminders !== false)
        setLoaded(true)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialData is a one-time seed, intentionally not re-triggering the fetch if it changes identity
  }, [])

  async function handleSave() {
    setStatus('saving')
    const body: Record<string, unknown> = {
      full_name: fullName,
      date_of_birth: dob || null,
      phone: phone || null,
      sex: sex || null,
    }
    if (sex === 'female') body.cycle_reminders = cycleReminders
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setStatus(res.ok ? 'saved' : 'error')
    if (res.ok) setTimeout(() => setStatus('idle'), 2000)
  }

  if (!loaded) return null

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Full name</label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="e.g. Jane Smith"
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Date of birth</label>
        <input
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Phone number</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="e.g. +61 400 000 000"
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400 mt-1">Include country code, e.g. +61 for Australia</p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          Biological sex <span className="font-normal text-gray-400 normal-case">— used for BMR calculation and cycle tracking</span>
        </label>
        <div className="flex gap-2">
          {(['female', 'male'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSex(s)}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all capitalize ${
                sex === s
                  ? 'bg-gray-900 border-gray-900 text-white'
                  : 'border-gray-200 text-gray-700 hover:border-gray-400'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {sex === 'female' && (
        <div className="flex items-start justify-between gap-4 py-1">
          <div>
            <p className="text-sm font-medium text-gray-800">Cycle tracking reminders</p>
            <p className="text-xs text-gray-400 mt-0.5">Daily 8pm reminder to log symptoms if you haven&apos;t already</p>
          </div>
          <button
            type="button"
            onClick={() => setCycleReminders((v) => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
              cycleReminders ? 'bg-blue-600' : 'bg-gray-200'
            }`}
            role="switch"
            aria-checked={cycleReminders}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
                cycleReminders ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={status === 'saving'}
        className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved ✓' : status === 'error' ? 'Error — try again' : 'Save'}
      </button>
    </div>
  )
}
