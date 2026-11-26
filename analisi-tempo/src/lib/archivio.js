// =====================================================================
// Archivio locale + sincronizzazione.
//
// Tutto quello che registri viene salvato SUBITO sul telefono
// (localStorage) e messo in una "coda". La coda viene inviata a Supabase
// appena c'è rete. Così l'app funziona anche in cantina o in campagna.
//
// Ogni elemento della coda dice: "l'ora X contiene queste voci".
// Inviarlo due volte non fa danni (la funzione sostituisci_ora del
// database rimpiazza il contenuto dell'ora), quindi niente doppioni.
// =====================================================================
import { supabase } from './supabase.js'
import { chiaveOra } from './ore.js'

const GIORNI_IN_MEMORIA = 45

// colonne lette dal database per ogni registrazione
const CAMPI_REGISTRAZIONE =
  'id, ora_inizio, minuti, categoria_id, sottocategoria_id, delegabile, energia, nota, urgente, importante, allineamento, urgenza'

let utenteId = null
let stato = vuoto()
let versione = 0
const ascoltatori = new Set()
let sincronizzazioneInCorso = null

function vuoto() {
  return {
    voci: {}, // { [chiaveOra]: [voce, ...] }
    coda: [], // [{ chiave, voci }]
    categorie: [],
    sottocategorie: [],
    impostazioni: null,
    ultimoSync: null,
    errore: null,
  }
}

function chiaveStorage() {
  return `analisi-tempo.v1.${utenteId}`
}

function salvaSuTelefono() {
  try {
    localStorage.setItem(chiaveStorage(), JSON.stringify(stato))
  } catch {
    // memoria piena o modalità privata: l'app continua a funzionare in RAM
  }
}

function notifica() {
  versione++
  salvaSuTelefono()
  ascoltatori.forEach((fn) => fn())
}

// ---- API per React ----------------------------------------------------

export function ascolta(fn) {
  ascoltatori.add(fn)
  return () => ascoltatori.delete(fn)
}
export const leggiVersione = () => versione
export const leggiStato = () => stato

// ---- Avvio ------------------------------------------------------------

/** Da chiamare dopo il login. Carica subito i dati salvati sul telefono. */
export function avvia(idUtente) {
  utenteId = idUtente
  try {
    const salvato = localStorage.getItem(chiaveStorage())
    stato = salvato ? { ...vuoto(), ...JSON.parse(salvato) } : vuoto()
  } catch {
    stato = vuoto()
  }
  notifica()
}

export function ferma() {
  utenteId = null
  stato = vuoto()
  notifica()
}

// ---- Lettura ----------------------------------------------------------

export function vociOra(data) {
  return stato.voci[chiaveOra(data)] ?? []
}

/** Insieme delle ore che hanno almeno una voce. */
export function oreRegistrate() {
  return new Set(Object.keys(stato.voci).filter((k) => stato.voci[k].length > 0))
}

/** L'ora registrata più recente prima di `data` (per "Come l'ora precedente"). */
export function ultimaOraRegistrataPrima(data) {
  const limite = chiaveOra(data)
  let migliore = null
  for (const k of Object.keys(stato.voci)) {
    if (k < limite && stato.voci[k].length > 0 && (!migliore || k > migliore)) migliore = k
  }
  return migliore ? { chiave: migliore, voci: stato.voci[migliore] } : null
}

export const categoriaPerId = (id) => stato.categorie.find((c) => c.id === id)
export const sottocategoriaPerId = (id) => stato.sottocategorie.find((s) => s.id === id)

// ---- Scrittura --------------------------------------------------------

/** Nuova voce con id generato dal telefono. */
export function nuovaVoce(categoriaId, minuti = 60, extra = {}) {
  return {
    id: crypto.randomUUID(),
    categoria_id: categoriaId,
    sottocategoria_id: null,
    minuti,
    delegabile: null,
    urgente: null, // sì / no
    importante: null, // sì / no
    allineamento: null, // 1,0..5,0: quanto è in linea con l'obiettivo (mappa, verticale)
    urgenza: null, // 1,0..5,0: quanto era urgente (mappa, orizzontale)
    energia: null,
    nota: null,
    ...extra,
  }
}

/** Sostituisce il contenuto di un'ora (lista vuota = svuota l'ora). */
export function impostaOra(data, voci) {
  const chiave = chiaveOra(data)
  stato.voci = { ...stato.voci, [chiave]: voci }
  // se c'era già un invio in coda per la stessa ora, lo rimpiazziamo
  stato.coda = [...stato.coda.filter((o) => o.chiave !== chiave), { chiave, voci }]
  notifica()
  sincronizza()
}

// ---- Sincronizzazione -------------------------------------------------

function erroreDiRete(error) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  const m = `${error?.message ?? ''} ${error?.details ?? ''}`
  return /fetch|network|load failed|timeout|jwt/i.test(m) || !error?.code
}

