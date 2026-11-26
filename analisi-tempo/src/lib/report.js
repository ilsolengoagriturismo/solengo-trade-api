// =====================================================================
// Calcoli dei report (funzioni "pure": niente rete, facili da testare).
// Formato del foglio del corso:  Attività | Ore-mese | %
// La % è calcolata sul totale delle ore di LAVORO: "Pausa / personale"
// (e ogni categoria con "conta come lavoro" spento) è esclusa.
// =====================================================================
import { inizioGiorno, aggiungiGiorni, inFascia, oreDelGiorno } from './ore.js'

// ---- Periodi --------------------------------------------------------

/** Restituisce { da, a, etichetta } per giorno / settimana / mese. */
export function periodo(tipo, riferimento) {
  const r = inizioGiorno(riferimento)
  if (tipo === 'giorno') {
    return {
      da: r,
      a: aggiungiGiorni(r, 1),
      etichetta: r.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }),
    }
  }
  if (tipo === 'settimana') {
    // settimana italiana: da lunedì a domenica
    const daLunedi = (r.getDay() + 6) % 7
    const da = aggiungiGiorni(r, -daLunedi)
    const a = aggiungiGiorni(da, 7)
    const fmt = (d) => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
    return { da, a, etichetta: `${fmt(da)} – ${fmt(aggiungiGiorni(a, -1))}` }
  }
  // mese
  const da = new Date(r.getFullYear(), r.getMonth(), 1)
  const a = new Date(r.getFullYear(), r.getMonth() + 1, 1)
  return { da, a, etichetta: da.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }) }
}

/** Sposta il riferimento di un periodo avanti (+1) o indietro (-1). */
export function spostaPeriodo(tipo, riferimento, verso) {
  const r = new Date(riferimento)
  if (tipo === 'giorno') return aggiungiGiorni(r, verso)
  if (tipo === 'settimana') return aggiungiGiorni(r, 7 * verso)
  return new Date(r.getFullYear(), r.getMonth() + verso, 1)
}

// ---- Riepilogo per categoria ------------------------------------------

/**
 * @param righe     registrazioni del periodo [{ categoria_id, sottocategoria_id, minuti, delegabile, ... }]
 * @param categorie tutte le categorie dell'utente (anche nascoste)
 * @returns {
 *   righe: [{ categoria, minuti, percentuale, minutiDelegabili, sotto: [{ id, minuti }] }],
 *   minutiLavoro, minutiNonLavoro, minutiDelegabili
 * }
 */
export function riepilogo(righe, categorie) {
  const perCategoria = new Map()
  for (const c of categorie) {
    perCategoria.set(c.id, { categoria: c, minuti: 0, minutiDelegabili: 0, sotto: new Map() })
  }
  for (const r of righe) {
    const voce = perCategoria.get(r.categoria_id)
    if (!voce) continue
    voce.minuti += r.minuti
    if (r.delegabile === true) voce.minutiDelegabili += r.minuti
    const chiaveSotto = r.sottocategoria_id ?? 'senza'
    voce.sotto.set(chiaveSotto, (voce.sotto.get(chiaveSotto) ?? 0) + r.minuti)
  }

  const tutte = [...perCategoria.values()]
  const minutiLavoro = tutte.filter((v) => v.categoria.lavoro).reduce((s, v) => s + v.minuti, 0)
  const minutiNonLavoro = tutte.filter((v) => !v.categoria.lavoro).reduce((s, v) => s + v.minuti, 0)
  const minutiDelegabili = tutte
    .filter((v) => v.categoria.lavoro)
    .reduce((s, v) => s + v.minutiDelegabili, 0)

  const risultato = tutte
    // le categorie nascoste compaiono solo se hanno ore nel periodo
    .filter((v) => v.categoria.attiva || v.minuti > 0)
    .sort((x, y) => x.categoria.ordine - y.categoria.ordine)
    .map((v) => ({
      categoria: v.categoria,
      minuti: v.minuti,
      minutiDelegabili: v.minutiDelegabili,
      percentuale: v.categoria.lavoro && minutiLavoro ? (v.minuti / minutiLavoro) * 100 : null,
      sotto: [...v.sotto.entries()]
        .map(([id, minuti]) => ({ id: id === 'senza' ? null : id, minuti }))
        .sort((x, y) => y.minuti - x.minuti),
    }))

  return { righe: risultato, minutiLavoro, minutiNonLavoro, minutiDelegabili }
}

