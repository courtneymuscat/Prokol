import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const token_hash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type')
  const next = url.searchParams.get('next') ?? '/dashboard'
  const error_code = url.searchParams.get('error_code')
  const error_description = url.searchParams.get('error_description')

  // Supabase sometimes sends error params directly
  if (error_code || error_description) {
    return NextResponse.redirect(new URL('/login?error=link_expired', url.origin))
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) =>
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  )

  // PKCE code flow
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin))
    }
  }

  // token_hash flow (Supabase v2 email links)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type: type as 'recovery' | 'email' | 'invite' | 'magiclink' | 'email_change' })
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin))
    }
  }

  // All verification methods failed
  return NextResponse.redirect(new URL('/login?error=link_expired', url.origin))
}