/** Invia la coda al database. Se manca la rete riprova più tardi. */
export function sincronizza() {
  if (!supabase || !utenteId) return Promise.resolve()
  if (sincronizzazioneInCorso) return sincronizzazioneInCorso
  sincronizzazioneInCorso = (async () => {
    // Questa attesa è necessaria: senza, con la coda vuota la funzione
    // finirebbe prima che "sincronizzazioneInCorso" venga assegnata, e
    // resterebbe bloccata per sempre.
    await null
    try {
      while (stato.coda.length > 0) {
        const op = stato.coda[0]
        const { error } = await supabase.rpc('sostituisci_ora', {
          p_ora_inizio: op.chiave,
          p_voci: op.voci,
        })
        if (error) {
          if (erroreDiRete(error)) return // riproveremo quando torna la rete
          // errore "vero" (dato non valido): scartiamo per non bloccare tutto
          stato.errore = `Un'ora non è stata salvata: ${error.message}`
        }
        // tolgo l'operazione solo se nel frattempo non è stata sostituita
        if (stato.coda[0] === op) stato.coda = stato.coda.slice(1)
        else stato.coda = stato.coda.filter((o) => o !== op)
        notifica()
      }
      stato.ultimoSync = new Date().toISOString()
      notifica()
    } catch {
      // rete assente: niente paura, la coda resta sul telefono
    } finally {
      sincronizzazioneInCorso = null
    }
  })()
  return sincronizzazioneInCorso
}

export function cancellaErrore() {
  stato.errore = null
  notifica()
}

/** Scarica dal database le registrazioni tra `da` e `a`. */
export async function scaricaRegistrazioni(da, a) {
  if (!supabase) return
  const { data, error } = await supabase
    .from('registrazioni')
    .select(CAMPI_REGISTRAZIONE)
    .gte('ora_inizio', da.toISOString())
    .lt('ora_inizio', a.toISOString())
    .order('ora_inizio')
  if (error) throw error

  const inCoda = new Set(stato.coda.map((o) => o.chiave))
  const nuove = { ...stato.voci }
  // tolgo dalla memoria le ore del periodo (verranno riscritte dal server)…
  for (const k of Object.keys(nuove)) {
    const t = new Date(k).getTime()
    if (t >= da.getTime() && t < a.getTime() && !inCoda.has(k)) delete nuove[k]
  }
  // …e ci metto quelle arrivate, tranne le ore con modifiche non ancora inviate
  for (const r of data) {
    const k = new Date(r.ora_inizio).toISOString()
    if (inCoda.has(k)) continue
    const { ora_inizio, ...voce } = r
    nuove[k] = [...(nuove[k] ?? []).filter((v) => v.id !== voce.id), voce]
  }
  // teniamo in memoria solo gli ultimi giorni
  const soglia = Date.now() - GIORNI_IN_MEMORIA * 24 * 3600 * 1000
  for (const k of Object.keys(nuove)) {
    if (new Date(k).getTime() < soglia && !inCoda.has(k)) delete nuove[k]
  }
  stato.voci = nuove
  notifica()
}

/** Scarica categorie, sottocategorie e impostazioni. */
export async function scaricaConfigurazione() {
  if (!supabase) return
  await supabase.rpc('prepara_account') // crea i dati iniziali se mancano
  const [cat, sotto, imp] = await Promise.all([
    supabase.from('categorie').select('*').order('ordine'),
    supabase.from('sottocategorie').select('*').order('ordine'),
    supabase.from('impostazioni').select('*').maybeSingle(),
  ])
  if (cat.error) throw cat.error
  if (sotto.error) throw sotto.error
  if (imp.error) throw imp.error
  stato.categorie = cat.data
  stato.sottocategorie = sotto.data
  stato.impostazioni = imp.data
  notifica()
}

/**
 * Registrazioni di un periodo per i report.
 * Con la rete le prende dal database; senza, usa quelle sul telefono.
 * In entrambi i casi applica le modifiche non ancora inviate.
 * Restituisce { righe, daTelefono } (daTelefono = true se offline).
 */
export async function caricaPeriodo(da, a) {
  let righe = null
  let daTelefono = false
  if (supabase) {
    const { data, error } = await supabase
      .from('registrazioni')
      .select(CAMPI_REGISTRAZIONE)
      .gte('ora_inizio', da.toISOString())
      .lt('ora_inizio', a.toISOString())
      .order('ora_inizio')
      .limit(5000)
    if (!error) righe = data
  }
  if (!righe) {
    daTelefono = true
    righe = Object.entries(stato.voci).flatMap(([k, voci]) =>
      voci.map((v) => ({ ...v, ora_inizio: k })),
    )
  }
  // le ore modificate ma non ancora inviate vincono su quelle del server
  const inCoda = new Map(stato.coda.map((o) => [o.chiave, o.voci]))
  righe = righe.filter((r) => !inCoda.has(new Date(r.ora_inizio).toISOString()))
  for (const [k, voci] of inCoda) righe.push(...voci.map((v) => ({ ...v, ora_inizio: k })))
  righe = righe.filter((r) => {
    const t = new Date(r.ora_inizio).getTime()
    return t >= da.getTime() && t < a.getTime()
  })
  return { righe, daTelefono }
}
