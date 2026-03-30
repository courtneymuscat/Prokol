'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

type ScannedItem = {
  food_name: string
  grams: number
  calories: number
  protein: number
  carbs: number
  fat: number
}

type Props = {
  mealKey: 'breakfast' | 'lunch' | 'dinner' | 'snacks'
  date: string
  onLogged: () => void
  onClose: () => void
}

async function resizeToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 1024
      let w = img.width
      let h = img.height
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX }
        else { w = Math.round(w * MAX / h); h = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' })
    }
    img.src = url
  })
}

export default function MealScanModal({ mealKey, date, onLogged, onClose }: Props) {
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [items, setItems] = useState<ScannedItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [logging, setLogging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setItems(null)
    setError(null)
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function handleScan() {
    if (!imageFile) return
    setScanning(true)
    setError(null)
    try {
      const { base64, mimeType } = await resizeToBase64(imageFile)
      const res = await fetch('/api/scan-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mimeType }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (!data.items?.length) throw new Error('No foods detected — try a clearer photo.')
      setItems(data.items)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to scan image')
    } finally {
      setScanning(false)
    }
  }

  function updateItem(index: number, field: keyof ScannedItem, value: string) {
    setItems((prev) =>
      prev
        ? prev.map((item, i) =>
            i === index
              ? { ...item, [field]: field === 'food_name' ? value : Number(value) || 0 }
              : item
          )
        : prev
    )
  }

  function removeItem(index: number) {
    setItems((prev) => prev ? prev.filter((_, i) => i !== index) : prev)
  }

  async function handleLog() {
    if (!items?.length || !imageFile) return
    setLogging(true)
    setError(null)

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Not authenticated'); setLogging(false); return }

    // Upload image to Supabase Storage
    let scanImageUrl: string | null = null
    try {
      const path = `${session.user.id}/${date}-${Date.now()}.jpg`
      const { error: uploadErr } = await supabase.storage
        .from('meal-scans')
        .upload(path, imageFile, { contentType: imageFile.type, upsert: false })
      if (!uploadErr) {
        const { data: { publicUrl } } = supabase.storage.from('meal-scans').getPublicUrl(path)
        scanImageUrl = publicUrl
      }
    } catch { /* non-critical — still log food */ }

    const rows = items.map((item) => ({
      user_id: session.user.id,
      food_name: item.food_name,
      calories: Math.round(item.calories),
      protein: Math.round(item.protein * 10) / 10,
      carbs: Math.round(item.carbs * 10) / 10,
      fat: Math.round(item.fat * 10) / 10,
      meal_type: mealKey,
      log_date: date,
      scan_image_url: scanImageUrl,
    }))

    const { error: insertErr } = await supabase.from('food_logs').insert(rows)
    if (insertErr) {
      setError(insertErr.message)
      setLogging(false)
      return
    }

    onLogged()
    onClose()
  }

  const totalCals = items?.reduce((s, i) => s + i.calories, 0) ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Scan Meal</h2>
            <p className="text-xs text-gray-400 mt-0.5 capitalize">{mealKey} · {date}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Image picker */}
          {!imagePreview ? (
            <>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full h-44 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm font-medium">Take photo or choose image</span>
                <span className="text-xs">Tap to open camera</span>
              </button>

              {/* How it works */}
              <div className="rounded-xl bg-gray-50 px-4 py-3 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">How it works</p>
                <ul className="space-y-1.5">
                  {[
                    { icon: '📸', text: 'Take or upload a photo of your entire meal — plate, bowl, or spread' },
                    { icon: '🤖', text: 'AI identifies each food and estimates the portion sizes' },
                    { icon: '✏️', text: 'Review and adjust any values before confirming' },
                    { icon: '✅', text: 'All detected foods are added to your log in one tap' },
                  ].map(({ icon, text }) => (
                    <li key={text} className="flex items-start gap-2 text-xs text-gray-500">
                      <span className="flex-shrink-0">{icon}</span>
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <div className="relative">
              <img src={imagePreview} alt="Meal" className="w-full h-52 object-cover rounded-xl" />
              <button
                type="button"
                onClick={() => { setImagePreview(null); setImageFile(null); setItems(null); setError(null) }}
                className="absolute top-2 right-2 w-7 h-7 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFile}
          />

          {/* Scan button */}
          {imagePreview && !items && (
            <button
              type="button"
              onClick={handleScan}
              disabled={scanning}
              className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {scanning ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analysing…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Analyse with AI
                </>
              )}
            </button>
          )}

          {scanning && (
            <p className="text-xs text-center text-gray-400">Identifying foods and estimating portions…</p>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3.5 py-2.5">{error}</p>
          )}

          {/* Detected items */}
          {items && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Detected foods</p>
                <p className="text-xs text-gray-400">{Math.round(totalCals)} kcal total</p>
              </div>
              {items.map((item, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.food_name}
                      onChange={(e) => updateItem(i, 'food_name', e.target.value)}
                      className="flex-1 text-sm font-medium bg-transparent border-b border-transparent hover:border-gray-300 focus:border-gray-400 focus:outline-none text-gray-900"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 text-center">
                    {([
                      { label: 'kcal', field: 'calories' as const },
                      { label: 'P', field: 'protein' as const },
                      { label: 'C', field: 'carbs' as const },
                      { label: 'F', field: 'fat' as const },
                      { label: 'g', field: 'grams' as const },
                    ]).map(({ label, field }) => (
                      <div key={field}>
                        <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={item[field]}
                          onChange={(e) => updateItem(i, field, e.target.value)}
                          className="w-full text-xs text-center bg-white border border-gray-200 rounded-lg py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-gray-400 text-center pt-1">
                AI estimates — tap any value to edit before logging
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {items && items.length > 0 && (
          <div className="px-5 pb-5 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={handleLog}
              disabled={logging}
              className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {logging ? 'Logging…' : `Log ${items.length} item${items.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
