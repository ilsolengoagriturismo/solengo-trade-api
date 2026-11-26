import { describe, it, expect } from 'vitest'
import { daTocco, posizione, campiDaTocco, riquadro, piazzata } from './mappa.js'

describe('mappa a tocco', () => {
  it('angoli e centro', () => {
    expect(daTocco(0, 0)).toEqual({ urgenza: 1, allineamento: 5 }) // in alto a sinistra
    expect(daTocco(1, 1)).toEqual({ urgenza: 5, allineamento: 1 }) // in basso a destra
    expect(daTocco(0.5, 0.5)).toEqual({ urgenza: 3, allineamento: 3 })
  })
  it('valori con un decimale e mai fuori scala', () => {
    expect(daTocco(0.8371, 0.21)).toEqual({ urgenza: 4.3, allineamento: 4.2 })
    expect(daTocco(1.3, -0.2)).toEqual({ urgenza: 5, allineamento: 5 })
  })
  it('andata e ritorno: la posizione del pallino corrisponde al tocco', () => {
    const p = posizione(4.2, 1.8)
    expect(p.sinistra).toBeCloseTo(80)
    expect(p.alto).toBeCloseTo(80)
  })
  it('in basso a destra = urgente, non importante, delegabile', () => {
    expect(campiDaTocco(0.9, 0.9)).toMatchObject({ urgente: true, importante: false, delegabile: true })
    expect(campiDaTocco(0.9, 0.1)).toMatchObject({ urgente: true, importante: true, delegabile: false })
    expect(campiDaTocco(0.1, 0.9)).toMatchObject({ urgente: false, importante: false, delegabile: false })
  })
  it('riquadri e voce piazzata', () => {
    expect(riquadro(4, 4)).toBe('fare')
    expect(riquadro(2, 4)).toBe('pianificare')
    expect(riquadro(4, 2)).toBe('delegare')
    expect(riquadro(2, 2)).toBe('eliminare')
    expect(piazzata({ urgenza: 2, allineamento: 4 })).toBe(true)
    expect(piazzata({ urgenza: null, allineamento: 4 })).toBe(false)
  })
})
