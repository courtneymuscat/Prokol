'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    // Supabase may deliver recovery tokens in the URL hash (implicit flow)
    // e.g. /reset-password#access_token=...&refresh_token=...&type=recovery
    // The server-side callback can't read hash fragments, so we handle it here.
    async function init() {
      const hash = window.location.hash
      if (hash) {
        const params = new URLSearchParams(hash.slice(1))
        const access_token = params.get('access_token')
        const refresh_token = params.get('refresh_token')
        const type = params.get('type')
        if (access_token && refresh_token && type === 'recovery') {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token })
          if (error) { setSessionError('Reset link is invalid or has expired. Please request a new one.'); return }
          // Clear the hash so tokens aren't in the URL
          window.history.replaceState(null, '', window.location.pathname)
          setReady(true)
          return
        }
      }

      // No hash — check for an existing session established by /auth/callback code exchange
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setReady(true)
      } else {
        setSessionError('This reset link has expired or already been used. Please request a new one.')
      }
    }
    init()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setSaving(true)
    setError(null)
    const { error: updateErr } = await supabase.auth.updateUser({ password })
    if (updateErr) { setError(updateErr.message); setSaving(false); return }
    setDone(true)
    setTimeout(() => { window.location.href = '/dashboard' }, 1800)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-2xl font-bold tracking-tight text-gray-900">Prokol</span>
        </div>

        <div className="bg-white rounded-2xl p-8 space-y-5">
          {sessionError ? (
            <div className="space-y-4 text-center">
              <p className="text-sm font-semibold text-red-700">{sessionError}</p>
              <a
                href="/forgot-password"
                className="inline-block w-full bg-[#1D9E75] text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-[#178A64] transition-colors text-center"
              >
                Request a new reset link
              </a>
            </div>
          ) : done ? (
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <p className="text-sm font-semibold text-gray-900">Password updated!</p>
              <p className="text-xs text-gray-400">Redirecting to your dashboard…</p>
            </div>
          ) : !ready ? (
            <p className="text-sm text-gray-400 text-center py-2">Verifying reset link…</p>
          ) : (
            <>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Set a new password</h1>
                <p className="text-sm text-gray-500 mt-1">Choose a strong password for your account.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="password" className="block text-xs font-medium text-gray-600">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPw ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      tabIndex={-1}
                    >
                      {showPw ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3.5 py-2.5">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-[#1D9E75] text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-[#178A64] disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving…' : 'Set new password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
