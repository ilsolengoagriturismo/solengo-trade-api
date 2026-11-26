// Test automatici dei calcoli sulle ore: si lanciano con "npm test".
import { describe, it, expect } from 'vitest'
import { oreMancanti, ultimaOraConclusa, chiaveOra, inFascia, oreDelGiorno } from './ore.js'

process.env.TZ = 'Europe/Rome'

const fascia = Object.fromEntries(
  [0, 1, 2, 3, 4, 5, 6].map((g) => [String(g), { attivo: true, inizio: 8, fine: 23 }]),
)

describe('ore', () => {
  it("l'ultima ora conclusa alle 14:05 è 13:00", () => {
    const u = ultimaOraConclusa(new Date(2026, 10, 26, 14, 5))
    expect(u.getHours()).toBe(13)
  })

  it('la fascia 8–23 include 8:00 e 22:00 ma non 23:00 e 7:00', () => {
    expect(inFascia(fascia, new Date(2026, 10, 26, 8))).toBe(true)
    expect(inFascia(fascia, new Date(2026, 10, 26, 22))).toBe(true)
    expect(inFascia(fascia, new Date(2026, 10, 26, 23))).toBe(false)
    expect(inFascia(fascia, new Date(2026, 10, 26, 7))).toBe(false)
  })

  it('primo utilizzo: propone solo le ore di oggi nella fascia', () => {
    const m = oreMancanti(fascia, new Set(), new Date(2026, 10, 26, 11, 10))
    expect(m.map((d) => d.getHours())).toEqual([8, 9, 10])
  })

  it("si ferma all'ultima ora registrata, anche di ieri, saltando la notte", () => {
    const registrate = new Set([chiaveOra(new Date(2026, 10, 25, 21))])
    const m = oreMancanti(fascia, registrate, new Date(2026, 10, 26, 9, 2))
    expect(m.map((d) => `${d.getDate()} ${d.getHours()}`)).toEqual(['25 22', '26 8'])
  })

  it('nessuna ora mancante se l\'ultima ora è registrata', () => {
    const registrate = new Set([chiaveOra(new Date(2026, 10, 26, 13))])
    expect(oreMancanti(fascia, registrate, new Date(2026, 10, 26, 14, 1))).toEqual([])
  })

  it('giorni di riposo esclusi', () => {
    const conRiposo = { ...fascia, '1': { attivo: false, inizio: 8, fine: 23 } } // lunedì
    // lunedì 23/11 alle 12, ultima registrazione domenica 22/11 alle 22
    const registrate = new Set([chiaveOra(new Date(2026, 10, 22, 22))])
    const m = oreMancanti(conRiposo, registrate, new Date(2026, 10, 23, 12, 0), 48)
    expect(m).toEqual([]) // il lunedì è di riposo
  })

  it('cambio ora legale: il 29 marzo 2026 ha 23 ore, il 25 ottobre 25', () => {
    expect(oreDelGiorno(new Date(2026, 2, 29)).length).toBe(23)
    expect(oreDelGiorno(new Date(2026, 9, 25)).length).toBe(25)
  })
})
