import { createBrowserClient } from '@supabase/ssr'

// Memoized as a singleton — dozens of client components each call
// createClient() independently on mount. @supabase/auth-js uses the
// browser's Web Locks API internally to coordinate session refreshes, and
// creating a fresh client per call means each one renegotiates that lock
// around the same moment (worst on page load, when many components mount
// together). That race can surface as an uncaught "Lock was stolen by
// another request" error — a known class of issue in the Supabase JS
// client, more common on Safari/WebKit. Reusing one instance avoids the
// race entirely: the browser client holds no per-caller state, so sharing
// it is safe.
function createBrowserClientInstance() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

let browserClient: ReturnType<typeof createBrowserClientInstance> | undefined

export function createClient() {
  if (!browserClient) browserClient = createBrowserClientInstance()
  return browserClient
}
