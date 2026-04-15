'use client'

import { useActionState } from 'react'
import { resetPassword } from '@/app/actions/auth'

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState(resetPassword, null)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-2xl font-bold tracking-tight text-gray-900">Prokol</span>
        </div>

        <div className="bg-white rounded-2xl p-8 space-y-5">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Set a new password</h1>
            <p className="text-sm text-gray-500 mt-1">Choose a strong password for your account.</p>
          </div>

          <form action={action} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="password" className="block text-xs font-medium text-gray-600">
                New password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                placeholder="At least 8 characters"
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {state?.error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3.5 py-2.5">{state.error}</p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full bg-blue-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {pending ? 'Saving…' : 'Set new password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
