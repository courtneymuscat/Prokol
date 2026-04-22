'use client'

import { useState } from 'react'

export default function CopyInviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={copy}
      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors"
    >
      {copied ? 'Copied!' : 'Copy link'}
    </button>
  )
}
