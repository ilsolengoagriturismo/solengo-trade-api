// =====================================================================
// Export per il coach: CSV (si apre con Excel / Numbers) e PDF.
// Sul telefono il file viene passato al menu "Condividi" (Mail,
// WhatsApp, File…); sul computer viene scaricato.
// =====================================================================
import { ore, percento, conSegno } from './report.js'

// ---- CSV --------------------------------------------------------------
// Separatore ";" e virgola decimale: è il formato che Excel in italiano
// apre correttamente con un doppio clic. Il carattere iniziale (BOM) fa
// riconoscere gli accenti.

function cella(v) {
  const t = v == null ? '' : String(v)
  return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}
const riga = (valori) => valori.map(cella).join(';')
const numero = (n, cifre = 1) =>
  n == null ? '' : n.toLocaleString('it-IT', { maximumFractionDigits: cifre, useGrouping: false })

/** Riepilogo nel formato del foglio del corso (+ stima e delegabili). */
export function csvRiepilogo({ titolo, r, svr, fattore }) {
  const intest = ['N.', 'Attività', 'Ore', '%', 'Ore delegabili']
  if (fattore) intest.push('Proiezione fine mese')
  if (svr) intest.push('Stima ore/mese', svr.usaProiezione ? 'Scostamento (proiezione)' : 'Scostamento')

  const righe = [riga([titolo]), '', riga(intest)]
  let n = 0
  for (const x of r.righe.filter((y) => y.categoria.lavoro)) {
    n++
    const s = svr?.righe.find((y) => y.categoria.id === x.categoria.id)
    const valori = [n, x.categoria.nome, numero(x.minuti / 60), numero(x.percentuale, 1), numero(x.minutiDelegabili / 60)]
    if (fattore) valori.push(numero((x.minuti / 60) * fattore))
    if (svr) valori.push(numero(s?.stima), numero(s?.scostamento))
    righe.push(riga(valori))
  }
  const tot = ['', 'TOTALE LAVORO', numero(r.minutiLavoro / 60), r.minutiLavoro ? '100' : '', numero(r.minutiDelegabili / 60)]
  if (fattore) tot.push(numero((r.minutiLavoro / 60) * fattore))
  if (svr) tot.push(numero(svr.totale.stima), numero(svr.totale.scostamento))
  righe.push(riga(tot))
  for (const x of r.righe.filter((y) => !y.categoria.lavoro)) {
    righe.push(riga(['', `${x.categoria.nome} (esclusa dal totale)`, numero(x.minuti / 60)]))
  }
  return '﻿' + righe.join('\r\n') + '\r\n'
}

const siNo = (v) => (v == null ? '' : v ? 'sì' : 'no')

/** Tutte le registrazioni del periodo, una riga per voce. */
export function csvDettaglio(righe, categorie, sottocategorie) {
  const nomeCat = new Map(categorie.map((c) => [c.id, c.nome]))
  const nomeSotto = new Map(sottocategorie.map((s) => [s.id, s.nome]))
  const intest = riga(['Data', 'Ora', 'Minuti', 'Attività', 'Sottocategoria', 'Delegabile', 'Urgente', 'Importante', 'Obiettivo (1-5)', 'Energia (1-3)', 'Nota'])
  const ordinate = [...righe].sort((a, b) => new Date(a.ora_inizio) - new Date(b.ora_inizio))
  const corpo = ordinate.map((r) => {
    const d = new Date(r.ora_inizio)
    return riga([
      d.toLocaleDateString('it-IT'),
      d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
      r.minuti,
      nomeCat.get(r.categoria_id) ?? '',
      nomeSotto.get(r.sottocategoria_id) ?? '',
      siNo(r.delegabile),
      siNo(r.urgente),
      siNo(r.importante),
      r.allineamento ?? '',
      r.energia ?? '',
      r.nota ?? '',
    ])
  })
  return '﻿' + [intest, ...corpo].join('\r\n') + '\r\n'
}

