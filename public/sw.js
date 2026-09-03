const CACHE_NAME = 'csc-portal-cache-v1'
const PRECACHE_ASSETS = [
  '/',
  '/favicon.svg',
  '/icons.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : null)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  // Skip caching for backend API endpoints and mutating requests
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api')) {
    return
  }

  // HTML navigation: Network first, fall back to cached shell
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() => caches.match(event.request).then((res) => res || caches.match('/')))
    )
    return
  }

  // Static assets (CSS/JS/images): Cache first, revalidate in background
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // Fetch in background to update cache
        fetch(event.request)
          .then((networkRes) => {
            if (networkRes.status === 200) {
              const clone = networkRes.clone()
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
            }
          })
          .catch(() => {})
        return cached
      }

      return fetch(event.request).then((networkRes) => {
        if (
          networkRes.status === 200 &&
          (url.pathname.startsWith('/assets') ||
            url.pathname.endsWith('.svg') ||
            url.pathname.endsWith('.png') ||
            url.pathname.endsWith('.jpg') ||
            url.pathname.endsWith('.css') ||
            url.pathname.endsWith('.js'))
        ) {
          const clone = networkRes.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return networkRes
      })
    })
  )
})
