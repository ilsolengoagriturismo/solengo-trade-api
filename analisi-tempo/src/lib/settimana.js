// =====================================================================
// Settimana ideale vs reale, e periodo di analisi.
// Funzioni "pure" (niente rete): facili da testare.
// =====================================================================
import { aggiungiGiorni, inizioGiorno, oreDelGiorno } from './ore.js'

export const NOMI_GIORNI = [
  ['1', 'Lunedì'],
  ['2', 'Martedì'],
  ['3', 'Mercoledì'],
  ['4', 'Giovedì'],
  ['5', 'Venerdì'],
  ['6', 'Sabato'],
  ['0', 'Domenica'],
]

/** Elenco piatto dei blocchi validi della settimana ideale, con il loro giorno. */
export function blocchiIdeali(ideale) {
  const lista = []
  for (const [g] of NOMI_GIORNI) {
    for (const [i, b] of (ideale?.[g] ?? []).entries()) {
      if (b?.categoria_id && b.fine > b.inizio) lista.push({ ...b, giorno: g, indice: i })
    }
  }
  return lista
}

/**
 * Quanto la realtà ha seguito la settimana ideale tra `da` e `a`.
 * Per ogni ora pianificata (es. lunedì 6-7 Lavoro autonomo) conto i
 * minuti registrati davvero su quella categoria in quell'ora.
 * Le ore non ancora concluse (dopo `fino`) non si contano.
 *
 * @returns {
 *   blocchi: [{ giorno, inizio, fine, categoria_id, pianificati, fatti, percentuale }],
 *   totale: { pianificati, fatti, percentuale }
 * }  (minuti; percentuale = fatti / pianificati × 100, oppure null)
 */
export function aderenzaIdeale(ideale, righe, da, a, fino = new Date()) {
  const lista = blocchiIdeali(ideale)
  if (!lista.length) return { blocchi: [], totale: { pianificati: 0, fatti: 0, percentuale: null } }

  // minuti registrati per (ora, categoria)
  const reali = new Map()
  for (const r of righe) {
    const k = `${new Date(r.ora_inizio).getTime()}|${r.categoria_id}`
    reali.set(k, (reali.get(k) ?? 0) + r.minuti)
  }

  const somme = lista.map((b) => ({ ...b, pianificati: 0, fatti: 0 }))
  for (let g = inizioGiorno(da); g < a; g = aggiungiGiorni(g, 1)) {
    const giorno = String(g.getDay())
    for (const b of somme) {
      if (b.giorno !== giorno) continue
      for (const o of oreDelGiorno(g)) {
        const h = o.getHours()
        if (h < b.inizio || h >= b.fine) continue
        if (o.getTime() + 3600000 > fino.getTime()) continue // ora non ancora conclusa
        b.pianificati += 60
        b.fatti += Math.min(60, reali.get(`${o.getTime()}|${b.categoria_id}`) ?? 0)
      }
    }
  }
  const blocchi = somme
    .filter((b) => b.pianificati > 0)
    .map((b) => ({ ...b, percentuale: (b.fatti / b.pianificati) * 100 }))
  const pianificati = blocchi.reduce((s, b) => s + b.pianificati, 0)
  const fatti = blocchi.reduce((s, b) => s + b.fatti, 0)
  return {
    blocchi,
    totale: { pianificati, fatti, percentuale: pianificati ? (fatti / pianificati) * 100 : null },
  }
}

// ---- Periodo di analisi ------------------------------------------------

/** "2026-12-01" → Date locale (mezzanotte), oppure null. */
export function daDataISO(testo) {
  if (!testo) return null
  const [y, m, d] = String(testo).split('-').map(Number)
  return y && m && d ? new Date(y, m - 1, d) : null
}

/** Periodo dell'esercizio: { da, a, etichetta } oppure null se non impostato. */
export function periodoAnalisi(dal, al) {
  const da = daDataISO(dal)
  const fine = daDataISO(al)
  if (!da || !fine || fine < da) return null
  const fmt = (d) => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
  return { da, a: aggiungiGiorni(fine, 1), etichetta: `dal ${fmt(da)} al ${fmt(fine)}` }
}