// ---- PDF --------------------------------------------------------------

/** Trasforma "#2563eb" in [37, 99, 235] */
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

/**
 * Crea il PDF del report. jsPDF viene caricato solo quando serve, così
 * l'app resta leggera.
 */
export async function pdfReport({ titolo, sottotitolo, r, svr, fattore, deleg, matrice, allin, cop }) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const M = 15 // margine
  const L = 210 - 2 * M // larghezza utile
  let y = 18

  // i font standard del PDF non hanno il segno meno tipografico: uso il trattino
  const testo = (t, x, yy, opz = {}) => doc.text(String(t).replace(/\u2212/g, '-'), x, yy, opz)
  const nuovaPaginaSeServe = (spazio) => {
    if (y + spazio > 282) {
      doc.addPage()
      y = 18
    }
  }

  doc.setFont('helvetica', 'bold').setFontSize(16)
  testo("Un'analisi del proprio tempo", M, y)
  y += 7
  doc.setFont('helvetica', 'normal').setFontSize(11)
  testo(titolo, M, y)
  y += 5
  doc.setTextColor(110)
  doc.setFontSize(9)
  testo(sottotitolo, M, y)
  doc.setTextColor(0)
  y += 9

  // --- Tabella nel formato del corso ---
  const colonne = [
    { t: 'Attività', x: M, w: 82 },
    { t: 'Ore', x: M + 100, a: 'right' },
    { t: '%', x: M + 118, a: 'right' },
  ]
  if (fattore) colonne.push({ t: 'Proiez.', x: M + 140, a: 'right' })
  if (svr) colonne.push({ t: 'Stima', x: M + 160, a: 'right' }, { t: 'Scost.', x: M + L, a: 'right' })

  doc.setFont('helvetica', 'bold').setFontSize(9)
  colonne.forEach((c) => testo(c.t, c.x, y, { align: c.a ?? 'left' }))
  y += 2
  doc.setDrawColor(0).line(M, y, M + L, y)
  y += 5
  doc.setFont('helvetica', 'normal')

  const scriviRiga = (valori, grassetto = false, colore = null) => {
    nuovaPaginaSeServe(7)
    doc.setFont('helvetica', grassetto ? 'bold' : 'normal')
    if (colore) {
      doc.setFillColor(...rgb(colore))
      doc.rect(M, y - 2.6, 2.6, 2.6, 'F')
    }
    valori.forEach((v, i) => {
      const c = colonne[i]
      if (!c) return
      const x = i === 0 && colore ? c.x + 4 : c.x
      testo(i === 0 ? doc.splitTextToSize(v, c.w)[0] : v, x, y, { align: c.a ?? 'left' })
    })
    y += 6
  }

  let n = 0
  for (const x of r.righe.filter((v) => v.categoria.lavoro)) {
    n++
    const s = svr?.righe.find((v) => v.categoria.id === x.categoria.id)
    const valori = [`${n}. ${x.categoria.nome}`, ore(x.minuti), x.minuti ? percento(x.percentuale) : '']
    if (fattore) valori.push(ore(x.minuti * fattore))
    if (svr) valori.push(s?.stima == null ? '' : ore(s.stima * 60), s?.scostamento == null ? '' : conSegno(s.scostamento))
    scriviRiga(valori, false, x.categoria.colore)
  }
  doc.line(M, y - 3.5, M + L, y - 3.5)
  const tot = ['Totale lavoro', ore(r.minutiLavoro), r.minutiLavoro ? '100%' : '']
  if (fattore) tot.push(ore(r.minutiLavoro * fattore))
  if (svr) tot.push(ore(svr.totale.stima * 60), conSegno(svr.totale.scostamento))
  scriviRiga(tot, true)
  doc.setTextColor(110)
  for (const x of r.righe.filter((v) => !v.categoria.lavoro && v.minuti > 0)) {
    scriviRiga([`${x.categoria.nome} (esclusa)`, ore(x.minuti)])
  }
  doc.setTextColor(0)

  // --- Note sotto la tabella ---
  y += 2
  doc.setFontSize(9)
  const note = []
  if (cop) note.push(`Ore compilate: ${cop.compilate} su ${cop.attese} della fascia di lavoro (${percento(cop.percentuale)}).`)
  if (fattore) note.push('Proiezione: ore registrate finora riportate su tutte le ore di lavoro del mese.')
  if (svr?.usaProiezione) note.push('Scostamento calcolato sulla proiezione a fine mese.')
  if (deleg?.minutiLavoro) {
    note.push(
      `Ore delegabili: ${ore(deleg.minutiDelegabili)} h (${percento(deleg.percentuale)} del lavoro). ` +
        `Domanda "potevi delegarla?" compilata per ${ore(deleg.minutiConRisposta)} h su ${ore(deleg.minutiLavoro)} h.`,
    )
  }
  if (matrice?.conRisposta) {
    const q = (k) => `${ore(matrice[k])} h (${percento((matrice[k] / matrice.conRisposta) * 100)})`
    note.push(
      `Urgente/Importante: urgente e importante ${q('fare')}; importante non urgente ${q('pianificare')}; ` +
        `urgente non importante ${q('delegare')}; né urgente né importante ${q('eliminare')}.`,
    )
  }
  if (allin?.media != null) {
    note.push(
      `In linea con l'obiettivo: media ${allin.media.toLocaleString('it-IT', { maximumFractionDigits: 1 })} su 5 ` +
        `(su ${ore(allin.minutiConVoto)} h con voto).`,
    )
  }
  for (const t of note) {
    nuovaPaginaSeServe(6)
    doc.splitTextToSize(t, L).forEach((l) => {
      testo(l, M, y)
      y += 4.5
    })
  }

  // --- Grafico a barre ---
  const conOre = r.righe.filter((x) => x.minuti > 0)
  if (conOre.length) {
    y += 6
    nuovaPaginaSeServe(14 + conOre.length * 8)
    doc.setFont('helvetica', 'bold').setFontSize(11)
    testo('Dove va il tempo', M, y)
    y += 6
    doc.setFont('helvetica', 'normal').setFontSize(8.5)
    const max = Math.max(...conOre.map((x) => x.minuti))
    const xBarra = M + 62
    const lBarra = L - 62 - 22
    for (const x of conOre) {
      testo(doc.splitTextToSize(x.categoria.nome, 58)[0], M, y + 3.2)
      doc.setFillColor(...rgb(x.categoria.colore))
      doc.rect(xBarra, y, Math.max(0.8, (x.minuti / max) * lBarra), 4.4, 'F')
      testo(`${ore(x.minuti)} h`, xBarra + (x.minuti / max) * lBarra + 2, y + 3.2)
      y += 7
    }
  }

  // --- Piè di pagina ---
  const pagine = doc.getNumberOfPages()
  for (let i = 1; i <= pagine; i++) {
    doc.setPage(i)
    doc.setFontSize(8).setTextColor(130)
    testo(`Generato il ${new Date().toLocaleString('it-IT')} · pagina ${i}/${pagine}`, M, 290)
  }
  return doc.output('blob')
}

// ---- Condivisione -------------------------------------------------------

/**
 * Sul telefono apre il menu "Condividi" con il file allegato.
 * Dove non è possibile (computer) scarica il file.
 */
export async function condividiOScarica(blob, nomeFile, titolo) {
  const file = new File([blob], nomeFile, { type: blob.type })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: titolo })
      return 'condiviso'
    } catch (e) {
      if (e.name === 'AbortError') return 'annullato'
      // altrimenti proviamo a scaricarlo
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeFile
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return 'scaricato'
}

/** Nome file senza caratteri strani: "tempo_novembre-2026.pdf" */
export const nomeFile = (etichetta, est) =>
  `tempo_${etichetta
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}.${est}`
