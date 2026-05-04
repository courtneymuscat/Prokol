const CACHE = 'prokol-v2'

self.addEventListener('install', (e) => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => clients.claim())
  )
})

// Network-first for navigations; cache-first for static assets
self.addEventListener('fetch', (e) => {
  const { request } = e
  const url = new URL(request.url)

  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // For API routes — always network
  if (url.pathname.startsWith('/api/')) return

  // For page navigations — network first, fall back to cache
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(request, clone))
          return res
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // For static assets — cache first
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((res) => {
          caches.open(CACHE).then((c) => c.put(request, res.clone()))
          return res
        })
      })
    )
  }
})

// ── Push notifications ─────────────────────────────────────────────────────────

self.addEventListener('push', (e) => {
  if (!e.data) return

  let payload
  try {
    payload = e.data.json()
  } catch {
    payload = { title: 'Prokol', body: e.data.text() }
  }

  const { title, body, url, icon, tag } = payload

  e.waitUntil(
    self.registration.showNotification(title ?? 'Prokol', {
      body: body ?? '',
      icon: icon ?? '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      tag: tag ?? 'prokol-notification',
      renotify: true,       // vibrate even if same tag is already showing
      data: { url: url ?? '/' },
    })
  )
})

// Open the target URL when the user taps a notification
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const targetUrl = e.notification.data?.url ?? '/'

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If app is already open — focus it and navigate
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.focus()
          client.navigate(targetUrl)
          return
        }
      }
      // Otherwise open a new window
      return clients.openWindow(targetUrl)
    })
  )
})
