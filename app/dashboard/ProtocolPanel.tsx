'use client'

import { useState, useEffect } from 'react'

type Section = {
  id: string
  title: string
  content: string
}

export default function ProtocolPanel() {
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/client/protocol')
      .then(r => r.json())
      .then(d => setSections(Array.isArray(d.sections) ? d.sections : []))
      .finally(() => setLoading(false))
  }, [])

  if (loading || sections.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-4">Protocol</h2>
      <div className="space-y-3">
        {sections.map(s => (
          <div key={s.id} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{s.title}</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{s.content}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
