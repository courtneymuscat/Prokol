'use client'

import { useState } from 'react'

export default function CycleReminderToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function toggle() {
    const next = !enabled
    setEnabled(next)
    setSaving(true)
    setSaved(false)
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle_reminders: next }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setEnabled(!next)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-base">🔔</span>
            <p className="text-sm font-semibold text-gray-900">Daily reminders</p>
            {saved && <span className="text-[11px] text-green-500 font-medium">Saved</span>}
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            We&apos;ll send you a push notification at 8pm if you haven&apos;t logged today — with a message based on where you are in your cycle.
          </p>
          {!enabled && (
            <p className="text-[11px] text-amber-600 mt-1.5">
              Reminders are off. Make sure push notifications are enabled for Prokol in your phone settings.
            </p>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={saving}
          onClick={toggle}
          className={[
            'relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 mt-0.5',
            enabled ? 'bg-teal-500' : 'bg-gray-200',
          ].join(' ')}
        >
          <span className={[
            'inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200',
            enabled ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')} />
        </button>
      </div>

      {enabled && (
        <div className="mt-3 pt-3 border-t border-gray-50 space-y-1.5">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Example reminders</p>
          {[
            '🩸 Period day — how are you feeling? Log your flow and energy.',
            '🌙 Luteal phase check-in — log mood, energy and any PMS symptoms.',
            '✨ You may be approaching ovulation — how\'s your energy?',
            '📝 How\'s your mood and energy today? Your cycle data is building a picture.',
          ].map((msg) => (
            <p key={msg} className="text-[11px] text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{msg}</p>
          ))}
        </div>
      )}
    </div>
  )
}
