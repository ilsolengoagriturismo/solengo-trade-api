// Cambia schermata senza ricaricare la pagina.
export function vaiA(percorso) {
  window.history.pushState({}, '', percorso)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
