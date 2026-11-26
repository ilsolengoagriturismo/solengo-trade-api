import { describe, it, expect } from 'vitest'
import { aderenzaIdeale, blocchiIdeali, periodoAnalisi, daDataISO } from './settimana.js'

const h = (g, ora) => new Date(2026, 10, g, ora).toISOString()

describe('settimana ideale vs reale', () => {
  // lunedì 23/11/2026: 6-8 Lavoro autonomo (A); martedì 24: 15-16 Fornitori (S)
  const ideale = {
    '1': [{ inizio: 6, fine: 8, categoria_id: 'A' }],
    '2': [{ inizio: 15, fine: 16, categoria_id: 'S' }],
    '3': [{ inizio: 9, fine: 9, categoria_id: 'A' }], // blocco vuoto: ignorato
  }
  const righe = [
    { ora_inizio: h(23, 6), categoria_id: 'A', minuti: 60 }, // fatto
    { ora_inizio: h(23, 7), categoria_id: 'A', minuti: 20 }, // in parte
    { ora_inizio: h(23, 7), categoria_id: 'T', minuti: 40 }, // altro: non conta
    { ora_inizio: h(24, 15), categoria_id: 'T', minuti: 60 }, // pianificato S, fatto T
  ]
  const lun = new Date(2026, 10, 23)
  const lunProssimo = new Date(2026, 10, 30)

  it('elenca solo i blocchi validi', () => {
    expect(blocchiIdeali(ideale).length).toBe(2)
  })

  it('percentuale per blocco e totale della settimana', () => {
    const r = aderenzaIdeale(ideale, righe, lun, lunProssimo, new Date(2026, 11, 1))
    expect(r.blocchi.map((b) => [b.giorno, b.pianificati, b.fatti])).toEqual([
      ['1', 120, 80],
      ['2', 60, 0],
    ])
    expect(r.totale).toEqual({ pianificati: 180, fatti: 80, percentuale: (80 / 180) * 100 })
  })

  it('le ore non ancora concluse non si contano', () => {
    // è lunedì alle 7:30: conta solo l'ora 6-7
    const r = aderenzaIdeale(ideale, righe, lun, lunProssimo, new Date(2026, 10, 23, 7, 30))
    expect(r.totale).toEqual({ pianificati: 60, fatti: 60, percentuale: 100 })
  })

  it('su più settimane i blocchi si sommano', () => {
    const r = aderenzaIdeale(ideale, righe, lun, new Date(2026, 11, 7), new Date(2026, 11, 8))
    expect(r.blocchi[0].pianificati).toBe(240) // due lunedì × 2 ore
  })

  it('settimana ideale vuota', () => {
    expect(aderenzaIdeale({}, righe, lun, lunProssimo).totale.percentuale).toBeNull()
  })
})

describe('periodo di analisi', () => {
  it('date ISO e periodo con il giorno finale compreso', () => {
    expect(daDataISO('2026-12-01').getDate()).toBe(1)
    const p = periodoAnalisi('2026-12-01', '2026-12-28')
    expect(p.da.getDate()).toBe(1)
    expect(p.a.getDate()).toBe(29)
    expect(p.etichetta).toContain('dal 1 dic 2026')
  })
  it('periodo mancante o al contrario', () => {
    expect(periodoAnalisi(null, '2026-12-28')).toBeNull()
    expect(periodoAnalisi('2026-12-28', '2026-12-01')).toBeNull()
  })
})
