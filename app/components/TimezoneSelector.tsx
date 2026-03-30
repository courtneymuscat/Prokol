'use client'

import { useState, useEffect } from 'react'

type Props = {
  apiUrl: string        // endpoint to PATCH { timezone }
  getApiUrl?: string    // if different from apiUrl for GET
  fieldName?: string    // default 'timezone'
}

// Comprehensive IANA timezone list with readable labels
const TIMEZONES = [
  // ── Pacific ──────────────────────────────────────────────────────────────
  { value: 'Pacific/Midway',              label: 'Midway Island (UTC−11)' },
  { value: 'Pacific/Niue',               label: 'Niue (UTC−11)' },
  { value: 'Pacific/Honolulu',           label: 'Hawaii — Honolulu (UTC−10)' },
  { value: 'Pacific/Tahiti',             label: 'Tahiti (UTC−10)' },
  { value: 'Pacific/Marquesas',          label: 'Marquesas Islands (UTC−9:30)' },
  { value: 'America/Anchorage',          label: 'Alaska — Anchorage (UTC−9)' },
  { value: 'America/Juneau',             label: 'Alaska — Juneau (UTC−9)' },
  { value: 'Pacific/Gambier',            label: 'Gambier Islands (UTC−9)' },
  { value: 'America/Los_Angeles',        label: 'Pacific Time — Los Angeles (UTC−8/−7)' },
  { value: 'America/Vancouver',          label: 'Pacific Time — Vancouver (UTC−8/−7)' },
  { value: 'America/Tijuana',            label: 'Pacific Time — Tijuana (UTC−8/−7)' },
  { value: 'America/Phoenix',            label: 'Mountain Time — Phoenix (UTC−7, no DST)' },
  { value: 'America/Denver',             label: 'Mountain Time — Denver (UTC−7/−6)' },
  { value: 'America/Edmonton',           label: 'Mountain Time — Edmonton (UTC−7/−6)' },
  { value: 'America/Mazatlan',           label: 'Mountain Time — Mazatlan (UTC−7/−6)' },
  { value: 'America/Chicago',            label: 'Central Time — Chicago (UTC−6/−5)' },
  { value: 'America/Winnipeg',           label: 'Central Time — Winnipeg (UTC−6/−5)' },
  { value: 'America/Mexico_City',        label: 'Central Time — Mexico City (UTC−6/−5)' },
  { value: 'America/Guatemala',          label: 'Central America — Guatemala (UTC−6)' },
  { value: 'America/El_Salvador',        label: 'Central America — El Salvador (UTC−6)' },
  { value: 'America/Costa_Rica',         label: 'Central America — Costa Rica (UTC−6)' },
  { value: 'America/Managua',            label: 'Central America — Managua (UTC−6)' },
  { value: 'America/Tegucigalpa',        label: 'Central America — Tegucigalpa (UTC−6)' },
  { value: 'America/New_York',           label: 'Eastern Time — New York (UTC−5/−4)' },
  { value: 'America/Toronto',            label: 'Eastern Time — Toronto (UTC−5/−4)' },
  { value: 'America/Detroit',            label: 'Eastern Time — Detroit (UTC−5/−4)' },
  { value: 'America/Indiana/Indianapolis', label: 'Eastern Time — Indianapolis (UTC−5)' },
  { value: 'America/Bogota',             label: 'Colombia — Bogota (UTC−5)' },
  { value: 'America/Lima',               label: 'Peru — Lima (UTC−5)' },
  { value: 'America/Havana',             label: 'Cuba — Havana (UTC−5/−4)' },
  { value: 'America/Halifax',            label: 'Atlantic Time — Halifax (UTC−4/−3)' },
  { value: 'America/Puerto_Rico',        label: 'Atlantic Time — Puerto Rico (UTC−4)' },
  { value: 'America/Caracas',            label: 'Venezuela — Caracas (UTC−4)' },
  { value: 'America/La_Paz',             label: 'Bolivia — La Paz (UTC−4)' },
  { value: 'America/Manaus',             label: 'Brazil — Manaus (UTC−4)' },
  { value: 'America/Santiago',           label: 'Chile — Santiago (UTC−4/−3)' },
  { value: 'America/St_Johns',           label: 'Newfoundland — St. Johns (UTC−3:30/−2:30)' },
  { value: 'America/Sao_Paulo',          label: 'Brazil — São Paulo (UTC−3/−2)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina — Buenos Aires (UTC−3)' },
  { value: 'America/Montevideo',         label: 'Uruguay — Montevideo (UTC−3)' },
  { value: 'America/Paramaribo',         label: 'Suriname — Paramaribo (UTC−3)' },
  { value: 'America/Cayenne',            label: 'French Guiana — Cayenne (UTC−3)' },
  { value: 'Atlantic/South_Georgia',     label: 'South Georgia (UTC−2)' },
  { value: 'Atlantic/Azores',            label: 'Azores (UTC−1/0)' },
  { value: 'Atlantic/Cape_Verde',        label: 'Cape Verde (UTC−1)' },
  // ── Europe / Africa ───────────────────────────────────────────────────────
  { value: 'UTC',                        label: 'UTC (UTC+0)' },
  { value: 'Europe/London',              label: 'UK — London (UTC+0/+1)' },
  { value: 'Europe/Dublin',              label: 'Ireland — Dublin (UTC+0/+1)' },
  { value: 'Europe/Lisbon',              label: 'Portugal — Lisbon (UTC+0/+1)' },
  { value: 'Atlantic/Reykjavik',         label: 'Iceland — Reykjavik (UTC+0)' },
  { value: 'Africa/Casablanca',          label: 'Morocco — Casablanca (UTC+0/+1)' },
  { value: 'Africa/Accra',               label: 'Ghana — Accra (UTC+0)' },
  { value: 'Africa/Abidjan',             label: 'Ivory Coast — Abidjan (UTC+0)' },
  { value: 'Europe/Paris',               label: 'France — Paris (UTC+1/+2)' },
  { value: 'Europe/Berlin',              label: 'Germany — Berlin (UTC+1/+2)' },
  { value: 'Europe/Rome',                label: 'Italy — Rome (UTC+1/+2)' },
  { value: 'Europe/Madrid',              label: 'Spain — Madrid (UTC+1/+2)' },
  { value: 'Europe/Amsterdam',           label: 'Netherlands — Amsterdam (UTC+1/+2)' },
  { value: 'Europe/Brussels',            label: 'Belgium — Brussels (UTC+1/+2)' },
  { value: 'Europe/Stockholm',           label: 'Sweden — Stockholm (UTC+1/+2)' },
  { value: 'Europe/Oslo',                label: 'Norway — Oslo (UTC+1/+2)' },
  { value: 'Europe/Copenhagen',          label: 'Denmark — Copenhagen (UTC+1/+2)' },
  { value: 'Europe/Zurich',              label: 'Switzerland — Zurich (UTC+1/+2)' },
  { value: 'Europe/Vienna',              label: 'Austria — Vienna (UTC+1/+2)' },
  { value: 'Europe/Warsaw',              label: 'Poland — Warsaw (UTC+1/+2)' },
  { value: 'Europe/Prague',              label: 'Czech Republic — Prague (UTC+1/+2)' },
  { value: 'Europe/Budapest',            label: 'Hungary — Budapest (UTC+1/+2)' },
  { value: 'Africa/Lagos',               label: 'Nigeria — Lagos (UTC+1)' },
  { value: 'Africa/Tunis',               label: 'Tunisia — Tunis (UTC+1)' },
  { value: 'Africa/Algiers',             label: 'Algeria — Algiers (UTC+1)' },
  { value: 'Europe/Athens',              label: 'Greece — Athens (UTC+2/+3)' },
  { value: 'Europe/Helsinki',            label: 'Finland — Helsinki (UTC+2/+3)' },
  { value: 'Europe/Bucharest',           label: 'Romania — Bucharest (UTC+2/+3)' },
  { value: 'Europe/Kiev',                label: 'Ukraine — Kyiv (UTC+2/+3)' },
  { value: 'Europe/Riga',                label: 'Latvia — Riga (UTC+2/+3)' },
  { value: 'Europe/Tallinn',             label: 'Estonia — Tallinn (UTC+2/+3)' },
  { value: 'Europe/Vilnius',             label: 'Lithuania — Vilnius (UTC+2/+3)' },
  { value: 'Asia/Jerusalem',             label: 'Israel — Jerusalem (UTC+2/+3)' },
  { value: 'Asia/Beirut',                label: 'Lebanon — Beirut (UTC+2/+3)' },
  { value: 'Asia/Amman',                 label: 'Jordan — Amman (UTC+2/+3)' },
  { value: 'Asia/Damascus',              label: 'Syria — Damascus (UTC+2/+3)' },
  { value: 'Africa/Cairo',               label: 'Egypt — Cairo (UTC+2)' },
  { value: 'Africa/Johannesburg',        label: 'South Africa — Johannesburg (UTC+2)' },
  { value: 'Africa/Harare',              label: 'Zimbabwe — Harare (UTC+2)' },
  { value: 'Africa/Nairobi',             label: 'Kenya — Nairobi (UTC+3)' },
  { value: 'Africa/Addis_Ababa',         label: 'Ethiopia — Addis Ababa (UTC+3)' },
  { value: 'Africa/Dar_es_Salaam',       label: 'Tanzania — Dar es Salaam (UTC+3)' },
  { value: 'Asia/Baghdad',               label: 'Iraq — Baghdad (UTC+3)' },
  { value: 'Asia/Riyadh',                label: 'Saudi Arabia — Riyadh (UTC+3)' },
  { value: 'Asia/Kuwait',                label: 'Kuwait (UTC+3)' },
  { value: 'Asia/Qatar',                 label: 'Qatar — Doha (UTC+3)' },
  { value: 'Europe/Moscow',              label: 'Russia — Moscow (UTC+3)' },
  { value: 'Europe/Istanbul',            label: 'Turkey — Istanbul (UTC+3)' },
  { value: 'Asia/Tehran',                label: 'Iran — Tehran (UTC+3:30/+4:30)' },
  // ── Asia ──────────────────────────────────────────────────────────────────
  { value: 'Asia/Dubai',                 label: 'UAE — Dubai (UTC+4)' },
  { value: 'Asia/Abu_Dhabi',             label: 'UAE — Abu Dhabi (UTC+4)' },
  { value: 'Asia/Muscat',                label: 'Oman — Muscat (UTC+4)' },
  { value: 'Asia/Baku',                  label: 'Azerbaijan — Baku (UTC+4/+5)' },
  { value: 'Asia/Tbilisi',               label: 'Georgia — Tbilisi (UTC+4)' },
  { value: 'Asia/Yerevan',               label: 'Armenia — Yerevan (UTC+4)' },
  { value: 'Indian/Mauritius',           label: 'Mauritius (UTC+4)' },
  { value: 'Asia/Kabul',                 label: 'Afghanistan — Kabul (UTC+4:30)' },
  { value: 'Asia/Karachi',               label: 'Pakistan — Karachi (UTC+5)' },
  { value: 'Asia/Tashkent',              label: 'Uzbekistan — Tashkent (UTC+5)' },
  { value: 'Asia/Yekaterinburg',         label: 'Russia — Yekaterinburg (UTC+5)' },
  { value: 'Indian/Maldives',            label: 'Maldives (UTC+5)' },
  { value: 'Asia/Kolkata',               label: 'India — Mumbai / New Delhi (UTC+5:30)' },
  { value: 'Asia/Colombo',               label: 'Sri Lanka — Colombo (UTC+5:30)' },
  { value: 'Asia/Kathmandu',             label: 'Nepal — Kathmandu (UTC+5:45)' },
  { value: 'Asia/Almaty',                label: 'Kazakhstan — Almaty (UTC+6)' },
  { value: 'Asia/Dhaka',                 label: 'Bangladesh — Dhaka (UTC+6)' },
  { value: 'Asia/Rangoon',               label: 'Myanmar — Yangon (UTC+6:30)' },
  { value: 'Asia/Bangkok',               label: 'Thailand — Bangkok (UTC+7)' },
  { value: 'Asia/Ho_Chi_Minh',           label: 'Vietnam — Ho Chi Minh City (UTC+7)' },
  { value: 'Asia/Phnom_Penh',            label: 'Cambodia — Phnom Penh (UTC+7)' },
  { value: 'Asia/Jakarta',               label: 'Indonesia — Jakarta (UTC+7)' },
  { value: 'Asia/Novosibirsk',           label: 'Russia — Novosibirsk (UTC+7)' },
  { value: 'Asia/Singapore',             label: 'Singapore (UTC+8)' },
  { value: 'Asia/Kuala_Lumpur',          label: 'Malaysia — Kuala Lumpur (UTC+8)' },
  { value: 'Asia/Hong_Kong',             label: 'Hong Kong (UTC+8)' },
  { value: 'Asia/Taipei',                label: 'Taiwan — Taipei (UTC+8)' },
  { value: 'Asia/Manila',                label: 'Philippines — Manila (UTC+8)' },
  { value: 'Asia/Shanghai',              label: 'China — Shanghai / Beijing (UTC+8)' },
  { value: 'Asia/Urumqi',                label: 'China — Urumqi (UTC+6)' },
  { value: 'Asia/Ulaanbaatar',           label: 'Mongolia — Ulaanbaatar (UTC+8)' },
  { value: 'Australia/Perth',            label: 'Australia — Perth (UTC+8)' },
  { value: 'Asia/Irkutsk',               label: 'Russia — Irkutsk (UTC+8)' },
  { value: 'Asia/Tokyo',                 label: 'Japan — Tokyo (UTC+9)' },
  { value: 'Asia/Seoul',                 label: 'South Korea — Seoul (UTC+9)' },
  { value: 'Asia/Pyongyang',             label: 'North Korea — Pyongyang (UTC+9)' },
  { value: 'Asia/Yakutsk',               label: 'Russia — Yakutsk (UTC+9)' },
  { value: 'Australia/Darwin',           label: 'Australia — Darwin (UTC+9:30)' },
  { value: 'Australia/Adelaide',         label: 'Australia — Adelaide (UTC+9:30/+10:30)' },
  { value: 'Australia/Brisbane',         label: 'Australia — Brisbane (UTC+10)' },
  { value: 'Australia/Sydney',           label: 'Australia — Sydney (UTC+10/+11)' },
  { value: 'Australia/Melbourne',        label: 'Australia — Melbourne (UTC+10/+11)' },
  { value: 'Australia/Hobart',           label: 'Australia — Hobart (UTC+10/+11)' },
  { value: 'Australia/Lord_Howe',        label: 'Australia — Lord Howe Island (UTC+10:30/+11)' },
  { value: 'Asia/Vladivostok',           label: 'Russia — Vladivostok (UTC+10)' },
  { value: 'Pacific/Port_Moresby',       label: 'Papua New Guinea (UTC+10)' },
  { value: 'Pacific/Guadalcanal',        label: 'Solomon Islands (UTC+11)' },
  { value: 'Pacific/Noumea',             label: 'New Caledonia (UTC+11)' },
  { value: 'Asia/Magadan',               label: 'Russia — Magadan (UTC+11)' },
  { value: 'Pacific/Auckland',           label: 'New Zealand — Auckland (UTC+12/+13)' },
  { value: 'Pacific/Chatham',            label: 'New Zealand — Chatham Islands (UTC+12:45/+13:45)' },
  { value: 'Pacific/Fiji',               label: 'Fiji (UTC+12)' },
  { value: 'Pacific/Tongatapu',          label: 'Tonga (UTC+13)' },
  { value: 'Pacific/Apia',               label: 'Samoa — Apia (UTC+13)' },
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
