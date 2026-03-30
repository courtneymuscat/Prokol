'use client'

import { useState, useEffect } from 'react'

type Props = {
  apiUrl: string        // endpoint to PATCH { timezone }
  getApiUrl?: string    // if different from apiUrl for GET
  fieldName?: string    // default 'timezone'
}

// Curated list of common IANA timezones with readable labels
const TIMEZONES = [
  { value: 'Pacific/Honolulu',     label: 'Hawaii (UTC−10)' },
  { value: 'America/Anchorage',    label: 'Alaska (UTC−9)' },
  { value: 'America/Los_Angeles',  label: 'Pacific Time — US & Canada (UTC−8/−7)' },
  { value: 'America/Denver',       label: 'Mountain Time — US & Canada (UTC−7/−6)' },
  { value: 'America/Chicago',      label: 'Central Time — US & Canada (UTC−6/−5)' },
  { value: 'America/New_York',     label: 'Eastern Time — US & Canada (UTC−5/−4)' },
  { value: 'America/Halifax',      label: 'Atlantic Time — Canada (UTC−4/−3)' },
  { value: 'America/St_Johns',     label: 'Newfoundland (UTC−3:30/−2:30)' },
  { value: 'America/Sao_Paulo',    label: 'Brasilia (UTC−3/−2)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (UTC−3)' },
  { value: 'Atlantic/Azores',      label: 'Azores (UTC−1/0)' },
  { value: 'Europe/London',        label: 'London / Dublin / Lisbon (UTC+0/+1)' },
  { value: 'Europe/Paris',         label: 'Paris / Berlin / Rome / Madrid (UTC+1/+2)' },
  { value: 'Europe/Helsinki',      label: 'Helsinki / Kiev / Riga (UTC+2/+3)' },
  { value: 'Europe/Moscow',        label: 'Moscow / St Petersburg (UTC+3)' },
  { value: 'Asia/Dubai',           label: 'Dubai / Abu Dhabi (UTC+4)' },
  { value: 'Asia/Karachi',         label: 'Islamabad / Karachi (UTC+5)' },
  { value: 'Asia/Kolkata',         label: 'Mumbai / New Delhi (UTC+5:30)' },
  { value: 'Asia/Dhaka',           label: 'Dhaka (UTC+6)' },
  { value: 'Asia/Bangkok',         label: 'Bangkok / Jakarta / Hanoi (UTC+7)' },
  { value: 'Asia/Singapore',       label: 'Singapore / Kuala Lumpur / Hong Kong (UTC+8)' },
  { value: 'Asia/Tokyo',           label: 'Tokyo / Seoul / Osaka (UTC+9)' },
  { value: 'Australia/Darwin',     label: 'Darwin (UTC+9:30)' },
  { value: 'Australia/Brisbane',   label: 'Brisbane (UTC+10)' },
  { value: 'Australia/Sydney',     label: 'Sydney / Melbourne / Canberra (UTC+10/+11)' },
  { value: 'Australia/Adelaide',   label: 'Adelaide (UTC+9:30/+10:30)' },
  { value: 'Australia/Perth',      label: 'Perth (UTC+8)' },
  { value: 'Pacific/Auckland',     label: 'Auckland / Wellington (UTC+12/+13)' },
  { value: 'Pacific/Fiji',         label: 'Fiji (UTC+12)' },
]

export default function TimezoneSelector({ apiUrl, getApiUrl, fieldName = 'timezone' }: Props) {
  const [timezone, setTimezone] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [localTime, setLocalTime] = useState('')

  useEffect(() => {
    const url = getApiUrl ?? apiUrl
    fetch(url)
      .then((r) => r.ok ? r.json() : {})
      .then((d: Record<string, unknown>) => {
        const val = d[fieldName]
        if (typeof val === 'string') setTimezone(val)
      })
      .catch(() => {})
  }, [apiUrl, getApiUrl, fieldName])

  useEffect(() => {
    if (!timezone) return
    function update() {
      try {
        setLocalTime(new Intl.DateTimeFormat('en-AU', {
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit',
          weekday: 'short',
        }).format(new Date()))
      } catch { setLocalTime('') }
    }
    update()
    const id = setInterval(update, 30_000)
    return () => clearInterval(id)
  }, [timezone])

  function detect() {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
      setTimezone(detected)
    } catch { /* unsupported */ }
  }

  async function save(tz: string) {
    setSaving(true)
    setError(null)
    const res = await fetch(apiUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [fieldName]: tz }),
    })
    setSaving(false)
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(json.error ?? 'Failed to save')
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setTimezone(e.target.value)
    if (e.target.value) save(e.target.value)
  }

  // If the saved timezone isn't in the curated list, add it as a custom option
  const inList = TIMEZONES.some((t) => t.value === timezone)
  const options = inList || !timezone ? TIMEZONES : [{ value: timezone, label: timezone }, ...TIMEZONES]

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={timezone}
          onChange={handleChange}
          className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Select a timezone…</option>
          {options.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={detect}
          className="flex-shrink-0 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          title="Detect from browser"
        >
          Detect
        </button>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {localTime ? `Current time: ${localTime}` : 'Select a timezone to see local time'}
        </p>
        {saving && <p className="text-xs text-gray-400">Saving…</p>}
        {saved && !saving && <p className="text-xs text-green-600">Saved</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  )
}
