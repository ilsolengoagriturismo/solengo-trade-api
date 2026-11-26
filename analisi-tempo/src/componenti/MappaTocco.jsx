// =====================================================================
// MAPPA A TOCCO
// Un tocco nel quadrato = due risposte insieme:
//   orizzontale → quanto era URGENTE
//   verticale   → quanto era IN LINEA CON L'OBIETTIVO
// Ogni attività dell'ora ha il suo colore. Sopra la mappa scegli quale
// attività stai piazzando (si passa da sola alla successiva); per
// correggerne una, selezionala e tocca di nuovo.
// =====================================================================
import { useState } from 'react'
import * as archivio from '../lib/archivio.js'
import { campiDaTocco, posizione, piazzata } from '../lib/mappa.js'

/**
 * @param voci       attività dell'ora [{ id, categoria_id, minuti, urgenza, allineamento }]
 * @param onPiazza   (voce, campi) => void   campi = { urgenza, allineamento, urgente, importante, delegabile }
 */
export default function MappaTocco({ voci, onPiazza }) {
  const primaDaPiazzare = voci.find((v) => !piazzata(v)) ?? voci[0]
  const [sceltaId, setSceltaId] = useState(primaDaPiazzare?.id)
  const scelta = voci.find((v) => v.id === sceltaId) ?? primaDaPiazzare
  if (!scelta) return null

  function tocco(e) {
    const r = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    onPiazza(scelta, campiDaTocco(x, y))
    navigator.vibrate?.(10)
    // passo alla prossima attività ancora da piazzare
    const prossima = voci.find((v) => v.id !== scelta.id && !piazzata(v))
    if (prossima) setSceltaId(prossima.id)
  }

  const nome = (v) => archivio.categoriaPerId(v.categoria_id)?.nome ?? '?'
  const colore = (v) => archivio.categoriaPerId(v.categoria_id)?.colore ?? '#64748b'

  return (
    <div className="mappa-tocco">
      {voci.length > 1 && (
        <div className="mappa-scelte">
          {voci.map((v) => (
            <button
              key={v.id}
              type="button"
              className={v.id === scelta.id ? 'scelta' : ''}
              style={{ '--colore': colore(v) }}
              onClick={() => setSceltaId(v.id)}
            >
              <span className="pallino" />
              {nome(v)} {v.minuti}′{piazzata(v) ? ' ✓' : ''}
            </button>
          ))}
        </div>
      )}
      <p className="mappa-istruzione">
        Tocca dove metti <b style={{ color: colore(scelta) }}>{nome(scelta)}</b>
      </p>

      <div className="mappa-cornice">
        <span className="mappa-asse-y">In linea con l'obiettivo ↑</span>
        <div
          className="mappa"
          role="button"
          tabIndex={0}
          aria-label={`Piazza ${nome(scelta)}: a destra più urgente, in alto più in linea con l'obiettivo`}
          onPointerUp={tocco}
        >
          <span className="q q-pianificare">Pianificare</span>
          <span className="q q-fare">Fare subito</span>
          <span className="q q-eliminare">Eliminare</span>
          <span className="q q-delegare">Delegare</span>
          {voci.filter(piazzata).map((v) => {
            const p = posizione(Number(v.urgenza), Number(v.allineamento))
            return (
              <span
                key={v.id}
                className={'mappa-punto' + (v.id === scelta.id ? ' attivo' : '')}
                style={{ left: `${p.sinistra}%`, top: `${p.alto}%`, '--colore': colore(v) }}
                title={nome(v)}
              >
                {nome(v).slice(0, 1)}
              </span>
            )
          })}
        </div>
        <span className="mappa-asse-x">Urgenza →</span>
      </div>
    </div>
  )
}
