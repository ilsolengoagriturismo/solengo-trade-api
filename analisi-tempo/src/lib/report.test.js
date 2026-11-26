import { describe, it, expect } from 'vitest'
import {
  periodo, spostaPeriodo, riepilogo, oreFascia, fattoreProiezione, copertura, ore,
  stimaVsReale, delegabili, conSegno, matriceUrgenteImportante, allineamentoObiettivo, bolleMappa,
  concentrazione, frasiChiave, oreMigliori, tempoEnergia, energiaComeRighe,
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

describe('urgente / importante e obiettivo', () => {
  const cats = [
    { id: 'A', lavoro: true },
    { id: 'P', lavoro: false },
  ]
  const righe = [
    { categoria_id: 'A', minuti: 30, urgente: true, importante: true, allineamento: 5 },
    { categoria_id: 'A', minuti: 20, urgente: false, importante: true, allineamento: 4 },
    { categoria_id: 'A', minuti: 10, urgente: true, importante: false, allineamento: 1 },
    { categoria_id: 'A', minuti: 60, urgente: false, importante: false },
    { categoria_id: 'A', minuti: 40, urgente: true }, // manca "importante"
    { categoria_id: 'P', minuti: 60, urgente: true, importante: true, allineamento: 5 }, // pausa: esclusa
  ]
  it('matrice: 4 quadranti + senza risposta, pausa esclusa', () => {
    const m = matriceUrgenteImportante(righe, cats)
    expect(m).toEqual({ fare: 30, pianificare: 20, delegare: 10, eliminare: 60, senzaRisposta: 40, conRisposta: 120 })
  })
  it('allineamento: media pesata sui minuti', () => {
    const a = allineamentoObiettivo(righe, cats)
    expect(a.minutiConVoto).toBe(60)
    expect(a.media).toBeCloseTo((30 * 5 + 20 * 4 + 10 * 1) / 60) // 4,0
    expect(a.perVoto).toEqual({ 1: 10, 2: 0, 3: 0, 4: 20, 5: 30 })
  })
  it('nessun voto → media assente', () => {
    expect(allineamentoObiettivo([], cats).media).toBeNull()
  })
})

describe('mappa a tocco nel report', () => {
  const cats = [
    { id: 'S', lavoro: true },
    { id: 'T', lavoro: true },
  ]
  const righe = [
    { categoria_id: 'S', minuti: 40, urgenza: 4.5, allineamento: 1.5 },
    { categoria_id: 'S', minuti: 20, urgenza: 3.0, allineamento: 4.5 },
    { categoria_id: 'T', minuti: 10, urgenza: 2.0, allineamento: 3.6 },
    { categoria_id: 'T', minuti: 50 }, // non piazzata
  ]
  it('matrice dai valori della mappa (centro 3 = non urgente / non importante)', () => {
    const m = matriceUrgenteImportante(righe, cats)
    expect(m).toMatchObject({ fare: 0, pianificare: 30, delegare: 40, eliminare: 0, senzaRisposta: 50 })
  })
  it('allineamento con decimali arrotondato per il grafico', () => {
    const a = allineamentoObiettivo(righe, cats)
    expect(a.perVoto).toEqual({ 1: 0, 2: 40, 3: 0, 4: 10, 5: 20 })
    expect(a.media).toBeCloseTo((40 * 1.5 + 20 * 4.5 + 10 * 3.6) / 70)
  })
  it('bolle: media pesata per categoria, ordinate dalla più grande', () => {
    const b = bolleMappa(righe, cats)
    expect(b.map((x) => x.categoria.id)).toEqual(['S', 'T'])
    expect(b[0].minuti).toBe(60)
    expect(b[0].urgenza).toBeCloseTo(4)
    expect(b[0].allineamento).toBeCloseTo(2.5)
    expect(b[1].minuti).toBe(10) // solo la parte piazzata
  })
})

describe('concentrazione e frasi chiave', () => {
  const cats = [
    { id: 'A', codice: 1, nome: 'Lavoro autonomo', lavoro: true, attiva: true, ordine: 1, ore_stimate_mese: 140 },
    { id: 'T', codice: 2, nome: 'Telefono', lavoro: true, attiva: true, ordine: 2, ore_stimate_mese: 28 },
    { id: 'S', codice: 4, nome: 'Supervisione', lavoro: true, attiva: true, ordine: 4 },
  ]
  const h = (ora) => new Date(2026, 10, 26, ora).toISOString()
  const righe = [
    // 8-10 blocco di lavoro autonomo (2 ore pulite di fila)
    { ora_inizio: h(8), categoria_id: 'A', minuti: 60 },
    { ora_inizio: h(9), categoria_id: 'A', minuti: 60 },
    // 10 spezzata in 3
    { ora_inizio: h(10), categoria_id: 'A', minuti: 20 },
    { ora_inizio: h(10), categoria_id: 'T', minuti: 20 },
    { ora_inizio: h(10), categoria_id: 'S', minuti: 20, delegabile: true },
    // 11 sola supervisione delegabile
    { ora_inizio: h(11), categoria_id: 'S', minuti: 60, delegabile: true },
    // 13 un'ora di autonomo isolata: non è un blocco
    { ora_inizio: h(13), categoria_id: 'A', minuti: 60 },
    { ora_inizio: h(14), categoria_id: 'T', minuti: 60 },
  ]
  it('ore pulite, spezzate e blocchi di lavoro autonomo', () => {
    expect(concentrazione(righe, cats)).toEqual({ oreRegistrate: 6, pulite: 5, spezzate: 1, blocchi: 1, oreInBlocchi: 2 })
  })
  it('due blocchi separati', () => {
    const due = [8, 9, 12, 13, 14].map((o) => ({ ora_inizio: h(o), categoria_id: 'A', minuti: 60 }))
    expect(concentrazione(due, cats)).toMatchObject({ blocchi: 2, oreInBlocchi: 5 })
  })
  it('frasi: voce principale, delegabili in euro, concentrazione', () => {
    const r = riepilogo(righe, cats)
    const f = frasiChiave({
      r,
      deleg: delegabili(righe, cats),
      matrice: matriceUrgenteImportante(righe, cats),
      allin: allineamentoObiettivo(righe, cats),
      svr: null,
      conc: concentrazione(righe, cats),
      valoreOra: 60,
    })
    expect(f[0]).toContain('«Lavoro autonomo»: 3,3 h')
    expect(f[1]).toContain('Ore delegabili: 1,3 h')
    expect(f[1]).toContain('80') // 1,33 h × 60 € = 80 €
    expect(f[2]).toContain('Blocchi di lavoro autonomo da 2+ ore: 1')
  })
})

describe('ore migliori', () => {
  const h = (g, ora) => new Date(2026, 10, g, ora).toISOString()
  it('trova la fascia di 2 ore con più energia', () => {
    const righe = []
    for (const g of [24, 25]) {
      righe.push({ ora_inizio: h(g, 6), minuti: 60, energia: 3 })
      righe.push({ ora_inizio: h(g, 7), minuti: 60, energia: 3 })
      righe.push({ ora_inizio: h(g, 14), minuti: 60, energia: 1 })
      righe.push({ ora_inizio: h(g, 15), minuti: 60, energia: 2 })
    }
    righe.push({ ora_inizio: h(24, 20), minuti: 60, energia: 3 }) // una sola volta: ignorata
    const o = oreMigliori(righe)
    expect(o.migliore).toEqual({ da: 6, a: 8, media: 3 })
    expect(o.ore.map((x) => x.ora)).toEqual([6, 7, 14, 15])
  })
})

describe('tempo × energia (Esydo)', () => {
  const cats = [
    { id: 'A', nome: 'Lavoro autonomo' },
    { id: 'S', nome: 'Supervisione' },
  ]
  const h = (ora) => new Date(2026, 10, 26, ora).toISOString()
  const righe = [
    { ora_inizio: h(7), categoria_id: 'A', minuti: 60 },
    { ora_inizio: h(8), categoria_id: 'A', minuti: 60 },
    { ora_inizio: h(14), categoria_id: 'S', minuti: 40 },
    { ora_inizio: h(14), categoria_id: 'A', minuti: 20 },
    { ora_inizio: h(15), categoria_id: 'S', minuti: 60 }, // senza misura: ignorata
  ]
  const energia = [
    { ora: h(7), escore: 80 },
    { ora: h(8), escore: 70 },
    { ora: h(14), escore: 40 },
  ]
  it('media per attività e differenza dalla media generale', () => {
    const t = tempoEnergia(righe, energia, cats)
    expect(t.minutiConEnergia).toBe(180)
    expect(t.media).toBeCloseTo((80 * 60 + 70 * 60 + 40 * 60) / 180) // 63,3
    expect(t.righe[0].categoria.id).toBe('A') // la più "energica" in cima
    expect(t.righe[0].media).toBeCloseTo((80 * 60 + 70 * 60 + 40 * 20) / 140)
    expect(t.righe[1].media).toBe(40)
    expect(t.righe[1].differenza).toBeLessThan(0)
  })
  it('senza dati Esydo: niente media', () => {
    expect(tempoEnergia(righe, [], cats)).toEqual({ media: null, minutiConEnergia: 0, righe: [] })
  })
  it('le letture Esydo alimentano anche "le tue ore migliori"', () => {
    const giorni = [24, 25].flatMap((g) => [
      { ora: new Date(2026, 10, g, 6).toISOString(), escore: 80 },
      { ora: new Date(2026, 10, g, 7).toISOString(), escore: 78 },
      { ora: new Date(2026, 10, g, 15).toISOString(), escore: 40 },
    ])
    const o = oreMigliori(energiaComeRighe(giorni))
    expect(o.migliore).toMatchObject({ da: 6, a: 8 })
  })
})
