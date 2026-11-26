// =====================================================================
// Mappa a tocco: dalla posizione del dito ai valori, e viceversa.
//   orizzontale → urgenza       1,0 (sinistra, poco) … 5,0 (destra, molto)
//   verticale   → allineamento  1,0 (in basso)      … 5,0 (in alto)
// Il centro (3,0) divide i quattro riquadri.
// =====================================================================

export const MIN = 1
export const MAX = 5
export const CENTRO = 3

const arrotonda = (n) => Math.round(n * 10) / 10
const limita = (n) => Math.min(MAX, Math.max(MIN, n))

/**
 * Tocco → valori. x e y sono frazioni 0..1 dentro il quadrato
 * (x da sinistra, y dall'alto, come sullo schermo).
 */
export function daTocco(x, y) {
  return {
    urgenza: arrotonda(limita(MIN + x * (MAX - MIN))),
    allineamento: arrotonda(limita(MAX - y * (MAX - MIN))),
  }
}

/** Valori → posizione in percentuale dentro il quadrato (per disegnare il pallino). */
export function posizione(urgenza, allineamento) {
  return {
    sinistra: ((urgenza - MIN) / (MAX - MIN)) * 100,
    alto: ((MAX - allineamento) / (MAX - MIN)) * 100,
  }
}

/**
 * Tutti i campi da salvare per un tocco: i due valori continui più i
 * sì/no ricavati dal riquadro (così matrice e "ore delegabili" funzionano).
 */
export function campiDaTocco(x, y) {
  const { urgenza, allineamento } = daTocco(x, y)
  const urgente = urgenza > CENTRO
  const importante = allineamento > CENTRO
  return {
    urgenza,
    allineamento,
    urgente,
    importante,
    delegabile: urgente && !importante, // riquadro in basso a destra
  }
}

/** Nome del riquadro, per le etichette. */
export function riquadro(urgenza, allineamento) {
  const u = urgenza > CENTRO
  const i = allineamento > CENTRO
  if (u && i) return 'fare'
  if (!u && i) return 'pianificare'
  if (u && !i) return 'delegare'
  return 'eliminare'
}

export const piazzata = (voce) => voce.urgenza != null && voce.allineamento != null
