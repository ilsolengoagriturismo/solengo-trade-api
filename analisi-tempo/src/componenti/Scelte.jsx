// Piccoli pulsanti riutilizzati in più schermate.

/** Gruppo di pulsanti dove se ne sceglie uno (ritoccarlo lo deseleziona). */
export function Pillole({ opzioni, valore, onCambia, etichetta }) {
  return (
    <div className="pillole" role="group" aria-label={etichetta}>
      {opzioni.map((o) => (
        <button
          type="button"
          key={String(o.valore)}
          className={valore === o.valore ? 'scelta' : ''}
          onClick={() => onCambia(valore === o.valore ? null : o.valore)}
        >
          {o.testo}
        </button>
      ))}
    </div>
  )
}

export const OPZIONI_DELEGA = [
  { valore: true, testo: 'Sì' },
  { valore: false, testo: 'No' },
]

export const OPZIONI_ENERGIA = [
  { valore: 1, testo: '🔋 Bassa' },
  { valore: 2, testo: 'Media' },
  { valore: 3, testo: '⚡ Alta' },
]

export const OPZIONI_MINUTI = [15, 30, 45, 60].map((m) => ({ valore: m, testo: `${m}′` }))
