// =====================================================================
// "Dividi l'ora": quante attività vuoi, a blocchi di 5 minuti.
// La selezione è una lista [{ categoria_id, minuti }] il cui totale
// non supera mai 60. Funzioni "pure": restituiscono una nuova lista.
// =====================================================================

export const PASSO = 5
export const ORA = 60

export const totale = (sel) => sel.reduce((s, x) => s + x.minuti, 0)
export const rimanenti = (sel) => ORA - totale(sel)

/** Tocco su un'attività: +5′ (se è nuova la aggiunge con 5′). */
export function aggiungi(sel, categoriaId) {
  const resto = rimanenti(sel)
  const passo = Math.min(PASSO, resto)
  if (sel.some((x) => x.categoria_id === categoriaId)) {
    return sel.map((x) => (x.categoria_id === categoriaId ? { ...x, minuti: x.minuti + passo } : x))
  }
  return [...sel, { categoria_id: categoriaId, minuti: passo }]
}

/** Pulsanti − / +: cambia di ±5′ restando tra 0 e il massimo possibile. */
export function cambia(sel, categoriaId, delta) {
  const resto = rimanenti(sel)
  return sel.map((x) => {
    if (x.categoria_id !== categoriaId) return x
    const nuovo = Math.max(0, Math.min(x.minuti + delta, x.minuti + resto))
    return { ...x, minuti: nuovo }
  })
}

/** "Il resto qui": assegna a questa attività tutti i minuti che mancano. */
export function resto(sel, categoriaId) {
  const r = rimanenti(sel)
  return sel.map((x) => (x.categoria_id === categoriaId ? { ...x, minuti: x.minuti + r } : x))
}

export const rimuovi = (sel, categoriaId) => sel.filter((x) => x.categoria_id !== categoriaId)

/** Voci da salvare: solo quelle con almeno 1 minuto. */
export const daSalvare = (sel) => sel.filter((x) => x.minuti > 0)

/** "25%" della singola ora */
export const percentualeOra = (minuti) => `${Math.round((minuti / ORA) * 100)}%`
