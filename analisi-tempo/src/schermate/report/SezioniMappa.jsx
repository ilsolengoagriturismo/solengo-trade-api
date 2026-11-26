// =====================================================================
// REPORT — mappa a bolle, concentrazione, energia, urgente/importante, obiettivo
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
// MAPPA A BOLLE: dove sta ogni attività (urgenza × obiettivo)
// colore = attività, grandezza = ore piazzate sulla mappa
// ---------------------------------------------------------------------
export function MappaBolle({ bolle }) {
  const max = Math.max(1, ...bolle.map((b) => b.minuti))
  return (
    <section className="sezione-report">
      <h2>Mappa del tuo tempo</h2>
      {!bolle.length ? (
        <p className="piccolo">
          Ancora nessuna attività piazzata sulla mappa in questo periodo (la mappa compare dopo
          ogni registrazione).
        </p>
      ) : (
        <>
          <div className="mappa-cornice">
            <span className="mappa-asse-y">In linea con l'obiettivo ↑</span>
            <div className="mappa mappa-report">
              <span className="q q-pianificare">Pianificare</span>
              <span className="q q-fare">Fare subito</span>
              <span className="q q-eliminare">Eliminare</span>
              <span className="q q-delegare">Delegare</span>
              {bolle.map((b) => {
                const p = posizione(b.urgenza, b.allineamento)
                const lato = 18 + Math.sqrt(b.minuti / max) * 52 // area proporzionale alle ore
                return (
                  <span
                    key={b.categoria.id}
                    className="bolla"
                    style={{
                      left: `${p.sinistra}%`,
                      top: `${p.alto}%`,
                      width: lato,
                      height: lato,
                      '--colore': b.categoria.colore,
                    }}
                    title={`${b.categoria.nome}: ${ore(b.minuti)} h`}
                  />
                )
              })}
            </div>
            <span className="mappa-asse-x">Urgenza →</span>
          </div>
          <ul className="legenda-bolle">
            {bolle.map((b) => (
              <li key={b.categoria.id}>
                <span className="pallino" style={{ '--colore': b.categoria.colore }} />
                {b.categoria.nome} <b>{ore(b.minuti)} h</b>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------
// CONCENTRAZIONE: ore pulite / spezzate, blocchi di lavoro autonomo
// ---------------------------------------------------------------------
export function Concentrazione({ c }) {
  if (!c.oreRegistrate) return null
  return (
    <section className="sezione-report">
      <h2>Concentrazione</h2>
      <div className="riepilogo-giorno">
        <div>
          <b>{c.pulite}</b>
          <small>ore senza interruzioni</small>
        </div>
        <div>
          <b>{c.spezzate}</b>
          <small>ore spezzate (3+ attività)</small>
        </div>
        <div>
          <b>{c.blocchi}</b>
          <small>blocchi di lavoro autonomo da 2+ ore</small>
        </div>
      </div>
      <p className="piccolo">
        Il lavoro di pensiero rende davvero in blocchi lunghi senza interruzioni. Su{' '}
        {c.oreRegistrate} ore registrate, {percento((c.pulite / c.oreRegistrate) * 100)} sono state
        dedicate a una sola attività.
      </p>
    </section>
  )
}

// ---------------------------------------------------------------------
// TEMPO × ENERGIA: quali attività ti danno o ti tolgono energia (Esydo)
// ---------------------------------------------------------------------
export function TempoEnergia({ t }) {
  if (t.media == null) return null
  const punti = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n))}`
  return (
    <section className="sezione-report">
      <h2>Tempo × energia</h2>
      <p className="piccolo">
        Energia misurata da Esydo nelle ore in cui hai fatto ogni attività. La tua media nel
        periodo è {Math.round(t.media)} su 100 ({ore(t.minutiConEnergia)} h con misura).
      </p>
      <table className="tabella-corso">
        <tbody>
          {t.righe.map((x) => (
            <tr key={x.categoria.id}>
              <td>
                <span className="pallino" style={{ '--colore': x.categoria.colore }} />
                {x.categoria.nome}
              </td>
              <td className="num">{Math.round(x.media)}</td>
              <td className={'num ' + (x.differenza < -5 ? 'scostato' : x.differenza > 5 ? 'positivo' : '')}>
                {punti(x.differenza)}
              </td>
              <td className="num">{ore(x.minuti)} h</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="piccolo">In alto le attività con più energia, in basso quelle che ti costano di più.</p>
    </section>
  )
}

// ---------------------------------------------------------------------
// LE TUE ORE MIGLIORI: energia media per ora del giorno
// ---------------------------------------------------------------------
export function OreMigliori({ e }) {
  if (!e.ore.length) return null
  const due = (h) => `${String(h % 24).padStart(2, '0')}:00`
  return (
    <section className="sezione-report">
      <h2>Le tue ore migliori</h2>
      {e.migliore && (
        <p>
          Energia più alta tra le <b>{due(e.migliore.da)}</b> e le <b>{due(e.migliore.a)}</b>:
          proteggi questa fascia per il lavoro autonomo.
        </p>
      )}
      <div className="grafico-energia">
        {e.ore.map((o) => (
          <div key={o.ora} className="colonna-energia" title={`${due(o.ora)}: ${o.media.toFixed(1)}`}>
            <span
              className={'barra-energia' + (e.migliore && o.ora >= e.migliore.da && o.ora < e.migliore.a ? ' top' : '')}
              style={{ height: `${(o.media / e.scala) * 100}%` }}
            />
            <small>{o.ora}</small>
          </div>
        ))}
      </div>
      <p className="piccolo">Energia media per ogni ora del giorno: {e.fonte}.</p>
    </section>
  )
}

// ---------------------------------------------------------------------
// URGENTE / IMPORTANTE (matrice di Eisenhower)
// ---------------------------------------------------------------------
const QUADRANTI = [
  ['fare', 'Urgente e importante', 'fare subito'],
  ['pianificare', 'Importante, non urgente', 'da far crescere'],
  ['delegare', 'Urgente, non importante', 'da delegare'],
  ['eliminare', 'Né urgente né importante', 'da eliminare'],
]

export function UrgenteImportante({ m }) {
  const tot = m.conRisposta
  return (
    <section className="sezione-report">
      <h2>Urgente / Importante</h2>
      {!tot ? (
        <p className="piccolo">
          Ancora nessuna attività con entrambe le risposte (Urgente? Importante?) in questo periodo.
        </p>
      ) : (
        <>
          <div className="matrice">
            {QUADRANTI.map(([chiave, nome, consiglio]) => (
              <div key={chiave} className={'quadrante q-' + chiave}>
                <small>{nome}</small>
                <b>{ore(m[chiave])} h</b>
                <span>
                  {percento((m[chiave] / tot) * 100)} · {consiglio}
                </span>
              </div>
            ))}
          </div>
          <p className="piccolo">
            Calcolato su {ore(tot)} h di lavoro con entrambe le risposte
            {m.senzaRisposta > 0 && ` (${ore(m.senzaRisposta)} h senza risposta)`}.
          </p>
        </>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------
// ALLINEAMENTO ALL'OBIETTIVO PRINCIPALE (1..5)
// ---------------------------------------------------------------------
export function Allineamento({ a, obiettivo }) {
  const max = Math.max(1, ...Object.values(a.perVoto))
  return (
    <section className="sezione-report">
      <h2>In linea con l'obiettivo</h2>
      {obiettivo && <p className="piccolo">🎯 {obiettivo}</p>}
      {a.media == null ? (
        <p className="piccolo">Ancora nessun voto da 1 a 5 in questo periodo.</p>
      ) : (
        <>
          <div className="numero-grande">
            {a.media.toLocaleString('it-IT', { maximumFractionDigits: 1 })} / 5{' '}
            <small>media pesata sulle ore ({ore(a.minutiConVoto)} h con voto)</small>
          </div>
          <div className="grafico">
            {[5, 4, 3, 2, 1].map((n) => (
              <div key={n} className="barra-pista">
                <span className="voto">{n}</span>
                <span className="barra voto-barra" style={{ width: `${(a.perVoto[n] / max) * 70}%` }} />
                <span className="barra-valore">{ore(a.perVoto[n])} h</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

