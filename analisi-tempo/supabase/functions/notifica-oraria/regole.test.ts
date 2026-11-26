// Test delle regole di invio (si lanciano con "npm test").
import { describe, it, expect } from 'vitest'
import { oraDaChiedere, deveNotificare, testoNotifica } from './index.ts'

const fascia = Object.fromEntries(
  [0, 1, 2, 3, 4, 5, 6].map((g) => [String(g), { attivo: true, inizio: 8, fine: 23 }]),
)
const base = {
  user_id: 'u',
  fuso_orario: 'Europe/Rome',
  fascia,
  notifiche_attive: true,
  notifiche_pausa_il: null as string | null,
}
// L'orologio del database lavora in UTC: in inverno Roma = UTC+1, in estate UTC+2.
const alle = (iso: string) => new Date(iso)

describe('notifiche orarie', () => {
  it('alle 14:00 di Roma (inverno) chiede 13:00–14:00', () => {
    const o = oraDaChiedere(alle('2026-11-26T13:00:30Z'), 'Europe/Rome')
    expect(o.ora).toBe(13)
    expect(o.data).toBe('2026-11-26')
    expect(o.inizio.toISOString()).toBe('2026-11-26T12:00:00.000Z')
  })

  it('in estate tiene conto dell\'ora legale', () => {
    expect(oraDaChiedere(alle('2026-07-10T12:00:10Z'), 'Europe/Rome').ora).toBe(13)
  })

  it('fascia 8–23: la prima notifica è alle 9:00, l\'ultima alle 23:00', () => {
    // ore 9:00 Roma = 08:00Z → chiede 8–9
    expect(deveNotificare(base, alle('2026-11-26T08:00:00Z'))).toBe(true)
    // ore 8:00 Roma → chiederebbe 7–8, fuori fascia
    expect(deveNotificare(base, alle('2026-11-26T07:00:00Z'))).toBe(false)
    // ore 23:00 Roma → chiede 22–23
    expect(deveNotificare(base, alle('2026-11-26T22:00:00Z'))).toBe(true)
    // mezzanotte → chiederebbe 23–24, fuori fascia
    expect(deveNotificare(base, alle('2026-11-26T23:00:00Z'))).toBe(false)
  })

  it('pausa per oggi e notifiche spente', () => {
    expect(deveNotificare({ ...base, notifiche_pausa_il: '2026-11-26' }, alle('2026-11-26T12:00:00Z'))).toBe(false)
    expect(deveNotificare({ ...base, notifiche_pausa_il: '2026-11-25' }, alle('2026-11-26T12:00:00Z'))).toBe(true)
    expect(deveNotificare({ ...base, notifiche_attive: false }, alle('2026-11-26T12:00:00Z'))).toBe(false)
  })

  it('giorno di riposo (lunedì)', () => {
    const riposo = { ...base, fascia: { ...fascia, '1': { attivo: false, inizio: 8, fine: 23 } } }
    expect(deveNotificare(riposo, alle('2026-11-23T12:00:00Z'))).toBe(false) // lunedì
    expect(deveNotificare(riposo, alle('2026-11-24T12:00:00Z'))).toBe(true) // martedì
  })

  it('testo della notifica', () => {
    expect(testoNotifica(13).titolo).toBe('13:00 – 14:00')
    expect(testoNotifica(23).titolo).toBe('23:00 – 00:00')
  })
})
