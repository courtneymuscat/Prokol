'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type InviteDetails = {
  org_name: string | null
  invited_by_name: string | null
  role: string
  email: string
}

type PageState =
  | { status: 'loading' }
  | { status: 'invalid' }
  | { status: 'valid'; invite: InviteDetails; userEmail: string | null }
  | { status: 'accepting' }
  | { status: 'accepted' }
  | { status: 'error'; message: string }

export default function OrgInvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const router = useRouter()
  const [state, setState] = useState<PageState>({ status: 'loading' })

  useEffect(() => {
    async function load() {
      // Fetch invite details
      const inviteRes = await fetch(`/api/org/invite/${token}`)
      if (!inviteRes.ok) {
        setState({ status: 'invalid' })
        return
      }
      const invite: InviteDetails = await inviteRes.json()

      // Check if the user is currently logged in
      let userEmail: string | null = null
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        userEmail = session?.user?.email ?? null
      } catch {
        // Not logged in — continue as guest
      }

      setState({ status: 'valid', invite, userEmail })
    }
    load()
  }, [token])

  async function acceptAsCurrentUser() {
    setState({ status: 'accepting' })
    const res = await fetch(`/api/org/invite/${token}`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setState({ status: 'accepted' })
      router.push(data.redirect ?? '/coach/dashboard')
    } else {
      setState({ status: 'error', message: data.error ?? 'Something went wrong' })
    }
  }

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (state.status === 'invalid') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900">Invite not found</h1>
          <p className="text-sm text-gray-500">
            This invite has expired or is invalid. Ask your organisation owner to send a new invite.
          </p>
          <a href="/dashboard" className="text-sm text-blue-600 hover:underline">Go to dashboard</a>
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-8 text-center space-y-4">
          <p className="text-gray-700 font-medium">{state.message}</p>
          <a href="/dashboard" className="text-sm text-blue-600 hover:underline">Go to dashboard</a>
        </div>
      </div>
    )
  }

  if (state.status === 'accepted' || state.status === 'accepting') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    )
  }

  const { invite, userEmail } = state

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-8 space-y-6">
        {/* Icon */}
        <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>

        {/* Invite details */}
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-gray-900">
            {invite.org_name ?? 'An organisation'} has invited you to join their team
          </h1>
          {invite.invited_by_name && (
            <p className="text-sm text-gray-500">
              Invited by <span className="font-medium text-gray-700">{invite.invited_by_name}</span>
              {' '}as a <span className="font-medium text-gray-700 capitalize">{invite.role}</span>
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {userEmail ? (
            <button
              onClick={acceptAsCurrentUser}
              className="block w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors text-center"
            >
              Accept as {userEmail}
            </button>
          ) : (
            <a
              href={`/signup?invite=${token}`}
              className="block w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors text-center"
            >
              Create account &amp; accept
            </a>
          )}

          {!userEmail && (
            <a
              href={`/login?invite=${token}`}
              className="block w-full border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors text-center"
            >
              Already have an account? Log in
            </a>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center">
          This invite was sent to {invite.email}. It expires in 7 days.
        </p>
      </div>
    </div>
  )
}
