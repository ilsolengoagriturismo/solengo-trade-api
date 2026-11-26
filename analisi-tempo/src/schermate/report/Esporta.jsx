// =====================================================================
// REPORT — condividi con il coach (PDF e CSV)
// (sezioni del Report, separate per tenere i file piccoli e leggibili)
// =====================================================================
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import * as archivio from '../../lib/archivio.js'
import { usaArchivio } from '../../lib/usaArchivio.js'
import {
  periodo,
  spostaPeriodo,
  riepilogo,
  fattoreProiezione,
  copertura,
  ore,
  percento,
  stimaVsReale,
  delegabili,
  conSegno,
  matriceUrgenteImportante,
  allineamentoObiettivo,
  bolleMappa,
  concentrazione,
  frasiChiave,
  oreMigliori,
  tempoEnergia,
  energiaComeRighe,
} from '../../lib/report.js'
import { posizione } from '../../lib/mappa.js'
import { csvRiepilogo, csvDettaglio, pdfReport, condividiOScarica, nomeFile } from '../../lib/esporta.js'
import { aderenzaIdeale, periodoAnalisi, NOMI_GIORNI } from '../../lib/settimana.js'
import { FASE_2_ATTIVA } from '../../lib/fasi.js'

// ---------------------------------------------------------------------
// EXPORT CSV / PDF
// ---------------------------------------------------------------------
export function Esporta({ p, tipo, r, svr, fattore, deleg, matrice, allin, cop, frasi, aderenza, righe, stato }) {
  const [stato_, setStato] = useState('')
  const titolo =
    tipo === 'analisi'
      ? `Report finale per il coach - periodo di analisi ${p.etichetta}`
      : `${{ giorno: 'Giorno', settimana: 'Settimana', mese: 'Mese' }[tipo]}: ${p.etichetta}`

  async function esegui(crea, nome, tipoMime) {
    setStato('Preparo il file…')
    try {
      const contenuto = await crea()
      const blob = contenuto instanceof Blob ? contenuto : new Blob([contenuto], { type: tipoMime })
      const esito = await condividiOScarica(blob, nome, titolo)
      setStato(esito === 'scaricato' ? 'File scaricato ✓' : esito === 'condiviso' ? 'Condiviso ✓' : '')
    } catch (e) {
      setStato(`Errore: ${e.message}`)
    }
    setTimeout(() => setStato(''), 3000)
  }

  const vuoto = !righe.length
  return (
    <section className="sezione-report">
      <h2>Condividi con il coach</h2>
      <div className="bottoni-export">
        <button
          className="primario"
          disabled={vuoto}
          onClick={() =>
            esegui(
              () =>
                pdfReport({
                  titolo,
                  sottotitolo: `Periodo: ${p.da.toLocaleDateString('it-IT')} – ${new Date(p.a.getTime() - 1).toLocaleDateString('it-IT')}`,
                  r,
                  svr: svr && svr.righe.some((x) => x.stima != null) ? svr : null,
                  fattore,
                  deleg,
                  matrice,
                  allin,
                  cop,
                  frasi,
                  aderenza,
                }),
              nomeFile(tipo === 'analisi' ? `report finale ${p.etichetta}` : p.etichetta, 'pdf'),
            )
          }
        >
          📄 PDF
        </button>
        <button
          className="secondario"
          disabled={vuoto}
          onClick={() =>
            esegui(
              () =>
                csvRiepilogo({
                  titolo,
                  r,
                  svr: svr && svr.righe.some((x) => x.stima != null) ? svr : null,
                  fattore,
                }),
              nomeFile(`riepilogo ${p.etichetta}`, 'csv'),
              'text/csv;charset=utf-8',
            )
          }
        >
          CSV riepilogo
        </button>
        <button
          className="secondario"
          disabled={vuoto}
          onClick={() =>
            esegui(
              () => csvDettaglio(righe, stato.categorie, stato.sottocategorie),
              nomeFile(`dettaglio ${p.etichetta}`, 'csv'),
              'text/csv;charset=utf-8',
            )
          }
        >
          CSV dettaglio ore
        </button>
      </div>
      {stato_ && <p className="piccolo centrato">{stato_}</p>}
    </section>
  )
}

