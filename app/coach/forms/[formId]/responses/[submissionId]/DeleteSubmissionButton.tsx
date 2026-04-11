'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteSubmissionButton({ submissionId, formId }: { submissionId: string; formId: string }) {
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    if (!confirm('Delete this response? This cannot be undone.')) return
    setDeleting(true)
    const res = await fetch(`/api/coach/forms/${formId}/responses/${submissionId}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) {
      router.push(`/coach/forms/${formId}/responses`)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="flex-shrink-0 text-xs font-medium text-red-400 hover:text-red-600 disabled:opacity-40 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
    >
      {deleting ? 'Deleting…' : 'Delete'}
    </button>
  )
}