// ---- Copertura e proiezione -------------------------------------------

/**
 * Ore di fascia lavorativa nel periodo [da, a), contando solo quelle già
 * concluse prima di `fino` (se indicato).
 */
export function oreFascia(fascia, da, a, fino = null) {
  let ore = 0
  for (let g = new Date(da); g < a; g = aggiungiGiorni(g, 1)) {
    for (const o of oreDelGiorno(g)) {
      if (fino && o.getTime() + 3600000 > fino.getTime()) continue
      if (inFascia(fascia, o)) ore++
    }
  }
  return ore
}

/**
 * Proiezione a fine mese: quello che hai registrato finora, riportato
 * su tutte le ore di fascia del mese.
 *   proiezione = reale × (ore fascia del mese ÷ ore fascia già trascorse)
 * Restituisce null se il mese non è quello in corso o se è troppo presto.
 */
export function fattoreProiezione(fascia, inizioMese, fineMese, adesso = new Date()) {
  if (adesso < inizioMese || adesso >= fineMese) return null
  const trascorse = oreFascia(fascia, inizioMese, fineMese, adesso)
  const totali = oreFascia(fascia, inizioMese, fineMese)
  if (trascorse < 8) return null // troppo presto per una stima sensata
  return totali / trascorse
}

/** Quante ore di fascia (già concluse) hanno almeno una registrazione. */
export function copertura(righe, fascia, da, a, adesso = new Date()) {
  const attese = oreFascia(fascia, da, a, adesso)
  if (!attese) return null
  const oreConDati = new Set(righe.map((r) => new Date(r.ora_inizio).getTime()))
  let compilate = 0
  for (const t of oreConDati) if (inFascia(fascia, new Date(t))) compilate++
  return { attese, compilate, percentuale: Math.min(100, (compilate / attese) * 100) }
}

// ---- Formati ----------------------------------------------------------

/** Ore con una cifra decimale all'italiana: 2,5 */
export const ore = (minuti) =>
  (minuti / 60).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 1 })

export const percento = (p) =>
  p == null ? '' : `${p.toLocaleString('it-IT', { maximumFractionDigits: 0 })}%`

// ---- Stima vs Reale (Fase 4) --------------------------------------------

/**
 * Confronta la stima mensile di ogni categoria con il reale.
 * Per il mese in corso confronta con la PROIEZIONE a fine mese (altrimenti
 * a metà mese sembrerebbe tutto "sotto stima"); per i mesi passati con il reale.
 *
 * @param righeRiepilogo  riepilogo(...).righe
 * @param fattore         fattoreProiezione(...) oppure null
 * @returns { righe: [{ categoria, stima, valore, scostamento, scostamentoPct }], totale }
 *          (valori in ORE)
 */
export function stimaVsReale(righeRiepilogo, fattore = null) {
  const righe = righeRiepilogo
    .filter((x) => x.categoria.lavoro)
    .map((x) => {
      const stima = x.categoria.ore_stimate_mese == null ? null : Number(x.categoria.ore_stimate_mese)
      const valore = (x.minuti / 60) * (fattore ?? 1)
      const scostamento = stima == null ? null : valore - stima
      return {
        categoria: x.categoria,
        stima,
        valore,
        scostamento,
        scostamentoPct: stima ? (scostamento / stima) * 100 : null,
      }
    })
  const stimaTot = righe.reduce((s, r) => s + (r.stima ?? 0), 0)
  const valoreTot = righe.reduce((s, r) => s + r.valore, 0)
  return {
    righe,
    totale: {
      stima: stimaTot,
      valore: valoreTot,
      scostamento: valoreTot - stimaTot,
      scostamentoPct: stimaTot ? ((valoreTot - stimaTot) / stimaTot) * 100 : null,
    },
    usaProiezione: fattore != null,
  }
}

