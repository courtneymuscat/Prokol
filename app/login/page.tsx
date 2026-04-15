'use client'

import { useActionState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { login } from '@/app/actions/auth'

function LoginForm() {
  const [state, action, pending] = useActionState(login, null)
  const searchParams = useSearchParams()
  const invite = searchParams.get('invite')
  const next = searchParams.get('next')
  const deleted = searchParams.get('deleted')
  const linkExpired = searchParams.get('error') === 'link_expired'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-2xl font-bold tracking-tight text-gray-900">Prokol</span>
        </div>

        {linkExpired && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 mb-4 text-center">
            <p className="text-sm font-semibold text-red-800">Reset link expired</p>
            <p className="text-xs text-red-700 mt-1">That link has expired or already been used. <a href="/forgot-password" className="underline font-medium">Request a new one.</a></p>
          </div>
        )}

        {deleted && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 mb-4 text-center">
            <p className="text-sm font-semibold text-green-800">Account deleted</p>
            <p className="text-xs text-green-700 mt-1">Your account and all data have been permanently deleted. Any active subscription has been cancelled.</p>
          </div>
        )}

        <div className="bg-white rounded-2xl p-8 space-y-5">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Welcome back</h1>
            <p className="text-sm text-gray-500 mt-1">
              {invite ? 'Log in to accept your coaching invite.' : 'Log in to your account.'}
            </p>
          </div>

          <form action={action} className="space-y-4">
            {invite && <input type="hidden" name="invite" value={invite} />}
            {next && <input type="hidden" name="next" value={next} />}
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
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="block text-xs font-medium text-gray-600">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                placeholder="••••••••"
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {state?.error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3.5 py-2.5">{state.error}</p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full bg-blue-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors mt-1"
            >
              {pending ? 'Logging in…' : 'Log in'}
            </button>

            <p className="text-center">
              <Link href="/forgot-password" className="text-xs text-gray-400 hover:text-gray-600 hover:underline">
                Forgot password?
              </Link>
            </p>
          </form>

          <p className="text-center text-sm text-gray-500">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-blue-600 font-medium hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
