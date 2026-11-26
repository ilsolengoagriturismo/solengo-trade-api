// =====================================================================
// Domande facoltative su UNA attività:
//   Potevi delegarla?   sì / no
//   Urgente?            sì / no
//   Importante?         sì / no
//   In linea con l'obiettivo principale?   1 … 5
// Usato dopo il salvataggio (Registra) e nella modifica dell'ora (Giornata).
// =====================================================================
import { Pillole, OPZIONI_DELEGA } from './Scelte.jsx'

const SI_NO = OPZIONI_DELEGA // [{ true, 'Sì' }, { false, 'No' }]
export const OPZIONI_ALLINEAMENTO = [1, 2, 3, 4, 5].map((n) => ({ valore: n, testo: String(n) }))

/**
 * @param voce       la registrazione ({ delegabile, urgente, importante, allineamento })
 * @param onCambia   (campo, valore) => void
 * @param titolo     facoltativo: nome dell'attività (quando l'ora è divisa)
 */
export default function DomandeAttivita({ voce, onCambia, titolo }) {
  return (
    <div className="domande-attivita">
      {titolo && <div className="domande-titolo">{titolo}</div>}
      <div className="domande-griglia">
        <span>Delegabile?</span>
        <Pillole opzioni={SI_NO} valore={voce.delegabile} onCambia={(v) => onCambia('delegabile', v)} />
        <span>Urgente?</span>
        <Pillole opzioni={SI_NO} valore={voce.urgente} onCambia={(v) => onCambia('urgente', v)} />
        <span>Importante?</span>
        <Pillole opzioni={SI_NO} valore={voce.importante} onCambia={(v) => onCambia('importante', v)} />
        <span>Obiettivo 1–5</span>
        <Pillole
          etichetta="In linea con l'obiettivo principale, da 1 a 5"
          opzioni={OPZIONI_ALLINEAMENTO}
          valore={voce.allineamento}
          onCambia={(v) => onCambia('allineamento', v)}
        />
      </div>
    </div>
  )
}
