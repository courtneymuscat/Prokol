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
  }

  // ── Auth session refresh + route guards ───────────────────────────────────
  let res = NextResponse.next({ request: { headers: requestHeaders } })

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
    }
  )

  // Refresh session if expired — required for Server Components
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const path = req.nextUrl.pathname
  const isProtected =
    path.startsWith('/dashboard') ||
    path.startsWith('/onboarding') ||
    path.startsWith('/coach') ||
    path.startsWith('/messages') ||
    path.startsWith('/org')
  const isAuthPage = path === '/login' || path === '/signup'

  if (isProtected && !session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (isAuthPage && session) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return res
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}
