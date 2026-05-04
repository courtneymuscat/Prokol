'use client'

import { useState } from 'react'
import PayNowButton from './PayNowButton'

const TEMPLATE_TOS_URL = '/prokol-tos-template.html'

export default function TosAcceptanceGate({
  paymentLink,
  afterPayUrl,
  tosUrl,
  coachName,
  brandColour,
}: {
  paymentLink: string | null
  afterPayUrl: string
  tosUrl: string | null
  coachName: string
  brandColour: string | null
}) {
  const [accepted, setAccepted] = useState(false)

  const effectiveTosUrl = tosUrl ?? TEMPLATE_TOS_URL
  const isTemplate = !tosUrl

  return (
    <div className="space-y-3">
      {/* ToS section */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Terms of Service</p>
        {isTemplate && (
          <div className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
            A coach-specific terms of service has not been uploaded. A standard Prokol Health template applies.
          </div>
        )}
        <a
          href={effectiveTosUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {isTemplate ? 'Prokol Template Terms of Service' : 'Read Terms of Service'} ↗
        </a>
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
          />
          <span className="text-sm text-gray-700 leading-snug group-hover:text-gray-900 transition-colors">
            I have read and agree to the{' '}
            <a href={effectiveTosUrl} target="_blank" rel="noopener noreferrer" className="underline font-medium">
              Terms of Service
            </a>
            {' '}for this coaching program.
          </span>
        </label>
      </div>

      {/* Payment step */}
      {paymentLink ? (
        <div className={`bg-white rounded-2xl border border-gray-200 p-5 space-y-3 transition-opacity ${accepted ? '' : 'opacity-60'}`}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Next step</p>
          <p className="text-sm font-semibold text-gray-900">Complete payment</p>
          {!accepted && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
              Please read and accept the Terms of Service above before proceeding to payment.
            </p>
          )}
          <div className={accepted ? '' : 'pointer-events-none'}>
            <PayNowButton paymentLink={paymentLink} afterPayUrl={afterPayUrl} />
          </div>
        </div>
      ) : (
        <div className={accepted ? '' : 'opacity-60 pointer-events-none'}>
          <a
            href={accepted ? afterPayUrl : '#'}
            className="block w-full text-center py-3 rounded-2xl text-sm font-bold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: brandColour ?? '#111827' }}
          >
            Go to your dashboard →
          </a>
          {!accepted && (
            <p className="text-xs text-center text-amber-600 mt-2">Accept the Terms of Service to continue.</p>
          )}
        </div>
      )}
    </div>
  )
}
