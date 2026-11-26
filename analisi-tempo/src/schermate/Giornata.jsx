// =====================================================================
// TIMELINE DEL GIORNO: tutte le ore, con quello che hai registrato.
// Tocca un'ora per modificarla o compilarla a mano.
// =====================================================================
import { useEffect, useState } from 'react'
import * as archivio from '../lib/archivio.js'
import { usaArchivio, formatoMinuti } from '../lib/usaArchivio.js'
import {
  oreDelGiorno,
  inFascia,
  inizioGiorno,
  aggiungiGiorni,
  etichettaGiorno,
  hhmm,
  chiaveOra,
} from '../lib/ore.js'
import EditorOra from '../componenti/EditorOra.jsx'

export default function Giornata() {
  const stato = usaArchivio()
  const [giorno, setGiorno] = useState(() => inizioGiorno(new Date()))
  const [tutteLeOre, setTutteLeOre] = useState(false)
  const [inModifica, setInModifica] = useState(null) // Date dell'ora aperta
  const [caricando, setCaricando] = useState(false)

  // scarico dal server il giorno scelto (se c'è rete)
  useEffect(() => {
    let annullato = false
    setCaricando(true)
    archivio
      .scaricaRegistrazioni(giorno, aggiungiGiorni(giorno, 1))
      .catch(() => {})
      .finally(() => !annullato && setCaricando(false))
    return () => {
      annullato = true
    }
  }, [giorno])

  const fascia = stato.impostazioni?.fascia
  const adesso = new Date()
  const oggi = inizioGiorno(adesso).getTime() === giorno.getTime()

  const ore = oreDelGiorno(giorno).filter(
    (o) => tutteLeOre || inFascia(fascia, o) || archivio.vociOra(o).length > 0,
  )

  // totali del giorno
  let minutiLavoro = 0
  let minutiPausa = 0
  let vuote = 0
  for (const o of oreDelGiorno(giorno)) {
    const voci = archivio.vociOra(o)
    for (const v of voci) {
      if (archivio.categoriaPerId(v.categoria_id)?.lavoro) minutiLavoro += v.minuti
      else minutiPausa += v.minuti
    }
    if (!voci.length && inFascia(fascia, o) && o.getTime() + 3600000 <= adesso.getTime()) vuote++
  }

  return (
    <div className="giornata">
      <div className="navigazione-giorno">
        <button className="secondario" onClick={() => setGiorno(aggiungiGiorni(giorno, -1))}>
          ‹
        </button>
        <div>
          <b>{etichettaGiorno(giorno, adesso)}</b>
          <small>{giorno.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}</small>
        </div>
        <button
          className="secondario"
          disabled={oggi}
          onClick={() => setGiorno(aggiungiGiorni(giorno, 1))}
        >
          ›
        </button>
      </div>

      <div className="riepilogo-giorno">
        <div>
          <b>{formatoMinuti(minutiLavoro)}</b>
          <small>lavoro</small>
        </div>
        <div>
          <b>{formatoMinuti(minutiPausa)}</b>
          <small>pausa/personale</small>
        </div>
        <div>
          <b>{vuote}</b>
          <small>ore vuote</small>
        </div>
      </div>

      {caricando && <p className="piccolo centrato">Aggiorno…</p>}

      <ol className="timeline">
        {ore.map((o) => {
          const voci = archivio.vociOra(o)
          const futura = o.getTime() > adesso.getTime()
          const fuori = !inFascia(fascia, o)
          return (
            <li key={chiaveOra(o)}>
              <button
                className={'ora' + (fuori ? ' fuori-fascia' : '')}
                disabled={futura}
                onClick={() => setInModifica(o)}
              >
                <span className="ora-orario">{hhmm(o)}</span>
                <span className="ora-barra">
                  {voci.length === 0 ? (
                    <span className="ora-vuota">{futura ? '' : '— da compilare'}</span>
                  ) : (
                    voci.map((v) => {
                      const c = archivio.categoriaPerId(v.categoria_id)
                      const s = archivio.sottocategoriaPerId(v.sottocategoria_id)
                      return (
                        <span
                          key={v.id}
                          className="segmento"
                          style={{ '--colore': c?.colore, flexGrow: v.minuti }}
                        >
                          {c?.nome ?? '?'}
                          {s ? ` · ${s.nome}` : ''}
                          {v.minuti < 60 ? ` ${v.minuti}′` : ''}
                          {v.delegabile ? ' ↗' : ''}
                          {v.nota ? ' ✎' : ''}
                        </span>
                      )
                    })
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      <label className="interruttore centrato">
        <input type="checkbox" checked={tutteLeOre} onChange={(e) => setTutteLeOre(e.target.checked)} />
        Mostra anche le ore fuori dalla fascia di lavoro
      </label>
      <p className="piccolo centrato">↗ = delegabile · ✎ = con nota</p>

      {inModifica && <EditorOra ora={inModifica} onChiudi={() => setInModifica(null)} />}
    </div>
  )
}
