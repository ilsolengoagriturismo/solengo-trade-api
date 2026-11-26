// Collega React all'archivio: il componente si ridisegna a ogni modifica.
import { useSyncExternalStore } from 'react'
import { ascolta, leggiVersione, leggiStato } from './archivio.js'

export function usaArchivio() {
  useSyncExternalStore(ascolta, leggiVersione)
  return leggiStato()
}

/** "1 h 30", "45 min", "3 h" */
export function formatoMinuti(min) {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h === 0) return `${m} min`
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
}
