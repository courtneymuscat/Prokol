'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteFormButton({ formId }: { formId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    await fetch(`/api/forms/${formId}`, { method: 'DELETE' })
    router.refresh()
  }

  if (confirming) {
    return (
      <div className="flex gap-1.5 items-center">
        <span className="text-xs text-gray-500">Delete?</span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs font-semibold text-red-600 border border-red-200 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          {deleting ? '…' : 'Yes'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs font-medium text-gray-500 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
        >
          No
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs font-medium text-gray-400 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
    >
      Delete
    </button>
  )
}
