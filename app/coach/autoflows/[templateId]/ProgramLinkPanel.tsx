'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// Lets Court sell this specific autoflow directly to individuals via a
// signup link ("a course") — no gym involved. Deliberately invisible
// (renders nothing) to every other coach: the real authorization boundary
// is the 403 from /api/coach/program-links, not this component hiding
// itself, so there's nothing to bypass client-side even if someone tried.
// Creation/management itself lives at /admin/courses, which can bundle
// several autoflows into one course — this is just a shortcut into it,
// pre-filtered to this autoflow.
export default function ProgramLinkPanel({ autoflowId }: { autoflowId: string }) {
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    fetch(`/api/coach/program-links?autoflow_id=${autoflowId}`)
      .then((res) => setAllowed(res.status !== 403))
      .catch(() => setAllowed(false))
  }, [autoflowId])

  if (allowed !== true) return null

  return (
    <Link
      href={`/admin/courses?autoflow=${autoflowId}`}
      className="text-xs text-gray-400 hover:text-gray-700 transition-colors px-2 flex items-center gap-1"
      title="Sell this program directly to individuals"
    >
      💳 Sell
    </Link>
  )
}
