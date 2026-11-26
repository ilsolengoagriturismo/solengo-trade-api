// =====================================================================
// Modifica completa di un'ora (dalla timeline): più attività, minuti,
// sottocategoria, delegabile, energia, nota.
// =====================================================================
import { useState } from 'react'
import * as archivio from '../lib/archivio.js'
import { usaArchivio } from '../lib/usaArchivio.js'
import { etichettaOra, etichettaGiorno } from '../lib/ore.js'
import { Pillole, OPZIONI_DELEGA, OPZIONI_ENERGIA } from './Scelte.jsx'
import { percentualeOra, PASSO } from '../lib/divisione.js'

export default function EditorOra({ ora, onChiudi }) {
  const stato = usaArchivio()
  const categorie = stato.categorie.filter((c) => c.attiva)
  const [voci, setVoci] = useState(() => archivio.vociOra(ora).map((v) => ({ ...v })))

  const totale = voci.reduce((s, v) => s + v.minuti, 0)

  function cambia(i, campo, valore) {
    setVoci((vv) =>
      vv.map((v, j) => {
        if (j !== i) return v
        const nuova = { ...v, [campo]: valore }
        // cambiando categoria la sottocategoria non vale più
        if (campo === 'categoria_id') nuova.sottocategoria_id = null
        return nuova
      }),
    )
  }

  function aggiungi() {
    const resto = Math.max(PASSO, 60 - totale)
    setVoci((vv) => [...vv, archivio.nuovaVoce(categorie[0].id, Math.min(60, resto))])
  }

  function salva() {
    archivio.impostaOra(ora, voci)
    onChiudi()
  }

  return (
    <div className="foglio-sfondo" onClick={onChiudi}>
      <div className="foglio" onClick={(e) => e.stopPropagation()}>
        <header className="foglio-testa">
          <div>
            <small>{etichettaGiorno(ora)}</small>
            <h2>{etichettaOra(ora)}</h2>
          </div>
          <button className="link" onClick={onChiudi}>
            Chiudi
          </button>
        </header>

        {voci.length === 0 && <p className="piccolo">Nessuna attività. Aggiungine una.</p>}

        {voci.map((v, i) => {
          const sotto = stato.sottocategorie.filter((s) => s.categoria_id === v.categoria_id && s.attiva)
          const cat = archivio.categoriaPerId(v.categoria_id)
          return (
            <div key={v.id} className="voce" style={{ '--colore': cat?.colore }}>
              <div className="voce-testa">
                <select
                  value={v.categoria_id}
                  onChange={(e) => cambia(i, 'categoria_id', e.target.value)}
                >
                  {/* mostro anche una categoria disattivata se è già usata qui */}
                  {[...categorie, ...(cat && !cat.attiva ? [cat] : [])].map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
                <button
                  className="link pericolo"
                  onClick={() => setVoci((vv) => vv.filter((_, j) => j !== i))}
                  aria-label="Togli attività"
                >
                  ✕
                </button>
              </div>
              {/* minuti a blocchi di PASSO, senza superare i 60 dell'ora */}
              <div className="riga-dettaglio">
                <span>Minuti</span>
                <span className="dividi-comandi">
                  <button aria-label={`Meno ${PASSO} minuti`} disabled={v.minuti <= PASSO} onClick={() => cambia(i, 'minuti', v.minuti - PASSO)}>
                    −
                  </button>
                  <span className="dividi-valore">
                    <b>{v.minuti}′</b>
                    <small>{percentualeOra(v.minuti)}</small>
                  </span>
                  <button aria-label={`Più ${PASSO} minuti`} disabled={totale + PASSO > 60} onClick={() => cambia(i, 'minuti', v.minuti + PASSO)}>
                    +
                  </button>
                  {totale < 60 && (
                    <button className="dividi-resto" onClick={() => cambia(i, 'minuti', v.minuti + 60 - totale)}>
                      +{60 - totale}′
                    </button>
                  )}
                </span>
              </div>
              {sotto.length > 0 && (
                <Pillole
                  etichetta="Sottocategoria"
                  opzioni={sotto.map((s) => ({ valore: s.id, testo: s.nome }))}
                  valore={v.sottocategoria_id}
                  onCambia={(x) => cambia(i, 'sottocategoria_id', x)}
                />
              )}
              <div className="riga-dettaglio">
                <span>Potevi delegarla?</span>
                <Pillole
                  opzioni={OPZIONI_DELEGA}
                  valore={v.delegabile}
                  onCambia={(x) => cambia(i, 'delegabile', x)}
                />
              </div>
              <div className="riga-dettaglio">
                <span>Energia</span>
                <Pillole
                  opzioni={OPZIONI_ENERGIA}
                  valore={v.energia}
                  onCambia={(x) => cambia(i, 'energia', x)}
                />
              </div>
              <input
                className="nota"
                placeholder="Nota breve (facoltativa)"
                maxLength={280}
                value={v.nota ?? ''}
                onChange={(e) => cambia(i, 'nota', e.target.value || null)}
              />
            </div>
          )
        })}

        {totale < 60 && (
          <button className="secondario largo" onClick={aggiungi}>
            + Aggiungi attività
          </button>
        )}

        <p className={'totale' + (totale > 60 ? ' troppo' : '')}>
          Totale: {totale}′ su 60′
          {totale > 60 && ' — togli qualche minuto'}
          {totale > 0 && totale < 60 && ` — ${60 - totale}′ non assegnati`}
        </p>

        <button className="primario largo" disabled={totale > 60} onClick={salva}>
          {voci.length ? 'Salva' : 'Salva (ora vuota)'}
        </button>
      </div>
    </div>
  )
}
