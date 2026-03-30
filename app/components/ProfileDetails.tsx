'use client'

import { useState, useEffect } from 'react'

type Sex = 'male' | 'female' | ''

export default function ProfileDetails() {
  const [fullName, setFullName] = useState('')
  const [dob, setDob] = useState('')
  const [phone, setPhone] = useState('')
  const [sex, setSex] = useState<Sex>('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => {
        if (d.full_name) setFullName(d.full_name)
        if (d.date_of_birth) setDob(d.date_of_birth)
        if (d.phone) setPhone(d.phone)
        if (d.sex) setSex(d.sex as Sex)
        setLoaded(true)
      })
  }, [])

  async function handleSave() {
    setStatus('saving')
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: fullName,
        date_of_birth: dob || null,
        phone: phone || null,
        sex: sex || null,
      }),
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
