import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getOrgBrandingForUser, applyBrandingHeaders } from '@/lib/whitelabel'

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname
  const requestHeaders = new Headers(req.headers)

  // Surface the request path so server components can read it via headers().
  // Next 16's runtime doesn't always set x-invoke-path on its own.
  requestHeaders.set('x-pathname', path)

  const isProtected =
    path.startsWith('/dashboard') ||
    path.startsWith('/onboarding') ||
    path.startsWith('/coach') ||
    path.startsWith('/messages') ||
    path.startsWith('/org') ||
    path.startsWith('/print')
  const isAuthPage = path === '/login' || path === '/signup'
  // Admin Mode always stays Prokol-branded — even for a platform admin who
  // also owns a white-labelled org — it's the platform-operator surface,
  // not that org's own experience.
  const isAdminPath = path.startsWith('/admin')

  // Fast path: a request without any Supabase auth cookie can't be signed in,
  // so we skip the Supabase round-trip entirely. Saves ~50–150 ms on every
  // request from anonymous users (marketing pages, public asset routes).
  //
  // Logged-in users still hit Supabase on every matched request because
  // middleware is where access tokens get rotated when they near expiry.
  // Skipping the refresh on non-protected routes would silently log users
  // out after ~1h of browsing pages like /cycle, /workouts, /forms, etc.,
  // which are NOT in `isProtected` but are still logged-in-only routes.
  const hasSupabaseCookie = req.cookies.getAll().some((c) => c.name.startsWith('sb-'))

  if (isProtected && !hasSupabaseCookie) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (!hasSupabaseCookie) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  // Temporary response purely to let the Supabase client attach refreshed
  // session cookies as a side effect of getSession() below. The real
  // response is built at the very end, once every header decision —
  // including the logged-in-user branding lookup, which needs the session
  // first — is resolved; its cookies are copied over from this one.
  const cookieCarrier = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value)
            cookieCarrier.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  // Refresh session if expired — required for Server Components.
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (isProtected && !session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (isAuthPage && session) {
    // Honour ?next= and ?org_invite= so a logged-in user clicking an
    // invite/signup link from email lands on the right destination instead of
    // being dumped on /dashboard with the context stripped.
    const nextParam = req.nextUrl.searchParams.get('next')
    const orgInvite = req.nextUrl.searchParams.get('org_invite')
    if (orgInvite) {
      return NextResponse.redirect(new URL(`/org/invite/${orgInvite}`, req.url))
    }
    if (nextParam && nextParam.startsWith('/')) {
      return NextResponse.redirect(new URL(nextParam, req.url))
    }
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // ── Logged-in-user white-label branding ───────────────────────────────────
  // Branding is tied entirely to the account, not to any domain — a coach
  // or client sees their org's white-label branding the moment they're
  // logged in, on plain prokol.io, same as everywhere else. Never inside
  // Admin Mode (the platform-operator surface stays Prokol-branded even for
  // a platform admin who also owns a white-labelled org).
  if (session && !isAdminPath) {
    const orgBranding = await getOrgBrandingForUser(session.user.id)
    if (orgBranding) {
      applyBrandingHeaders(requestHeaders, orgBranding)
    }
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } })
  cookieCarrier.cookies.getAll().forEach((cookie) => res.cookies.set(cookie))

  return res
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}
