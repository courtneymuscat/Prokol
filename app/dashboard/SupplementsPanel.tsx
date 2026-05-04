'use client'

import { useState, useEffect } from 'react'

type Supplement = {
  id: string
  name: string
  dosage: string | null
  benefits: string | null
  brand_url: string | null
  notes: string | null
}

export default function SupplementsPanel() {
  const [supplements, setSupplements] = useState<Supplement[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/client/supplements')
      .then(r => r.json())
      .then(d => setSupplements(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [])

  if (loading || supplements.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-4">Supplements</h2>
      <div className="space-y-2">
        {supplements.map(s => (
          <div key={s.id} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                {s.dosage && (
                  <p className="text-xs text-gray-500 mt-0.5">{s.dosage}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {s.brand_url && (
                  <a
                    href={s.brand_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Shop →
                  </a>
                )}
                {(s.benefits || s.notes) && (
                  <button
                    onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {expanded === s.id ? 'Less' : 'More'}
                  </button>
                )}
              </div>
            </div>
            {expanded === s.id && (
              <div className="mt-2 space-y-1.5 pt-2 border-t border-gray-200">
                {s.benefits && (
                  <p className="text-xs text-gray-600 whitespace-pre-wrap">{s.benefits}</p>
                )}
                {s.notes && (
                  <p className="text-xs text-indigo-700 bg-indigo-50 rounded-lg px-2.5 py-1.5 whitespace-pre-wrap">{s.notes}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
