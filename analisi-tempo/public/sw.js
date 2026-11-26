// =====================================================================
// Service worker: lavora "dietro le quinte", anche ad app chiusa.
//  1. Tiene una copia dell'app sul telefono: si apre anche senza rete.
//  2. Riceve le notifiche push e le mostra.
//  3. Al tocco sulla notifica apre la schermata di registrazione.
// =====================================================================

// Cambia questo numero per forzare l'aggiornamento della copia sul telefono.
const VERSIONE = 'v1'
const CACHE = `il-mio-tempo-${VERSIONE}`

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(['/', '/manifest.webmanifest', '/icona-192.png', '/badge-96.png']))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      // cancello le copie delle versioni precedenti
      const nomi = await caches.keys()
      await Promise.all(nomi.filter((n) => n !== CACHE).map((n) => caches.delete(n)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (evento) => {
  const richiesta = evento.request
  const url = new URL(richiesta.url)
  // Solo le nostre pagine: le chiamate a Supabase passano senza copia.
  if (richiesta.method !== 'GET' || url.origin !== self.location.origin) return

  // Pagine (es. /registra): prima la rete, se manca uso la copia.
  if (richiesta.mode === 'navigate') {
    evento.respondWith(
      fetch(richiesta)
        .then((risposta) => {
          const copia = risposta.clone()
          caches.open(CACHE).then((c) => c.put('/', copia))
          return risposta
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  // File dell'app (JS, CSS, icone): prima la copia, altrimenti rete e salvo.
  evento.respondWith(
    caches.match(richiesta).then(
      (trovato) =>
        trovato ||
        fetch(richiesta).then((risposta) => {
          if (risposta.ok) {
            const copia = risposta.clone()
            caches.open(CACHE).then((c) => c.put(richiesta, copia))
          }
          return risposta
        }),
    ),
  )
})

// ---- Notifiche -------------------------------------------------------

self.addEventListener('push', (evento) => {
  let dati = {}
  try {
    dati = evento.data ? evento.data.json() : {}
  } catch {
    dati = { testo: evento.data ? evento.data.text() : '' }
  }
  // Su iPhone OGNI push deve mostrare una notifica, altrimenti iOS
  // smette di consegnarle: per questo mostriamo sempre qualcosa.
  evento.waitUntil(
    self.registration.showNotification(dati.titolo || 'Il mio tempo', {
      body: dati.testo || "Che cosa hai fatto nell'ultima ora?",
      tag: dati.tag || 'ora',
      icon: '/icona-192.png',
      badge: '/badge-96.png',
      data: { url: dati.url || '/registra' },
    }),
  )
})

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const url = new URL(evento.notification.data?.url || '/registra', self.location.origin).href

  evento.waitUntil(
    (async () => {
      const finestre = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      // se l'app è già aperta la porto davanti e cambio schermata…
      for (const f of finestre) {
        if (new URL(f.url).origin !== self.location.origin) continue
        await f.focus()
        f.postMessage({ tipo: 'vai', percorso: new URL(url).pathname })
        return
      }
      // …altrimenti la apro direttamente su /registra
      await self.clients.openWindow(url)
    })(),
  )
})