/** Ore delegabili: quanto avresti potuto passare ad altri. */
export function delegabili(righe, categorie) {
  const lavoro = new Set(categorie.filter((c) => c.lavoro).map((c) => c.id))
  const diLavoro = righe.filter((r) => lavoro.has(r.categoria_id))
  const tot = diLavoro.reduce((s, r) => s + r.minuti, 0)
  const si = diLavoro.filter((r) => r.delegabile === true).reduce((s, r) => s + r.minuti, 0)
  const risposte = diLavoro.filter((r) => r.delegabile != null).reduce((s, r) => s + r.minuti, 0)
  return {
    minutiLavoro: tot,
    minutiDelegabili: si,
    minutiConRisposta: risposte, // ore in cui hai risposto alla domanda (sì o no)
    percentuale: tot ? (si / tot) * 100 : null,
  }
}

/** "+12,5" / "−3" con segno, in ore */
export const conSegno = (oreNum) =>
  `${oreNum > 0.05 ? '+' : oreNum < -0.05 ? '−' : ''}${Math.abs(oreNum).toLocaleString('it-IT', { maximumFractionDigits: 1 })}`

// ---- Urgente / Importante (matrice di Eisenhower) --------------------------

/**
 * Minuti di LAVORO nei 4 quadranti. Conta solo le attività dove hai
 * risposto a entrambe le domande; le altre finiscono in "senzaRisposta".
 *   fare       = urgente e importante
 *   pianificare= importante, non urgente   (il quadrante da far crescere)
 *   delegare   = urgente, non importante
 *   eliminare  = né urgente né importante
 */
export function matriceUrgenteImportante(righe, categorie) {
  const lavoro = new Set(categorie.filter((c) => c.lavoro).map((c) => c.id))
  const m = { fare: 0, pianificare: 0, delegare: 0, eliminare: 0, senzaRisposta: 0 }
  for (const r of righe) {
    if (!lavoro.has(r.categoria_id)) continue
    // valori della mappa (1..5, centro 3) se ci sono, altrimenti i vecchi sì/no
    const urgente = r.urgenza != null ? Number(r.urgenza) > 3 : r.urgente
    const importante = r.urgenza != null && r.allineamento != null ? Number(r.allineamento) > 3 : r.importante
    if (urgente == null || importante == null) m.senzaRisposta += r.minuti
    else if (urgente && importante) m.fare += r.minuti
    else if (importante) m.pianificare += r.minuti
    else if (urgente) m.delegare += r.minuti
    else m.eliminare += r.minuti
  }
  m.conRisposta = m.fare + m.pianificare + m.delegare + m.eliminare
  return m
}

// ---- Allineamento all'obiettivo principale (1..5) ----------------------------

/**
 * Media dei voti 1..5 pesata sui minuti (un'ora intera a 5 pesa più di
 * 10 minuti a 1), solo per le attività di lavoro con un voto.
 * perVoto[n] = minuti con voto n.
 */
export function allineamentoObiettivo(righe, categorie) {
  const lavoro = new Set(categorie.filter((c) => c.lavoro).map((c) => c.id))
  const perVoto = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let minuti = 0
  let somma = 0
  for (const r of righe) {
    if (!lavoro.has(r.categoria_id) || r.allineamento == null) continue
    const voto = Number(r.allineamento) // può avere un decimale (mappa a tocco)
    perVoto[Math.min(5, Math.max(1, Math.round(voto)))] += r.minuti
    minuti += r.minuti
    somma += voto * r.minuti
  }
  return { media: minuti ? somma / minuti : null, minutiConVoto: minuti, perVoto }
}

// ---- Mappa a bolle ---------------------------------------------------------

/**
 * Una bolla per categoria: posizione = media (pesata sui minuti) di urgenza
 * e allineamento delle attività piazzate sulla mappa; grandezza = minuti.
 */
export function bolleMappa(righe, categorie) {
  const perCat = new Map()
  for (const r of righe) {
    if (r.urgenza == null || r.allineamento == null) continue
    const b = perCat.get(r.categoria_id) ?? { minuti: 0, su: 0, sa: 0 }
    b.minuti += r.minuti
    b.su += Number(r.urgenza) * r.minuti
    b.sa += Number(r.allineamento) * r.minuti
    perCat.set(r.categoria_id, b)
  }
  return categorie
    .filter((c) => perCat.has(c.id))
    .map((c) => {
      const b = perCat.get(c.id)
      return { categoria: c, minuti: b.minuti, urgenza: b.su / b.minuti, allineamento: b.sa / b.minuti }
    })
    .sort((x, y) => y.minuti - x.minuti) // le grandi sotto, le piccole sopra
}

