'use client'

import { useState } from 'react'

type PendingInvite = {
  email: string
  inviteUrl: string
  sentAt: string
  token: string
}

function CopyInviteButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        navigator.clipboard.writeText(url).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
      }}
      className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium hover:bg-amber-100 transition-colors flex-shrink-0"
      title="Copy invite link"
    >
      {copied ? 'Copied!' : 'Copy invite link'}
    </button>
  )
}

export default function PendingInvitesPanel({ invites }: { invites: PendingInvite[] }) {
  if (invites.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">Pending invites</p>
        <span className="text-xs text-gray-400">
          {invites.length} not yet accepted
        </span>
      </div>
      <div className="space-y-2">
        {invites.map((inv) => (
          <div
            key={inv.token}
            className="flex items-center gap-4 bg-white rounded-2xl border p-4"
          >
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-amber-500">{inv.email[0].toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-gray-900 truncate">{inv.email}</p>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">
                  Invite pending
                </span>
                <CopyInviteButton url={inv.inviteUrl} />
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Invite sent — not yet accepted</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
