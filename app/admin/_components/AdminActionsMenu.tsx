'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * A dropdown menu rendered via a portal to document.body, positioned with
 * `fixed` coordinates computed from the trigger button. Every admin table
 * (CoachesTable, OrgsTable) previously used `absolute` positioning nested
 * inside `overflow-x-auto`/`overflow-hidden` table wrappers — which clips
 * the dropdown the moment it would extend past the wrapper's bounds (e.g.
 * near the bottom of a short table). Portaling escapes that entirely.
 */
export default function AdminActionsMenu({
  label = 'Actions ▾',
  children,
}: {
  label?: string
  children: (close: () => void) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  function updateCoords() {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    setCoords({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
  }

  function toggle() {
    if (!open) updateCoords()
    setOpen((o) => !o)
  }

  function close() {
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', updateCoords, true)
    window.addEventListener('resize', updateCoords)
    return () => {
      window.removeEventListener('scroll', updateCoords, true)
      window.removeEventListener('resize', updateCoords)
    }
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="text-xs font-medium text-zinc-400 hover:text-zinc-200 px-2.5 py-1.5 rounded-md hover:bg-zinc-800 transition-colors border border-zinc-700"
      >
        {label}
      </button>
      {open && coords && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div
            style={{ position: 'fixed', top: coords.top, right: coords.right }}
            className="z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl w-44 py-1"
          >
            {children(close)}
          </div>
        </>,
        document.body,
      )}
    </>
  )
}
