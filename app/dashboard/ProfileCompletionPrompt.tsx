'use client'

import { useState } from 'react'

type Props = {
  initialName: string
  initialPhone: string
  initialDob?: string
}

export default function ProfileCompletionPrompt({ initialName, initialPhone, initialDob = '' }: Props) {
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState(initialPhone)
  const [dob, setDob] = useState(initialDob)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  async function handleSave() {
    if (!name.trim()) return
    setStatus('saving')
    const body: Record<string, string | null> = {
      full_name: name.trim(),
      phone: phone.trim() || null,
    }
    if (dob) body.date_of_birth = dob
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      setStatus('saved')
      setTimeout(() => setDismissed(true), 1200)
    } else {
      setStatus('idle')
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-amber-200 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Complete your profile</p>
          <p className="text-xs text-gray-500 mt-0.5">Your coach needs your details to get started.</p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0 mt-0.5"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Full name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Jane Smith"
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
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Date of birth</label>
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-[10px] text-gray-400 mt-1">Your birthday will be added to your coach&apos;s calendar so they can celebrate with you.</p>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={!name.trim() || status === 'saving' || status === 'saved'}
        className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-900 disabled:opacity-50 transition-colors"
        style={{ backgroundColor: '#1D9E75' }}
      >
        {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved ✓' : 'Save profile details'}
      </button>
    </div>
  )
}
