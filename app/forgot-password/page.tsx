'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { forgotPassword } from '@/app/actions/auth'

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(forgotPassword, null)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-2xl font-bold tracking-tight text-gray-900">Prokol</span>
        </div>

        <div className="bg-white rounded-2xl p-8 space-y-5">
          {state?.success ? (
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-gray-900">Check your email</h1>
              <p className="text-sm text-gray-500">
                We&apos;ve sent a password reset link. Check your inbox and click the link to set a new password.
              </p>
              <Link href="/login" className="block text-sm text-[#1D9E75] font-medium hover:underline pt-2">
                Back to log in
              </Link>
            </div>
          ) : (
            <>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Reset your password</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Enter your email and we&apos;ll send you a reset link.
                </p>
              </div>

              <form action={action} className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="email" className="block text-xs font-medium text-gray-600">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                  />
                </div>

                {state?.error && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3.5 py-2.5">{state.error}</p>
                )}

                <button
                  type="submit"
                  disabled={pending}
                  className="w-full bg-[#1D9E75] text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-[#178A64] disabled:opacity-50 transition-colors"
                >
                  {pending ? 'Sending…' : 'Send reset link'}
                </button>
              </form>

              <p className="text-center text-sm text-gray-500">
                <Link href="/login" className="text-[#1D9E75] font-medium hover:underline">
                  Back to log in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
