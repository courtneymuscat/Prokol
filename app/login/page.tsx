'use client'

import { useActionState, Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { login } from '@/app/actions/auth'
import { useBranding } from '@/app/components/BrandingProvider'
import PublicFooter from '@/app/components/PublicFooter'

function LoginForm() {
  const branding = useBranding()
  const [state, action, pending] = useActionState(login, null)
  const [showPw, setShowPw] = useState(false)
  const searchParams = useSearchParams()
  const invite = searchParams.get('invite')
  const next = searchParams.get('next')
  const deleted = searchParams.get('deleted')
  const linkExpired = searchParams.get('error') === 'link_expired'
  const accountReady = searchParams.get('msg') === 'account_ready'
  const verifyEmail = searchParams.get('msg') === 'verify_email'

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.appName} className="h-10 mx-auto object-contain" />
          ) : (
            <span className="text-2xl font-bold tracking-tight text-gray-900">{branding.appName}</span>
          )}
        </div>

        {verifyEmail && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 mb-4 text-center">
            <p className="text-sm font-semibold text-blue-800">Check your inbox</p>
            <p className="text-xs text-blue-700 mt-1">We sent a verification link to your email. Click it to confirm your account, then log in here.</p>
          </div>
        )}

        {accountReady && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 mb-4 text-center">
            <p className="text-sm font-semibold text-green-800">Account ready!</p>
            <p className="text-xs text-green-700 mt-1">Your account has been set up. Log in with the password you just chose.</p>
          </div>
        )}

        {linkExpired && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 mb-4 text-center">
            <p className="text-sm font-semibold text-red-800">Link expired</p>
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
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="block text-xs font-medium text-gray-600">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPw ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
            </div>

            {state?.error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3.5 py-2.5">{state.error}</p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 transition-colors mt-1"
              style={{ backgroundColor: '#1D9E75', color: '#ffffff' }}
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
            <Link href="/signup" className="font-medium hover:underline" style={{ color: '#1D9E75' }}>
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
    <PublicFooter />
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
