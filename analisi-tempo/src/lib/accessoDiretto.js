// =====================================================================
// Accesso con link/codice personale, senza email né password.
// Il link è del tipo  https://…/entra#chiave=ABCD-EFGH-JKLM-NPQR
// La funzione "accesso-diretto" sul server verifica la chiave e
// restituisce una sessione. La chiave resta salvata su questo telefono,
// così se la sessione scade l'app rientra da sola.
// =====================================================================
import { supabase } from './supabase.js'

const CHIAVE_LOCALE = 'analisi-tempo.chiave-personale'

/** Chiave presente nell'indirizzo (#chiave=...), se c'è. */
export function chiaveDaIndirizzo() {
  const m = window.location.hash.match(/chiave=([A-Za-z0-9-\s%]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

export function chiaveSalvata() {
  try {
    return localStorage.getItem(CHIAVE_LOCALE)
  } catch {
    return null
  }
}

export function dimenticaChiave() {
  try {
    localStorage.removeItem(CHIAVE_LOCALE)
  } catch {
    // niente da fare
  }
}

/** Entra con la chiave; se va bene la ricorda su questo telefono. */
export async function entraConChiave(chiave) {
  const { data, error } = await supabase.functions.invoke('accesso-diretto', {
    body: { chiave },
  })
  if (error || !data?.access_token) {
    // FunctionsHttpError: il messaggio vero è nel corpo della risposta
    let messaggio = data?.errore
    if (!messaggio && error?.context?.json) {
      messaggio = (await error.context.json().catch(() => null))?.errore
    }
    throw new Error(messaggio || 'Codice non valido o server non raggiungibile')
  }
  const esito = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  })
  if (esito.error) throw esito.error
  try {
    localStorage.setItem(CHIAVE_LOCALE, chiave)
  } catch {
    // modalità privata: si entra lo stesso, ma la chiave non viene ricordata
  }
}
