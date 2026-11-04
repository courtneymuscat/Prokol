'use client'

import { useState, type CSSProperties, type ReactNode } from 'react'

const INK = '#211A17'
const INK_SOFT = 'rgba(33,26,23,0.62)'
const BERRY = '#1D9E75'

const SERVICES = [
  '1:1 Nutrition Coaching',
  'Accessible Education Program',
  'Gym & Studio Partnerships',
  'Seminars, Workshops & Webinars',
  'Food Business Consulting',
  'Not sure yet',
]

export function InquiryButton({
  children,
  className,
  style,
  defaultService,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
  defaultService?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} style={style}>
        {children}
      </button>
      {open && <InquiryModal defaultService={defaultService} onClose={() => setOpen(false)} />}
    </>
  )
}

function InquiryModal({ defaultService, onClose }: { defaultService?: string; onClose: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [service, setService] = useState(defaultService && SERVICES.includes(defaultService) ? defaultService : '')
  const [message, setMessage] = useState('')
  const [questions, setQuestions] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setError('')
    try {
      const res = await fetch('/api/work-with-me-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, service, message, questions }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Something went wrong — please try again.')
      }
      setStatus('sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong — please try again.')
      setStatus('error')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(33,26,23,0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-7 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {status === 'sent' ? (
          <div className="text-center py-6">
            <p className="text-lg font-bold mb-2" style={{ color: INK }}>Got it — thank you!</p>
            <p className="text-sm leading-relaxed mb-6" style={{ color: INK_SOFT }}>
              I&apos;ll read this myself and get back to you directly.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-full text-sm font-bold text-white hover:opacity-90 transition-opacity"
              style={{ background: BERRY }}
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="flex items-start justify-between mb-5">
              <p className="text-lg font-bold" style={{ color: INK }}>Let&apos;s talk</p>
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-black/5 flex-shrink-0"
                style={{ color: INK_SOFT }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: INK_SOFT }}>Name</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm"
                  style={{ border: '1px solid rgba(33,26,23,0.15)', color: INK }}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: INK_SOFT }}>Email</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm"
                  style={{ border: '1px solid rgba(33,26,23,0.15)', color: INK }}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: INK_SOFT }}>Which service are you after?</label>
                <select
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-white"
                  style={{ border: '1px solid rgba(33,26,23,0.15)', color: INK }}
                >
                  <option value="">Select one</option>
                  {SERVICES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: INK_SOFT }}>Why are you reaching out?</label>
                <textarea
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm resize-none"
                  style={{ border: '1px solid rgba(33,26,23,0.15)', color: INK }}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: INK_SOFT }}>Any specific questions? (optional)</label>
                <textarea
                  value={questions}
                  onChange={(e) => setQuestions(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm resize-none"
                  style={{ border: '1px solid rgba(33,26,23,0.15)', color: INK }}
                />
              </div>
            </div>

            {status === 'error' && (
              <p className="text-sm mt-4" style={{ color: '#B3261E' }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full mt-6 px-6 py-3 rounded-full text-sm font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-60"
              style={{ background: BERRY }}
            >
              {status === 'sending' ? 'Sending…' : 'Send'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
