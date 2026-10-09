'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HexColourInput, loadImage, compositeIconOntoSquare } from '@/app/components/brandIconUtils'

export default function NewGymForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [appName, setAppName] = useState('')
  const [supportEmail, setSupportEmail] = useState('')
  const [brandColour, setBrandColour] = useState('#1D9E75')
  const [brandColourSecondary, setBrandColourSecondary] = useState('#111827')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [faviconFile, setFaviconFile] = useState<File | null>(null)
  const [appIconFile, setAppIconFile] = useState<File | null>(null)
  const [appIconBackground, setAppIconBackground] = useState('#FFFFFF')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const formData = new FormData()
    formData.append('name', name)
    if (appName) formData.append('appName', appName)
    if (supportEmail) formData.append('supportEmail', supportEmail)
    formData.append('brandColour', brandColour)
    formData.append('brandColourSecondary', brandColourSecondary)
    if (logoFile) formData.append('logo', logoFile)
    if (faviconFile) formData.append('favicon', faviconFile)
    if (appIconFile) {
      // Flattened onto the chosen background before upload — same reasoning
      // as the white-label application form's app-icon handling (transparent
      // or non-square source images otherwise render unpredictably as a
      // home-screen icon on iOS).
      const img = await loadImage(appIconFile)
      const blob = await compositeIconOntoSquare(img, appIconBackground)
      formData.append('appIcon', blob ?? appIconFile, 'app-icon.png')
    }

    const res = await fetch('/api/admin/gyms', { method: 'POST', body: formData })
    const data = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      setError(data.error ?? 'Failed to create gym')
      return
    }
    router.push(`/admin/gyms/${data.id}`)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5 max-w-xl">
      {error && (
        <div className="bg-red-950 border border-red-900 rounded-xl px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1">Gym name <span className="text-red-400">*</span></label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          placeholder="e.g. Peak Performance Gym"
          className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1">App name <span className="text-zinc-500">(optional, defaults to gym name)</span></label>
        <input
          type="text"
          value={appName}
          onChange={e => setAppName(e.target.value)}
          placeholder="What members see as the app name"
          className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1">Support email <span className="text-zinc-500">(optional)</span></label>
        <input
          type="email"
          value={supportEmail}
          onChange={e => setSupportEmail(e.target.value)}
          placeholder="support@thegym.com"
          className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">Primary colour</label>
          <HexColourInput value={brandColour} onChange={setBrandColour} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">Secondary colour</label>
          <HexColourInput value={brandColourSecondary} onChange={setBrandColourSecondary} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1">Logo <span className="text-zinc-500">(optional)</span></label>
        <input
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          onChange={e => setLogoFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1">App icon <span className="text-zinc-500">(optional — square, 512×512 recommended)</span></label>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={e => setAppIconFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700"
        />
        {appIconFile && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-zinc-500">Background colour (for transparent/non-square icons):</span>
            <HexColourInput value={appIconBackground} onChange={setAppIconBackground} swatchSize="w-6 h-6" />
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1">Favicon <span className="text-zinc-500">(optional)</span></label>
        <input
          type="file"
          accept="image/png,image/x-icon,image/svg+xml"
          onChange={e => setFaviconFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 rounded-xl text-sm font-semibold text-zinc-900 hover:opacity-90 disabled:opacity-50 transition-colors"
        style={{ backgroundColor: '#1D9E75' }}
      >
        {submitting ? 'Creating…' : 'Create gym'}
      </button>
    </form>
  )
}
