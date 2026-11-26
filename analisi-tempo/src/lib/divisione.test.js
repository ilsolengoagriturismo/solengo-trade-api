import { describe, it, expect } from 'vitest'
import { aggiungi, cambia, resto, rimuovi, totale, rimanenti, daSalvare, percentualeOra } from './divisione.js'

describe("dividi l'ora a blocchi di 5 minuti", () => {
  it('ogni tocco aggiunge 5 minuti, anche a più attività', () => {
    let s = []
    s = aggiungi(s, 'telefono')
    s = aggiungi(s, 'supervisione')
    s = aggiungi(s, 'supervisione')
    s = aggiungi(s, 'viaggi')
    expect(s).toEqual([
      { categoria_id: 'telefono', minuti: 5 },
      { categoria_id: 'supervisione', minuti: 10 },
      { categoria_id: 'viaggi', minuti: 5 },
    ])
    expect(rimanenti(s)).toBe(40)
  })

  it('"il resto qui" completa l\'ora', () => {
    let s = [{ categoria_id: 'a', minuti: 10 }, { categoria_id: 'b', minuti: 5 }]
    s = resto(s, 'a')
    expect(totale(s)).toBe(60)
    expect(s[0].minuti).toBe(55)
  })

  it('non supera mai i 60 minuti', () => {
    let s = [{ categoria_id: 'a', minuti: 55 }]
    s = aggiungi(s, 'a')
    s = aggiungi(s, 'a')
    expect(totale(s)).toBe(60)
    s = cambia(s, 'a', +5)
    expect(totale(s)).toBe(60)
    s = aggiungi(s, 'b') // ora piena: b entra con 0
    expect(s.find((x) => x.categoria_id === 'b').minuti).toBe(0)
  })

  it('meno e rimozione; le attività a 0 non si salvano', () => {
    let s = [{ categoria_id: 'a', minuti: 5 }, { categoria_id: 'b', minuti: 20 }]
    s = cambia(s, 'a', -5)
    expect(s[0].minuti).toBe(0)
    s = cambia(s, 'a', -5)
    expect(s[0].minuti).toBe(0) // mai negativo
    expect(daSalvare(s)).toEqual([{ categoria_id: 'b', minuti: 20 }])
    expect(rimuovi(s, 'b')).toEqual([{ categoria_id: 'a', minuti: 0 }])
  })

  it('percentuale della singola ora', () => {
    expect(percentualeOra(15)).toBe('25%')
    expect(percentualeOra(10)).toBe('17%')
  })
})
