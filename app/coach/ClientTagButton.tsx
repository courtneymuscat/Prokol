'use client'

import { useState } from 'react'
import ClientTagEditor from './ClientTagEditor'

export default function ClientTagButton({ clientId, className }: { clientId: string; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v) }}
        className={className ?? 'text-gray-300 hover:text-gray-500 flex-shrink-0 p-0.5'}
        title="Manage tags"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 6h.008v.008H6V6z" />
        </svg>
      </button>
      {open && <ClientTagEditor clientId={clientId} onClose={() => setOpen(false)} />}
    </div>
  )
}
