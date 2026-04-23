self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  if (!event.data) return

  const payload = event.data.json()
  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'RBSHIFT', {
      body: payload.body ?? '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: payload.metadata ?? {},
      tag: payload.shift_id ?? payload.kind ?? 'rbshift-notification',
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const target = clients.find((client) => 'focus' in client)
      if (target) {
        return target.focus()
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/')
      }
      return null
    })
  )
})