// ---- Concentrazione e frammentazione (Cal Newport, Paul Graham) ------------

/**
 * Guarda ogni ora registrata:
 *   pulita   = una sola attività in tutta l'ora
 *   spezzata = 3 o più attività nella stessa ora
 * e conta i BLOCCHI di lavoro autonomo: 2 o più ore di fila dedicate
 * (almeno 50′ su 60′) alla categoria 1 "Lavoro autonomo".
 */
export function concentrazione(righe, categorie) {
  const autonomo = new Set(categorie.filter((c) => c.codice === 1).map((c) => c.id))
  const perOra = new Map()
  for (const r of righe) {
    const t = new Date(r.ora_inizio).getTime()
    const o = perOra.get(t) ?? { attivita: new Set(), autonomo: 0 }
    o.attivita.add(r.categoria_id)
    if (autonomo.has(r.categoria_id)) o.autonomo += r.minuti
    perOra.set(t, o)
  }
  let pulite = 0
  let spezzate = 0
  for (const o of perOra.values()) {
    if (o.attivita.size === 1) pulite++
    if (o.attivita.size >= 3) spezzate++
  }
  // blocchi: ore consecutive con almeno 50′ di lavoro autonomo
  const oreAutonomo = [...perOra.entries()]
    .filter(([, o]) => o.autonomo >= 50)
    .map(([t]) => t)
    .sort((a, b) => a - b)
  let blocchi = 0
  let oreInBlocchi = 0
  let fila = 0
  for (let i = 0; i <= oreAutonomo.length; i++) {
    const continua = i > 0 && i < oreAutonomo.length && oreAutonomo[i] - oreAutonomo[i - 1] === 3600000
    if (i < oreAutonomo.length && (i === 0 || continua)) {
      fila = continua ? fila + 1 : 1
      continue
    }
    if (fila >= 2) {
      blocchi++
      oreInBlocchi += fila
    }
    fila = i < oreAutonomo.length ? 1 : 0
  }
  return { oreRegistrate: perOra.size, pulite, spezzate, blocchi, oreInBlocchi }
}

// ---- "In breve": frasi automatiche per il report ---------------------------

const euro = (n) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

/**
 * Le 3-4 cose più importanti del periodo, in italiano semplice.
 * @param dati { r, deleg, matrice, allin, svr, conc, valoreOra }
 */
export function frasiChiave({ r, deleg, matrice, allin, svr, conc, valoreOra, tempoEn }) {
  const frasi = []
  if (!r.minutiLavoro) return frasi

  // 1. la voce più grande
  const top = [...r.righe].filter((x) => x.categoria.lavoro).sort((a, b) => b.minuti - a.minuti)[0]
  if (top?.minuti) {
    frasi.push(`La voce più grande è «${top.categoria.nome}»: ${ore(top.minuti)} h, il ${percento(top.percentuale)} del lavoro.`)
  }

  // 2. lo scostamento maggiore rispetto alla stima (solo mese)
  const scost = svr?.righe
    .filter((x) => x.scostamento != null && x.stima)
    .sort((a, b) => Math.abs(b.scostamento) - Math.abs(a.scostamento))[0]
  if (scost && Math.abs(scost.scostamentoPct) >= 25) {
    const parola = svr.usaProiezione ? 'previste a fine mese' : 'reali'
    frasi.push(
      `«${scost.categoria.nome}»: ${ore(scost.valore * 60)} h ${parola} contro ${ore(scost.stima * 60)} stimate (${conSegno(scost.scostamento)} h).`,
    )
  }

  // 3. tempo da delegare, in ore e in euro
  // stesso numero della sezione "Ore delegabili" (la mappa segna delegabile il riquadro in basso a destra)
  const minDelega = deleg?.minutiDelegabili ?? 0
  if (minDelega >= 30) {
    let f = `Ore delegabili: ${ore(minDelega)} h (${percento((minDelega / r.minutiLavoro) * 100)} del lavoro).`
    if (valoreOra) f += ` Al tuo valore di ${euro(valoreOra)}/h sono ${euro((minDelega / 60) * valoreOra)} del tuo tempo.`
    frasi.push(f)
  }

  // 4. concentrazione
  if (conc?.oreRegistrate >= 6) {
    frasi.push(
      `Ore senza interruzioni: ${conc.pulite} su ${conc.oreRegistrate}; ore spezzate in 3 o più attività: ${conc.spezzate}. ` +
        (conc.blocchi
          ? `Blocchi di lavoro autonomo da 2+ ore: ${conc.blocchi}.`
          : 'Nessun blocco di lavoro autonomo da 2 ore di fila.'),
    )
  }

  // 5. energia Esydo: l'attività che ti costa di più
  const peggiore = tempoEn?.righe?.at(-1)
  if (peggiore && tempoEn.righe.length >= 2 && peggiore.differenza <= -5 && peggiore.minuti >= 60) {
    frasi.push(
      `Energia: durante «${peggiore.categoria.nome}» sei a ${Math.round(peggiore.media)}/100, ${Math.round(-peggiore.differenza)} punti sotto la tua media.`,
    )
  }

  // 6. allineamento all'obiettivo
  if (allin?.media != null && frasi.length < 5) {
    frasi.push(
      `In linea con l'obiettivo: media ${allin.media.toLocaleString('it-IT', { maximumFractionDigits: 1 })} su 5.`,
    )
  }
  return frasi.slice(0, 5)
}

