import { describe, it, expect } from 'vitest'
import {
  periodo, spostaPeriodo, riepilogo, oreFascia, fattoreProiezione, copertura, ore,
  stimaVsReale, delegabili, conSegno,
} from './report.js'

const fascia = Object.fromEntries(
  [0, 1, 2, 3, 4, 5, 6].map((g) => [String(g), { attivo: true, inizio: 8, fine: 23 }]),
)
const cat = (id, ordine, lavoro = true) => ({ id, nome: id, ordine, lavoro, attiva: true })
const categorie = [cat('A', 1), cat('B', 2), cat('P', 9, false)]

describe('periodi', () => {
  it('la settimana parte dal lunedì', () => {
    const p = periodo('settimana', new Date(2026, 10, 26)) // giovedì
    expect(p.da.getDate()).toBe(23)
    expect(p.a.getDate()).toBe(30)
  })
  it('mese e spostamento', () => {
    const p = periodo('mese', new Date(2026, 10, 26))
    expect([p.da.getMonth(), p.a.getMonth()]).toEqual([10, 11])
    expect(spostaPeriodo('mese', new Date(2026, 11, 31), 1).getMonth()).toBe(0)
  })
})

describe('riepilogo', () => {
  const righe = [
    { categoria_id: 'A', minuti: 60, delegabile: true },
    { categoria_id: 'A', minuti: 30, delegabile: false, sottocategoria_id: 's1' },
    { categoria_id: 'B', minuti: 30 },
    { categoria_id: 'P', minuti: 60, delegabile: true },
  ]
  const r = riepilogo(righe, categorie)
  it('pausa esclusa dal totale lavoro e dalle %', () => {
    expect(r.minutiLavoro).toBe(120)
    expect(r.minutiNonLavoro).toBe(60)
    expect(r.righe.find((x) => x.categoria.id === 'A').percentuale).toBe(75)
    expect(r.righe.find((x) => x.categoria.id === 'P').percentuale).toBeNull()
  })
  it('delegabili solo sulle ore di lavoro', () => {
    expect(r.minutiDelegabili).toBe(60)
  })
  it('sottocategorie', () => {
    const a = r.righe.find((x) => x.categoria.id === 'A')
    expect(a.sotto).toEqual([{ id: null, minuti: 60 }, { id: 's1', minuti: 30 }])
  })
  it('formato ore all\'italiana', () => {
    expect(ore(90)).toBe('1,5')
    expect(ore(120)).toBe('2')
  })
})

describe('proiezione e copertura', () => {
  const da = new Date(2026, 10, 1)
  const a = new Date(2026, 11, 1)
  it('ore di fascia di novembre: 30 giorni × 15 ore', () => {
    expect(oreFascia(fascia, da, a)).toBe(450)
  })
  it('a metà mese il fattore è circa 2', () => {
    const f = fattoreProiezione(fascia, da, a, new Date(2026, 10, 16, 0, 0))
    expect(f).toBe(2)
  })
  it('nessuna proiezione per i mesi passati', () => {
    expect(fattoreProiezione(fascia, da, a, new Date(2026, 11, 5))).toBeNull()
  })
  it('copertura: 2 ore compilate su 3 attese', () => {
    const righe = [
      { ora_inizio: new Date(2026, 10, 26, 8).toISOString() },
      { ora_inizio: new Date(2026, 10, 26, 8).toISOString() }, // ora divisa: conta una volta
      { ora_inizio: new Date(2026, 10, 26, 10).toISOString() },
    ]
    const c = copertura(righe, fascia, new Date(2026, 10, 26), new Date(2026, 10, 27), new Date(2026, 10, 26, 11, 5))
    expect([c.compilate, c.attese]).toEqual([2, 3])
  })
})

describe('stima vs reale', () => {
  const cats = [
    { id: 'A', ordine: 1, lavoro: true, attiva: true, ore_stimate_mese: 140 },
    { id: 'B', ordine: 2, lavoro: true, attiva: true, ore_stimate_mese: '28.0' }, // dal db arriva come testo
    { id: 'P', ordine: 9, lavoro: false, attiva: true, ore_stimate_mese: null },
  ]
  const r = riepilogo(
    [
      { categoria_id: 'A', minuti: 60 * 70 },
      { categoria_id: 'B', minuti: 60 * 20 },
      { categoria_id: 'P', minuti: 600 },
    ],
    cats,
  )
  it('mese passato: confronta con il reale', () => {
    const s = stimaVsReale(r.righe)
    expect(s.righe.map((x) => [x.stima, x.valore, x.scostamento])).toEqual([[140, 70, -70], [28, 20, -8]])
    expect(s.totale.stima).toBe(168)
    expect(s.righe.length).toBe(2) // la pausa non c'è
  })
  it('mese in corso: confronta con la proiezione', () => {
    const s = stimaVsReale(r.righe, 2)
    expect(s.righe[0].valore).toBe(140)
    expect(s.righe[0].scostamento).toBe(0)
    expect(s.usaProiezione).toBe(true)
  })
  it('delegabili e segni', () => {
    const d = delegabili(
      [
        { categoria_id: 'A', minuti: 60, delegabile: true },
        { categoria_id: 'A', minuti: 60, delegabile: false },
        { categoria_id: 'B', minuti: 60, delegabile: null },
        { categoria_id: 'P', minuti: 60, delegabile: true },
      ],
      cats,
    )
    expect([d.minutiLavoro, d.minutiDelegabili, d.minutiConRisposta]).toEqual([180, 60, 120])
    expect(conSegno(12.5)).toBe('+12,5')
    expect(conSegno(-3)).toBe('−3')
    expect(conSegno(0)).toBe('0')
  })
})
