// =====================================================================
// Calcoli sulle ore.
// Un'"ora" (slot) è identificata dal suo istante di inizio, es. 13:00.
// Usiamo l'ora locale del telefono (in Italia = Europe/Rome, ora legale
// compresa). La chiave di un'ora è la sua data in formato ISO UTC, così
// è identica a quella che arriva dal database.
// =====================================================================

const UN_ORA = 60 * 60 * 1000

/** Inizio dell'ora che contiene `data` (es. 13:42 → 13:00). */
export function inizioOra(data) {
  const d = new Date(data)
  d.setMinutes(0, 0, 0)
  return d
}

/** L'ultima ora già conclusa (alle 14:05 → 13:00). */
export function ultimaOraConclusa(adesso = new Date()) {
  return new Date(inizioOra(adesso).getTime() - UN_ORA)
}

/** Chiave univoca di un'ora, uguale a quella del database. */
export function chiaveOra(data) {
  return inizioOra(data).toISOString()
}

export function oraPrecedente(data) {
  return new Date(inizioOra(data).getTime() - UN_ORA)
}

export function oraSuccessiva(data) {
  return new Date(inizioOra(data).getTime() + UN_ORA)
}

/** "13:00 – 14:00" */
export function etichettaOra(data) {
  const a = inizioOra(data)
  const b = oraSuccessiva(a)
  return `${hhmm(a)} – ${hhmm(b)}`
}

export function hhmm(data) {
  return new Date(data).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

/** "oggi", "ieri" oppure "lun 24 nov" */
export function etichettaGiorno(data, adesso = new Date()) {
  const g = inizioGiorno(data).getTime()
  const oggi = inizioGiorno(adesso).getTime()
  if (g === oggi) return 'oggi'
  if (g === inizioGiorno(new Date(oggi - 12 * UN_ORA)).getTime()) return 'ieri'
  return new Date(data).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function inizioGiorno(data) {
  const d = new Date(data)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Aggiunge giorni di calendario (corretto anche al cambio dell'ora legale). */
export function aggiungiGiorni(data, n) {
  const d = new Date(data)
  d.setDate(d.getDate() + n)
  return d
}

/** Fascia lavorativa del giorno di `data`. */
export function fasciaDelGiorno(fascia, data) {
  const f = fascia?.[String(new Date(data).getDay())]
  return f ?? { attivo: false, inizio: 8, fine: 23 }
}

/** L'ora che inizia in `data` cade dentro la fascia di lavoro? */
export function inFascia(fascia, data) {
  const f = fasciaDelGiorno(fascia, data)
  const h = new Date(data).getHours()
  return !!f.attivo && h >= f.inizio && h < f.fine
}

/**
 * Tutte le ore di un giorno (0..23). Nel giorno del cambio d'ora
 * possono essere 23 o 25: le generiamo avanzando di un'ora alla volta.
 */
export function oreDelGiorno(data) {
  const inizio = inizioGiorno(data)
  const fine = aggiungiGiorni(inizio, 1).getTime()
  const ore = []
  for (let t = inizio.getTime(); t < fine; t += UN_ORA) ore.push(new Date(t))
  return ore
}

/**
 * Ore lavorative non ancora compilate "dall'ultima registrazione".
 * Partiamo dall'ultima ora conclusa e andiamo indietro finché troviamo
 * un'ora già registrata (o finiamo il limite). Restituisce le ore in
 * ordine cronologico (la più vecchia per prima).
 *
 * @param fascia       impostazioni.fascia
 * @param registrate   Set di chiavi delle ore che hanno almeno una voce
 * @param adesso       data corrente
 * @param maxOre       quanto indietro guardare al massimo (default 48 ore)
 */
export function oreMancanti(fascia, registrate, adesso = new Date(), maxOre = 48) {
  const mancanti = []
  let ora = ultimaOraConclusa(adesso)
  const nessunaRegistrazione = registrate.size === 0
  const oggi = inizioGiorno(adesso).getTime()

  for (let i = 0; i < maxOre; i++) {
    if (registrate.has(chiaveOra(ora))) break
    // Al primo utilizzo non proponiamo i giorni passati: solo oggi.
    if (nessunaRegistrazione && ora.getTime() < oggi) break
    if (inFascia(fascia, ora)) mancanti.push(ora)
    ora = oraPrecedente(ora)
  }
  return mancanti.reverse()
}
