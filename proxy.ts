import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { isWhiteLabelDomain, getOrgByDomain } from '@/lib/whitelabel'

export async function proxy(req: NextRequest) {
  // ── White-label domain detection ──────────────────────────────────────────
  // Must run before auth so branding headers are available to server components.
  const hostname = req.headers.get('host') ?? ''
  let requestHeaders = new Headers(req.headers)

  if (isWhiteLabelDomain(hostname)) {
    const org = await getOrgByDomain(hostname)

    if (!org) {
      return new NextResponse(
        '<!doctype html><html><body><h1>Domain not configured</h1><p>This domain has not been set up yet.</p></body></html>',
        { status: 404, headers: { 'Content-Type': 'text/html' } },
      )
    }

    requestHeaders.set('x-org-id', org.id)
    requestHeaders.set('x-app-name', org.app_name ?? org.name)
    requestHeaders.set('x-brand-colour', org.brand_colour ?? '#F5C842')
    requestHeaders.set('x-brand-colour-secondary', org.brand_colour_secondary ?? '#1A1A1A')
    requestHeaders.set('x-brand-colour-text', org.brand_colour_text ?? '#1A1A1A')
    requestHeaders.set('x-is-white-label', 'true')
    if (org.logo_url) requestHeaders.set('x-logo-url', org.logo_url)
    if (org.favicon_url) requestHeaders.set('x-favicon-url', org.favicon_url)
    if (org.app_icon_url) requestHeaders.set('x-app-icon-url', org.app_icon_url)
  }

  // ── Auth session refresh + route guards ───────────────────────────────────
  // Surface the request path so server components can read it via headers().
  // Next 16's runtime doesn't always set x-invoke-path on its own.
  requestHeaders.set('x-pathname', req.nextUrl.pathname)

  const res = NextResponse.next({ request: { headers: requestHeaders } })

  const path = req.nextUrl.pathname
  const isProtected =
    path.startsWith('/dashboard') ||
    path.startsWith('/onboarding') ||
    path.startsWith('/coach') ||
    path.startsWith('/messages') ||
    path.startsWith('/org') ||
    path.startsWith('/print')
  const isAuthPage = path === '/login' || path === '/signup'

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
    return res
  }

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
            res.cookies.set(name, value, options)
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

  return res
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}