// ---- Le tue ore migliori (Loehr & Schwartz: gestire l'energia) -------------

/**
 * Energia media (1..3) per ora del giorno, pesata sui minuti, e la fascia
 * di 2 ore consecutive con l'energia più alta (minimo 2 registrazioni per ora).
 */
export function oreMigliori(righe) {
  const perOra = Array.from({ length: 24 }, () => ({ minuti: 0, somma: 0, conteggio: 0 }))
  for (const r of righe) {
    if (r.energia == null) continue
    const h = new Date(r.ora_inizio).getHours()
    perOra[h].minuti += r.minuti
    perOra[h].somma += r.energia * r.minuti
    perOra[h].conteggio++
  }
  const ore = perOra.map((o, h) => ({
    ora: h,
    media: o.conteggio >= 2 ? o.somma / o.minuti : null,
    conteggio: o.conteggio,
  }))
  let migliore = null
  for (let h = 0; h < 23; h++) {
    const a = ore[h].media
    const b = ore[h + 1].media
    if (a == null || b == null) continue
    const m = (a + b) / 2
    if (!migliore || m > migliore.media) migliore = { da: h, a: h + 2, media: m }
  }
  return { ore: ore.filter((o) => o.media != null), migliore }
}

// ---- Tempo × energia (Esydo) ------------------------------------------------

/**
 * Collega ogni attività all'energia misurata da Esydo nella stessa ora.
 * Per ogni categoria: escore medio (pesato sui minuti) nelle ore in cui
 * l'hai fatta, e differenza rispetto alla tua media generale.
 * @param righe    registrazioni del periodo
 * @param energia  [{ ora: ISO inizio ora, escore }] da caricaEnergiaEsydo
 */
export function tempoEnergia(righe, energia, categorie) {
  const perOra = new Map(energia.map((e) => [new Date(e.ora).getTime(), e.escore]))
  const perCat = new Map()
  let minuti = 0
  let somma = 0
  for (const r of righe) {
    const e = perOra.get(new Date(r.ora_inizio).getTime())
    if (e == null) continue
    const c = perCat.get(r.categoria_id) ?? { minuti: 0, somma: 0 }
    c.minuti += r.minuti
    c.somma += e * r.minuti
    perCat.set(r.categoria_id, c)
    minuti += r.minuti
    somma += e * r.minuti
  }
  const media = minuti ? somma / minuti : null
  const righeCat = categorie
    .filter((c) => perCat.has(c.id))
    .map((c) => {
      const x = perCat.get(c.id)
      const m = x.somma / x.minuti
      return { categoria: c, minuti: x.minuti, media: m, differenza: m - media }
    })
    .sort((a, b) => b.differenza - a.differenza)
  return { media, minutiConEnergia: minuti, righe: righeCat }
}

/** Le letture Esydo trasformate per oreMigliori (energia = escore). */
export const energiaComeRighe = (energia) =>
  energia.map((e) => ({ ora_inizio: e.ora, minuti: 60, energia: e.escore }))
