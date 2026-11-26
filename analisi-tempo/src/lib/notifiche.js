// =====================================================================
// Notifiche push dal lato del telefono.
// Su iPhone funzionano SOLO se l'app è stata aggiunta alla schermata
// Home (iOS 16.4 o successivo) e aperta da lì.
// =====================================================================
import { supabase } from './supabase.js'

const CHIAVE_PUBBLICA = import.meta.env.VITE_VAPID_PUBLIC_KEY

export const eIPhone = () => /iPhone|iPad|iPod/.test(navigator.userAgent)

/** L'app è aperta dall'icona sulla Home (e non da Safari)? */
export const installata = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true

/** Versione di iOS (es. 17.4), oppure null se non è un iPhone. */
export function versioneIOS() {
  const m = navigator.userAgent.match(/OS (\d+)_(\d+)/)
  return m && eIPhone() ? Number(`${m[1]}.${m[2]}`) : null
}

export const supportate = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export const chiaveConfigurata = () => Boolean(CHIAVE_PUBBLICA)

/** 'granted' | 'denied' | 'default' | 'non-supportate' */
export const permesso = () => (supportate() ? Notification.permission : 'non-supportate')

/** Registra il service worker (copia offline + ricezione notifiche). */
export function registraServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}

/** L'iscrizione push di questo telefono, se esiste. */
export async function iscrizioneAttuale() {
  if (!supportate()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return reg ? reg.pushManager.getSubscription() : null
}

/** Chiede il permesso, iscrive il telefono e lo salva nel database. */
export async function attiva() {
  if (!supportate()) throw new Error('Questo browser non supporta le notifiche.')
  if (!CHIAVE_PUBBLICA) throw new Error('Manca VITE_VAPID_PUBLIC_KEY (README, passo 7).')

  // Il permesso va chiesto subito dopo il tocco sul pulsante (regola di iOS)
  const esito = await Notification.requestPermission()
  if (esito !== 'granted') throw new Error('Permesso negato.')

  const reg = await navigator.serviceWorker.ready
  let iscrizione = await reg.pushManager.getSubscription()
  if (!iscrizione) {
    iscrizione = await reg.pushManager.subscribe({
      userVisibleOnly: true, // obbligatorio: ogni push mostra una notifica
      applicationServerKey: daBase64(CHIAVE_PUBBLICA),
    })
  }
  await salvaIscrizione(iscrizione)
  return iscrizione
}

/** Toglie le notifiche da questo telefono. */
export async function disattiva() {
  const iscrizione = await iscrizioneAttuale()
  if (!iscrizione) return
  await supabase.from('push_iscrizioni').delete().eq('endpoint', iscrizione.endpoint)
  await iscrizione.unsubscribe()
}

/**
 * Da chiamare a ogni apertura: se il telefono è iscritto, riconferma
 * l'iscrizione nel database (Apple/Google a volte la rinnovano).
 */
export async function riconfermaIscrizione() {
  try {
    if (permesso() !== 'granted') return
    const iscrizione = await iscrizioneAttuale()
    if (iscrizione) await salvaIscrizione(iscrizione)
  } catch {
    // offline: riproveremo alla prossima apertura
  }
}

async function salvaIscrizione(iscrizione) {
  const j = iscrizione.toJSON()
  const { error } = await supabase.from('push_iscrizioni').upsert(
    {
      endpoint: j.endpoint,
      p256dh: j.keys.p256dh,
      auth: j.keys.auth,
      dispositivo: eIPhone() ? 'iPhone' : navigator.userAgent.slice(0, 80),
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
}

/** Chiede al server di mandare subito una notifica di prova. */
export async function inviaProva() {
  const { data, error } = await supabase.functions.invoke('notifica-oraria', {
    body: { tipo: 'prova' },
  })
  if (error) throw new Error(`Il server non risponde: ${error.message}`)
  if (data?.errore) throw new Error(data.errore)
  if (!data?.inviate) throw new Error('Nessuna notifica consegnata. Riattiva le notifiche.')
  return data
}

/** Traduce gli errori tecnici più comuni in istruzioni comprensibili. */
export function spiegaErrore(e) {
  const m = String(e?.message ?? e)
  if (/applicationServerKey/i.test(m)) return 'La chiave VAPID pubblica non è valida: ricontrolla VITE_VAPID_PUBLIC_KEY su Vercel (README, passo 7).'
  if (/denied|negato|not allowed/i.test(m)) return 'Permesso negato. Riattivalo dalle Impostazioni dell\'iPhone → Notifiche → Il mio tempo.'
  if (/push service|AbortError|registration failed/i.test(m)) return 'Il servizio di notifiche di Apple/Google non ha risposto. Controlla la connessione e riprova.'
  if (/Failed to send|FunctionsFetchError|non risponde/i.test(m)) return 'La funzione "notifica-oraria" non risponde: è stata pubblicata su Supabase? (README, passo 9)'
  return m
}

/** Data di oggi (fuso di Roma) nel formato del database: 2026-11-26 */
export function oggiISO(fuso = 'Europe/Rome') {
  return new Intl.DateTimeFormat('en-CA', { timeZone: fuso }).format(new Date())
}

// La chiave VAPID è in base64 "url-safe": la converto in byte.
function daBase64(testo) {
  const pad = '='.repeat((4 - (testo.length % 4)) % 4)
  const b64 = (testo + pad).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}
