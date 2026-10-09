'use client'

import { useState, useEffect } from 'react'

// Shared by every branding form that lets a coach/admin pick a logo, icon,
// or colour (the white-label application form and the admin gym-creation
// form) — extracted here so both stay in sync rather than drifting as two
// copies of the same canvas-compositing/hex-input logic.

// Home-screen icons are flattened onto an opaque square — iOS in particular
// fills transparent regions with black rather than showing the page behind
// them, which a raw <img> preview never reveals (browsers happily render
// transparent PNGs over whatever's behind them). Compositing onto a canvas
// of a colour the user picks — client-side, before upload — means the
// preview they see is exactly what ships, whether the source image is
// non-square, has a transparent background, or both; the server never has
// to do any image processing.
export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { resolve(img); URL.revokeObjectURL(url) }
    img.onerror = reject
    img.src = url
  })
}

// For an already-saved icon, loaded from Supabase Storage's public URL
// rather than a local file — needs crossOrigin so the canvas isn't tainted,
// which fails if the bucket's CORS config ever changes; callers must treat
// a thrown/rejected promise as "live preview unavailable," not a hard error.
export function loadRemoteImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

// Accepts "#F5C842", "F5C842", or the 3-digit shorthand, so pasting a hex
// value copied from anywhere (brand guidelines, another tool) just works.
export function normalizeHex(input: string): string | null {
  const v = input.trim().replace(/^#/, '')
  if (/^[0-9A-Fa-f]{6}$/.test(v)) return `#${v}`.toUpperCase()
  if (/^[0-9A-Fa-f]{3}$/.test(v)) {
    const [r, g, b] = v.split('')
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
  }
  return null
}

// Swatch + pasteable hex text field, shared by every colour picker — keeps
// the text field's in-progress value separate from the committed colour so
// a half-typed/pasted hex (e.g. "#F5C8") doesn't get clobbered back to the
// last-valid colour on every keystroke.
export function HexColourInput({ value, onChange, swatchSize = 'w-10 h-10' }: {
  value: string
  onChange: (hex: string) => void
  swatchSize?: string
}) {
  const [text, setText] = useState(value)
  useEffect(() => { setText(value) }, [value])

  function handleTextChange(raw: string) {
    setText(raw)
    const normalized = normalizeHex(raw)
    if (normalized) onChange(normalized)
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`${swatchSize} rounded-lg border border-gray-200 cursor-pointer p-0.5 shrink-0`}
      />
      <input
        type="text"
        value={text}
        onChange={e => handleTextChange(e.target.value)}
        placeholder="#FFFFFF"
        spellCheck={false}
        className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-xs font-mono text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}

export function compositeIconOntoSquare(img: HTMLImageElement, bgColor: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      const size = Math.max(img.naturalWidth, img.naturalHeight)
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(null); return }
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, size, size)
      ctx.drawImage(img, (size - img.naturalWidth) / 2, (size - img.naturalHeight) / 2)
      canvas.toBlob((blob) => resolve(blob), 'image/png')
    } catch {
      resolve(null)
    }
  })
}
