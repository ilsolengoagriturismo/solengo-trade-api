// =====================================================================
// REPORT — settimana ideale, stima vs reale, ore delegabili
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
// SETTIMANA IDEALE VS REALE (Giorno, Settimana, Periodo)
// Per ogni blocco pianificato: quanta parte l'hai fatta davvero.
// ---------------------------------------------------------------------
const NOME_GIORNO = Object.fromEntries(NOMI_GIORNI)

export function IdealeVsReale({ a }) {
  const due = (h) => `${String(h % 24).padStart(2, '0')}:00`
  return (
    <section className="sezione-report">
      <h2>Settimana ideale vs reale</h2>
      {a.totale.percentuale == null ? (
        <p className="piccolo">
          Nessun blocco della settimana ideale in questo periodo (o non ancora concluso). Disegnala
          in Impostazioni → Settimana ideale.
        </p>
      ) : (
        <>
          <div className="numero-grande">
            {percento(a.totale.percentuale)} <small>aderenza: {ore(a.totale.fatti)} h su {ore(a.totale.pianificati)} h pianificate</small>
          </div>
          <table className="tabella-corso">
            <tbody>
              {a.blocchi.map((b) => {
                const c = archivio.categoriaPerId(b.categoria_id)
                return (
                  <tr key={`${b.giorno}-${b.indice}`}>
                    <td>
                      <span className="pallino" style={{ '--colore': c?.colore }} />
                      {NOME_GIORNO[b.giorno].slice(0, 3)} {due(b.inizio)}–{due(b.fine)} · {c?.nome ?? '?'}
                    </td>
                    <td className="num">
                      {ore(b.fatti)}/{ore(b.pianificati)} h
                    </td>
                    <td className={'num ' + (b.percentuale < 50 ? 'scostato' : '')}>{percento(b.percentuale)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="piccolo">In arancione i blocchi rispettati per meno della metà.</p>
        </>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------
// STIMA VS REALE (solo vista Mese)
// ---------------------------------------------------------------------
export function StimaVsReale({ svr, stato }) {
  const [modifica, setModifica] = useState(false)
  const senzaStima = svr.righe.every((x) => x.stima == null)
  return (
    <section className="sezione-report">
      <div className="testa-sezione">
        <h2>Stima vs Reale</h2>
        <button className="link" onClick={() => setModifica(true)}>
          {senzaStima ? 'Inserisci stime' : 'Modifica stime'}
        </button>
      </div>
      {senzaStima ? (
        <p className="piccolo">
          Inserisci quante ore al mese <b>pensi</b> di dedicare a ogni attività, poi confrontale con
          quelle misurate.
        </p>
      ) : (
        <>
          <p className="piccolo">
            {svr.usaProiezione
              ? 'Mese in corso: confronto la stima con la proiezione a fine mese.'
              : 'Confronto la stima con le ore registrate nel mese.'}
          </p>
          <table className="tabella-corso">
            <thead>
              <tr>
                <th>Attività</th>
                <th className="num">Stima</th>
                <th className="num">{svr.usaProiezione ? 'Proiez.' : 'Reale'}</th>
                <th className="num">Scost.</th>
              </tr>
            </thead>
            <tbody>
              {svr.righe.map((x) => (
                <tr key={x.categoria.id}>
                  <td>
                    <span className="pallino" style={{ '--colore': x.categoria.colore }} />
                    {x.categoria.nome}
                  </td>
                  <td className="num">{x.stima == null ? '–' : ore(x.stima * 60)}</td>
                  <td className="num">{ore(x.valore * 60)}</td>
                  <td className={'num ' + classeScostamento(x.scostamentoPct)}>
                    {x.scostamento == null ? '' : conSegno(x.scostamento)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Totale</th>
                <th className="num">{ore(svr.totale.stima * 60)}</th>
                <th className="num">{ore(svr.totale.valore * 60)}</th>
                <th className={'num ' + classeScostamento(svr.totale.scostamentoPct)}>
                  {conSegno(svr.totale.scostamento)}
                </th>
              </tr>
            </tfoot>
          </table>
          <p className="piccolo">
            In evidenza le attività che si discostano di più del 25% dalla stima.
          </p>
        </>
      )}
      {modifica && <ModificaStime stato={stato} onChiudi={() => setModifica(false)} />}
    </section>
  )
}

const classeScostamento = (pct) => (pct != null && Math.abs(pct) > 25 ? 'scostato' : '')

function ModificaStime({ stato, onChiudi }) {
  const categorie = stato.categorie.filter((c) => c.lavoro && c.attiva)
  const [valori, setValori] = useState(() =>
    Object.fromEntries(categorie.map((c) => [c.id, c.ore_stimate_mese == null ? '' : String(Number(c.ore_stimate_mese))])),
  )
  const [errore, setErrore] = useState('')
  const [attesa, setAttesa] = useState(false)
  const totale = Object.values(valori).reduce((s, v) => s + (Number(v.replace(',', '.')) || 0), 0)

  async function salva() {
    setAttesa(true)
    setErrore('')
    for (const c of categorie) {
      const testo = valori[c.id].trim().replace(',', '.')
      const nuovo = testo === '' ? null : Number(testo)
      if (nuovo != null && (Number.isNaN(nuovo) || nuovo < 0)) {
        setErrore(`Valore non valido per "${c.nome}"`)
        setAttesa(false)
        return
      }
      if (nuovo !== (c.ore_stimate_mese == null ? null : Number(c.ore_stimate_mese))) {
        const { error } = await supabase.from('categorie').update({ ore_stimate_mese: nuovo }).eq('id', c.id)
        if (error) {
          setErrore(navigator.onLine ? error.message : 'Serve la rete per salvare le stime.')
          setAttesa(false)
          return
        }
      }
    }
    await archivio.scaricaConfigurazione().catch(() => {})
    setAttesa(false)
    onChiudi()
  }

  return (
    <div className="foglio-sfondo" onClick={onChiudi}>
      <div className="foglio" onClick={(e) => e.stopPropagation()}>
        <header className="foglio-testa">
          <h2>Ore stimate al mese</h2>
          <button className="link" onClick={onChiudi}>
            Chiudi
          </button>
        </header>
        <p className="piccolo">Quante ore al mese pensi di dedicare a ogni attività?</p>
        {categorie.map((c, i) => (
          <label key={c.id} className="riga-stima">
            <span>
              <span className="pallino" style={{ '--colore': c.colore }} /> {i + 1}. {c.nome}
            </span>
            <input
              inputMode="decimal"
              value={valori[c.id]}
              placeholder="–"
              onChange={(e) => setValori({ ...valori, [c.id]: e.target.value })}
            />
          </label>
        ))}
        <p className="totale">Totale: {totale.toLocaleString('it-IT')} ore al mese</p>
        {errore && <p className="messaggio-errore">{errore}</p>}
        <button className="primario largo" disabled={attesa} onClick={salva}>
          {attesa ? 'Salvo…' : 'Salva stime'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// ORE DELEGABILI
// ---------------------------------------------------------------------
export function Delegabili({ deleg, r, valoreOra }) {
  const conDelega = r.righe.filter((x) => x.categoria.lavoro && x.minutiDelegabili > 0)
  return (
    <section className="sezione-report">
      <h2>Ore delegabili</h2>
      {!deleg.minutiLavoro ? (
        <p className="piccolo">Nessuna ora di lavoro nel periodo.</p>
      ) : (
        <>
          <div className="numero-grande">
            {ore(deleg.minutiDelegabili)} h <small>{percento(deleg.percentuale)} del lavoro</small>
          </div>
          {valoreOra && deleg.minutiDelegabili > 0 && (
            <p className="valore-euro">
              ≈ {((deleg.minutiDelegabili / 60) * valoreOra).toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}{' '}
              del tuo tempo (a {valoreOra.toLocaleString('it-IT')} €/h)
            </p>
          )}
          {conDelega.length > 0 && (
            <table className="tabella-corso">
              <tbody>
                {conDelega.map((x) => (
                  <tr key={x.categoria.id}>
                    <td>
                      <span className="pallino" style={{ '--colore': x.categoria.colore }} />
                      {x.categoria.nome}
                    </td>
                    <td className="num">{ore(x.minutiDelegabili)} h</td>
                    <td className="num">{percento((x.minutiDelegabili / x.minuti) * 100)} della categoria</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="piccolo">
            Attività piazzate sulla mappa: {ore(deleg.minutiConRisposta)} h su{' '}
            {ore(deleg.minutiLavoro)} h di lavoro
            {deleg.minutiConRisposta < deleg.minutiLavoro * 0.5 &&
              ': piazza più spesso le attività sulla mappa dopo la registrazione, per un dato più affidabile'}
            .
          </p>
        </>
      )}
    </section>
  )
}

