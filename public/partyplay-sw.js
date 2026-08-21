const scopePath = new URL(self.registration.scope).pathname

self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data ? event.data.json() : {} } catch { payload = { title: 'پارتی پلی', body: event.data ? event.data.text() : '' } }
  const title = payload.title || 'پارتی پلی'
  const options = {
    body: payload.body || 'یک خبر تازه در PartyPlay داری.',
    icon: `${scopePath}favicon.svg`,
    badge: `${scopePath}favicon.svg`,
    tag: payload.tag || 'partyplay-notification',
    renotify: false,
    data: { url: payload.url || `${scopePath}?view=activity` },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destination = new URL(event.notification.data?.url || `${scopePath}?view=activity`, self.location.origin).href
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if ('focus' in client) {
        await client.navigate?.(destination)
        return client.focus()
      }
    }
    return clients.openWindow(destination)
  })())
})
