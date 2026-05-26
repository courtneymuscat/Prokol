'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import DeleteTemplateDialog from '@/app/components/DeleteTemplateDialog'

export default function DeleteFormButton({ formId, formName }: { formId: string; formName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-gray-400 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
        title="Archive or delete this form"
      >
        Delete
      </button>
      {open && (
        <DeleteTemplateDialog
          table="forms"
          templateId={formId}
          templateName={formName}
          hardDeleteUrl={`/api/forms/${formId}`}
          onClose={() => setOpen(false)}
          onRemoved={() => { setOpen(false); router.refresh() }}
        />
      )}
    </>
  )
}
